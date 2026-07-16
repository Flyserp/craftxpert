import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Send a Firebase Cloud Messaging (FCM) push notification to a user's
 * registered device tokens.
 *
 * Requires the `FCM_SERVER_KEY` secret. When absent, returns 200 with
 * `disabled: true` so callers no-op. Every attempt (sent / failed / skipped)
 * is recorded in `notification_delivery_logs` for admin troubleshooting.
 */

interface PushRequest {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

type PrefKey = "booking_updates" | "new_messages" | "payment_updates" | "review_alerts" | "marketing";

function mapEventToCategory(eventType: string | null): PrefKey | null {
  if (!eventType) return null;
  const e = eventType.toLowerCase();
  if (e.startsWith("booking.") || e.startsWith("reschedule.") || e.includes("booking")) return "booking_updates";
  if (e.startsWith("message.") || e.includes("chat") || e.includes("message")) return "new_messages";
  if (e.startsWith("payment.") || e.startsWith("payout.") || e.startsWith("withdrawal.") || e.startsWith("invoice.")) return "payment_updates";
  if (e.startsWith("review.") || e.includes("rating")) return "review_alerts";
  if (e.startsWith("marketing.") || e.startsWith("announcement.") || e.startsWith("promo.")) return "marketing";
  return null;
}



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const log = async (entry: {
    recipient_user_id?: string | null;
    status: "sent" | "failed" | "skipped";
    error?: string | null;
    title?: string | null;
    body?: string | null;
    event_type?: string | null;
    provider_response?: unknown;
    metadata?: Record<string, unknown>;
  }) => {
    try {
      await supabase.from("notification_delivery_logs").insert({
        channel: "push",
        recipient_user_id: entry.recipient_user_id ?? null,
        status: entry.status,
        error: entry.error ?? null,
        title: entry.title ?? null,
        body: entry.body ?? null,
        event_type: entry.event_type ?? null,
        provider_response: entry.provider_response ?? null,
        metadata: entry.metadata ?? {},
      });
    } catch (e) {
      console.error("failed to write notification delivery log", e);
    }
  };

