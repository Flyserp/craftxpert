// Edge function: invite-staff
// Creates (or rotates) a staff invitation for the calling provider and returns
// the shareable claim URL. Enforces plan-based seat limits.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PLAN_LIMITS: Record<string, number> = {
  free: 1,
  pro: 5,
  elite: 999,
};

const BodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  title: z.string().trim().max(100).optional(),
  role: z.enum(["staff", "manager", "provider_admin"]).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const providerId = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return json(
        { error: parsed.error.flatten().fieldErrors },
        400
      );
    }
    const { email, title, role } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Confirm caller is a provider
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", providerId)
      .eq("role", "provider")
      .maybeSingle();
    if (!roleRow) return json({ error: "Only providers can invite staff" }, 403);

    // Determine plan + current seat usage
    const { data: settings } = await admin
      .from("provider_settings")
      .select("plan")
      .eq("user_id", providerId)
      .maybeSingle();
    const plan = settings?.plan ?? "free";
    const limit = PLAN_LIMITS[plan] ?? 1;

    const [{ count: staffCount }, { count: pendingCount }] = await Promise.all([
      admin
        .from("provider_staff")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", providerId)
        .eq("is_active", true),
      admin
        .from("staff_invitations")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", providerId)
        .eq("status", "pending"),
    ]);

    const used = (staffCount ?? 0) + (pendingCount ?? 0);
    if (used >= limit) {
      return json(
        {
          error: `Your ${plan} plan allows ${limit} staff seat${limit === 1 ? "" : "s"}. Upgrade to invite more.`,
        },
        403
      );
    }

    // Revoke any prior pending invite to the same email
    await admin
      .from("staff_invitations")
      .update({ status: "revoked" })
      .eq("provider_id", providerId)
      .eq("email", email)
      .eq("status", "pending");

    // Create new invite
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { data: invite, error: insertErr } = await admin
      .from("staff_invitations")
      .insert({
        provider_id: providerId,
        email,
        title: title || null,
        role: role ?? "staff",
        token,
      })
      .select("id, token, expires_at, role")
      .single();

    if (insertErr || !invite) {
      return json({ error: insertErr?.message ?? "Failed to create invitation" }, 500);
    }

    const origin = req.headers.get("origin") ?? "";
    const acceptUrl = `${origin}/accept-invite/${invite.token}`;

    return json({
      id: invite.id,
      token: invite.token,
      expires_at: invite.expires_at,
      role: invite.role,
      accept_url: acceptUrl,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
