// Edge function: resend-staff-invitation
// Allows the recipient (or anyone holding an old invite link) to request a fresh
// invitation token when the original is expired/revoked. We look up the invite
// by token via service role (RLS would otherwise block the unauthenticated
// recipient), then create a new pending invite for the same provider+email and
// notify the provider so they're aware of the resend request.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
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
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return json({ error: "Invalid token format" }, 400);
    }
    const { token } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: invite, error: lookupErr } = await admin
      .from("staff_invitations")
      .select("id, provider_id, email, title, status, accepted_at")
      .eq("token", token)
      .maybeSingle();

    if (lookupErr) return json({ error: lookupErr.message }, 500);
    if (!invite) return json({ error: "Invitation not found" }, 404);
    if (invite.status === "accepted" || invite.accepted_at) {
      return json({ error: "This invitation has already been accepted." }, 409);
    }

    // Lightweight per-invite rate limit: don't allow more than one resend per
    // 60 seconds for the same original token. We use the most recent pending
    // invite for the same provider+email as a proxy.
    const { data: recent } = await admin
      .from("staff_invitations")
      .select("id, created_at")
      .eq("provider_id", invite.provider_id)
      .eq("email", invite.email)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent?.created_at) {
      const ageMs = Date.now() - new Date(recent.created_at).getTime();
      if (ageMs < 60_000) {
        return json(
          {
            error: "A fresh invite was just sent. Please wait a moment before requesting another.",
          },
          429,
        );
      }
    }

    // Revoke prior pending invites for this email/provider
    await admin
      .from("staff_invitations")
      .update({ status: "revoked" })
      .eq("provider_id", invite.provider_id)
      .eq("email", invite.email)
      .eq("status", "pending");

    const newToken =
      crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "");

    const { data: created, error: insertErr } = await admin
      .from("staff_invitations")
      .insert({
        provider_id: invite.provider_id,
        email: invite.email,
        title: invite.title,
        token: newToken,
      })
      .select("id, token, expires_at")
      .single();

    if (insertErr || !created) {
      return json({ error: insertErr?.message ?? "Failed to create invitation" }, 500);
    }

    // Notify the provider so they know to forward the new link
    await admin.from("notifications").insert({
      user_id: invite.provider_id,
      type: "info",
      title: "Staff invite resend requested",
      message: `${invite.email} requested a fresh invitation link.`,
      metadata: {
        invitation_id: created.id,
        email: invite.email,
      },
    });

    const origin = req.headers.get("origin") ?? "";
    const acceptUrl = origin ? `${origin}/accept-invite/${created.token}` : null;

    return json({
      success: true,
      email: invite.email,
      expires_at: created.expires_at,
      accept_url: acceptUrl,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