  try {
    const fcmKey = Deno.env.get("FCM_SERVER_KEY");
    const payload = (await req.json().catch(() => ({}))) as Partial<PushRequest>;

    if (!fcmKey) {
      console.warn("send-push: FCM_SERVER_KEY not set — skipping push delivery");
      await log({
        recipient_user_id: payload?.user_id ?? null,
        status: "skipped",
        error: "FCM_SERVER_KEY not configured",
        title: payload?.title ?? null,
        body: payload?.body ?? null,
        event_type: payload?.data?.event_type ?? null,
      });
      return new Response(
        JSON.stringify({ ok: true, sent: 0, disabled: true, reason: "fcm_not_configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!payload?.user_id || !payload?.title || !payload?.body) {
      await log({
        recipient_user_id: payload?.user_id ?? null,
        status: "failed",
        error: "user_id, title and body are required",
        title: payload?.title ?? null,
        body: payload?.body ?? null,
      });
      return new Response(
        JSON.stringify({ error: "user_id, title and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve effective push preferences. Provider settings apply when the
    // provider has explicitly opted to override; otherwise tenant defaults win.
    // Unknown event types default to allowed so system alerts still reach the user.
    const eventType = payload.data?.event_type ?? null;
    const categoryKey = mapEventToCategory(eventType);

    const [{ data: userPrefs }, { data: tenantDefaults }] = await Promise.all([
      supabase
        .from("provider_push_settings")
        .select("push_enabled, booking_updates, new_messages, payment_updates, review_alerts, marketing, overrides_defaults")
        .eq("provider_id", payload.user_id)
        .maybeSingle(),
      supabase
        .from("tenant_push_defaults")
        .select("push_enabled, booking_updates, new_messages, payment_updates, review_alerts, marketing")
        .eq("id", true)
        .maybeSingle(),
    ]);

    const effective = userPrefs?.overrides_defaults ? userPrefs : (tenantDefaults ?? userPrefs);
    const source = userPrefs?.overrides_defaults ? "provider" : (tenantDefaults ? "tenant_default" : "provider");

    if (effective) {
      if (!effective.push_enabled) {
        await log({
          recipient_user_id: payload.user_id,
          status: "skipped",
          error: `push_disabled_by_${source}`,
          title: payload.title,
          body: payload.body,
          event_type: eventType,
          metadata: { source },
        });
        return new Response(
          JSON.stringify({ ok: true, sent: 0, reason: "push_disabled", source }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (categoryKey && (effective as Record<string, boolean>)[categoryKey] === false) {
        await log({
          recipient_user_id: payload.user_id,
          status: "skipped",
          error: `category_disabled:${categoryKey}:${source}`,
          title: payload.title,
          body: payload.body,
          event_type: eventType,
          metadata: { source, category: categoryKey },
        });
        return new Response(
          JSON.stringify({ ok: true, sent: 0, reason: "category_disabled", category: categoryKey, source }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const { data: tokens, error } = await supabase
      .from("device_tokens")
      .select("token, platform")
      .eq("user_id", payload.user_id)
      .eq("is_active", true);

    if (error) throw error;
    if (!tokens || tokens.length === 0) {
      await log({
        recipient_user_id: payload.user_id,
        status: "skipped",
        error: "no_tokens",
        title: payload.title,
        body: payload.body,
        event_type: payload.data?.event_type ?? null,
      });
      return new Response(
        JSON.stringify({ ok: true, sent: 0, reason: "no_tokens" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const INVALID_TOKEN_ERRORS = new Set([
      "NotRegistered",
      "InvalidRegistration",
      "MismatchSenderId",
      "InvalidPackageName",
    ]);

    const results = await Promise.all(
      tokens.map(async (t) => {
        try {
          const res = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
              Authorization: `key=${fcmKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: t.token,
              notification: { title: payload.title!, body: payload.body! },
              data: payload.data ?? {},
            }),
          });
          const respText = await res.text();
          let respJson: unknown = respText;
          try { respJson = JSON.parse(respText); } catch { /* keep as text */ }

          // Detect FCM per-token errors. FCM returns 200 with results[0].error
          // for invalid tokens; also handle HTTP 404 (NotRegistered).
          const fcmErr =
            (respJson && typeof respJson === "object"
              ? (respJson as { results?: Array<{ error?: string }>; error?: string })
              : null);
          const tokenError =
            fcmErr?.results?.[0]?.error ??
            (typeof fcmErr?.error === "string" ? fcmErr.error : null) ??
            (res.status === 404 ? "NotRegistered" : null);

          let tokenAction: "kept" | "invalidated" | "failure_recorded" = "kept";
          if (tokenError && INVALID_TOKEN_ERRORS.has(tokenError)) {
            await supabase.rpc("invalidate_device_token", {
              _token: t.token,
              _reason: tokenError,
            });
            tokenAction = "invalidated";
          } else if (!res.ok) {
            await supabase.rpc("record_device_token_failure", {
              _token: t.token,
              _reason: `HTTP ${res.status}`,
            });
            tokenAction = "failure_recorded";
          } else if (!tokenError) {
            // Successful delivery — refresh last_seen and reset failure counters.
            await supabase
              .from("device_tokens")
              .update({
                last_seen_at: new Date().toISOString(),
                failure_count: 0,
                last_error: null,
              })
              .eq("token", t.token);
          }

          const delivered = res.ok && !tokenError;
          await log({
            recipient_user_id: payload.user_id!,
            status: delivered ? "sent" : "failed",
            error: delivered ? null : (tokenError ?? `HTTP ${res.status}`),
            title: payload.title!,
            body: payload.body!,
            event_type: payload.data?.event_type ?? null,
            provider_response: respJson,
            metadata: {
              platform: t.platform,
              token: t.token.slice(0, 12) + "…",
              token_action: tokenAction,
            },
          });
          return {
            token: t.token.slice(0, 12) + "…",
            status: res.status,
            delivered,
            token_error: tokenError,
            action: tokenAction,
          };
        } catch (e) {
          await supabase.rpc("record_device_token_failure", {
            _token: t.token,
            _reason: (e as Error).message,
          });
          await log({
            recipient_user_id: payload.user_id!,
            status: "failed",
            error: (e as Error).message,
            title: payload.title!,
            body: payload.body!,
            metadata: { platform: t.platform },
          });
          return { token: t.token.slice(0, 12) + "…", status: 0, error: (e as Error).message };
        }
      }),
    );

    const delivered = results.filter((r) => (r as { delivered?: boolean }).delivered).length;
    return new Response(
      JSON.stringify({ ok: true, attempted: results.length, delivered, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    await log({ status: "failed", error: (e as Error).message });
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
