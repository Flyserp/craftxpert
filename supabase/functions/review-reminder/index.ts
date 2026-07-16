import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find bookings completed ~24h ago that have no review and no reminder sent
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

    // Get completed bookings in the 24-25h window
    const { data: bookings, error: bErr } = await supabase
      .from("bookings")
      .select("id, customer_id, vendor_id, service_id")
      .eq("status", "completed")
      .gte("updated_at", twentyFiveHoursAgo)
      .lte("updated_at", twentyFourHoursAgo);

    if (bErr) throw bErr;
    if (!bookings || bookings.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out bookings that already have reviews
    const bookingIds = bookings.map((b) => b.id);
    const { data: existingReviews } = await supabase
      .from("reviews")
      .select("booking_id")
      .in("booking_id", bookingIds);

    const reviewedBookingIds = new Set((existingReviews || []).map((r) => r.booking_id));

    // Filter out bookings that already have a reminder notification
    const { data: existingNotifs } = await supabase
      .from("notifications")
      .select("metadata")
      .eq("type", "review_reminder")
      .in("metadata->>booking_id", bookingIds);

    const notifiedBookingIds = new Set(
      (existingNotifs || []).map((n: any) => n.metadata?.booking_id).filter(Boolean)
    );

    const needsReminder = bookings.filter(
      (b) => !reviewedBookingIds.has(b.id) && !notifiedBookingIds.has(b.id)
    );

    if (needsReminder.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get vendor names for the notification message
    const vendorIds = [...new Set(needsReminder.map((b) => b.vendor_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", vendorIds);

    const vendorNameMap = Object.fromEntries(
      (profiles || []).map((p) => [p.user_id, p.display_name || "your vendor"])
    );

    // Insert reminder notifications
    const notifications = needsReminder.map((b) => ({
      user_id: b.customer_id,
      title: "How was your experience?",
      message: `Share your feedback about ${vendorNameMap[b.vendor_id]}. Your review helps others find great service providers!`,
      type: "review_reminder",
      metadata: { booking_id: b.id, vendor_id: b.vendor_id },
    }));

    const { error: insertErr } = await supabase.from("notifications").insert(notifications);
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ sent: notifications.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
