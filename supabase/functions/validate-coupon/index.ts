import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { code, order_amount, applicable_to } = body;

    if (!code || typeof code !== "string" || code.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Coupon code is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order_amount == null || typeof order_amount !== "number" || order_amount < 0) {
      return new Response(JSON.stringify({ error: "Valid order_amount is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to bypass RLS for full coupon validation
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: coupon, error: couponError } = await adminClient
      .from("promo_coupons")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .eq("is_active", true)
      .single();

    if (couponError || !coupon) {
      return new Response(JSON.stringify({ error: "Invalid or expired coupon code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check validity period
    const now = new Date();
    if (new Date(coupon.valid_from) > now) {
      return new Response(JSON.stringify({ error: "Coupon is not yet active" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return new Response(JSON.stringify({ error: "Coupon has expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check usage limit
    if (coupon.max_uses != null && coupon.current_uses >= coupon.max_uses) {
      return new Response(JSON.stringify({ error: "Coupon usage limit reached" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check applicable_to
    const target = applicable_to || "booking";
    if (coupon.applicable_to !== target && coupon.applicable_to !== "all") {
      return new Response(JSON.stringify({ error: "Coupon is not applicable to this purchase type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check minimum order amount
    if (coupon.min_order_amount && order_amount < coupon.min_order_amount) {
      return new Response(
        JSON.stringify({ error: `Minimum order amount is $${coupon.min_order_amount}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate discount server-side
    let discountAmount: number;
    if (coupon.discount_type === "percentage") {
      discountAmount = Math.round((order_amount * coupon.discount_value) / 100 * 100) / 100;
    } else {
      discountAmount = Math.min(coupon.discount_value, order_amount);
    }
    discountAmount = Math.round(discountAmount * 100) / 100;

    const finalPrice = Math.round((order_amount - discountAmount) * 100) / 100;

    return new Response(
      JSON.stringify({
        valid: true,
        coupon_id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        discount_amount: discountAmount,
        final_price: finalPrice,
        description: coupon.description,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
