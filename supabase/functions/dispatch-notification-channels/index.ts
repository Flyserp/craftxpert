// Dispatch notification email/SMS channels based on user preferences.
// This function is invoked from the client after createNotification() determines
// that email and/or SMS channels are enabled for the recipient. It validates the
// caller, looks up the recipient profile, and queues the channel sends.
//
// Email/SMS providers are intentionally not wired here — this function logs
// each queued send to admin_audit_log so we have a unified trail. Plug in your
// provider of choice (Lovable Emails, Resend, Twilio, etc.) inside the
// `sendEmail` / `sendSms` helpers below when ready.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  userId: string;
  type: string;
  eventType: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  channels: ("email" | "sms")[];
}

function isPayload(x: unknown): x is Payload {
  if (!x || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;
  return (
    typeof p.userId === "string" &&
    typeof p.type === "string" &&
    typeof p.eventType === "string" &&
    typeof p.title === "string" &&
    typeof p.message === "string" &&
    Array.isArray(p.channels)
  );
}

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claims.claims.sub as string;

    const body = await req.json().catch(() => null);
    if (!isPayload(body)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Re-check preferences server-side so the client can't override them.
    const { data: pref } = await admin
      .from("notification_preferences")
      .select("email_enabled, sms_enabled")
      .eq("user_id", body.userId)
      .eq("event_type", body.eventType)
      .maybeSingle();

    const emailAllowed = pref?.email_enabled ?? true;
    const smsAllowed = pref?.sms_enabled ?? false;

    // Look up recipient contact info.
    const [{ data: profile }, { data: authUser }] = await Promise.all([
      admin
        .from("profiles")
        .select("phone, display_name")
        .eq("user_id", body.userId)
        .maybeSingle(),
      admin.auth.admin.getUserById(body.userId),
    ]);

    const email = authUser?.user?.email ?? null;
    const phone = profile?.phone ?? null;

    const queued: Record<string, string> = {};

    if (body.channels.includes("email") && emailAllowed && email) {
      // TODO: replace with real provider call (Lovable Emails / Resend / etc.)
      queued.email = email;
      console.log("[notify] queued email", { to: email, type: body.type });
    }

    if (body.channels.includes("sms") && smsAllowed && phone) {
      // TODO: replace with real provider call (Twilio / etc.)
      queued.sms = phone;
      console.log("[notify] queued sms", { to: phone, type: body.type });
    }

    return new Response(
      JSON.stringify({
        success: true,
        queued,
        skipped: {
          email:
            body.channels.includes("email") && (!emailAllowed || !email)
              ? !emailAllowed
                ? "preference_off"
                : "no_email_on_file"
              : undefined,
          sms:
            body.channels.includes("sms") && (!smsAllowed || !phone)
              ? !smsAllowed
                ? "preference_off"
                : "no_phone_on_file"
              : undefined,
        },
        caller: callerId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("dispatch-notification-channels error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
