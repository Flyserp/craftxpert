import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Marks expired verifications (vendors + employers) and sends expiry-warning notifications
// at 30, 7, and 1 day windows.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Expire stale verifications via SECURITY DEFINER function
    const { data: expiredRes, error: expiredErr } = await supabase.rpc("expire_stale_verifications");
    if (expiredErr) throw expiredErr;

    // 2) Load configurable reminder windows (fallback: 30,7,1)
    const { data: settingRow } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "verification_reminder_days_csv")
      .maybeSingle();
    const csv = (settingRow?.value as string | null) ?? "30,7,1";
    const days = Array.from(
      new Set(
        csv
          .split(",")
          .map((s) => parseInt(s.replace(/[^0-9]/g, ""), 10))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    ).sort((a, b) => b - a);

    const labelFor = (d: number) =>
      d === 1 ? "tomorrow" : d === 7 ? "in 1 week" : d === 30 ? "in 30 days" : `in ${d} days`;

    const windows = days.map((d) => ({ days: d, key: `verification_expiry_${d}d`, label: labelFor(d) }));


    const now = Date.now();
    const breakdown: Record<string, number> = {};

    for (const w of windows) {
      const lower = new Date(now + (w.days - 1) * 86400000).toISOString();
      const upper = new Date(now + w.days * 86400000).toISOString();

      // --- Vendors ---
      const { data: vendorRows } = await supabase
        .from("vendor_verifications")
        .select("id, vendor_id, expires_at")
        .eq("status", "approved")
        .gte("expires_at", lower)
        .lt("expires_at", upper);

      // --- Employers ---
      const { data: employerRows } = await supabase
        .from("employer_profiles")
        .select("id, user_id, verification_expires_at")
        .eq("verification_status", "verified")
        .gte("verification_expires_at", lower)
        .lt("verification_expires_at", upper);

      const targetIds = [
        ...(vendorRows || []).map((r) => `v:${r.id}`),
        ...(employerRows || []).map((r) => `e:${r.id}`),
      ];
      if (targetIds.length === 0) {
        breakdown[w.key] = 0;
        continue;
      }

      const { data: existing } = await supabase
        .from("notifications")
        .select("metadata")
        .eq("type", w.key)
        .in("metadata->>target_id", targetIds);
      const already = new Set((existing || []).map((n: any) => n.metadata?.target_id).filter(Boolean));

      const rows = [
        ...(vendorRows || []).map((r) => ({
          user_id: r.vendor_id,
          title: `Your verification expires ${w.label}`,
          message: `Your provider verification will expire on ${new Date(r.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. Renew ($10/year) to keep your verified badge and continue receiving bookings.`,
          type: w.key,
          metadata: { target_id: `v:${r.id}`, kind: "vendor", expires_at: r.expires_at },
        })),
        ...(employerRows || []).map((r) => ({
          user_id: r.user_id,
          title: `Your verification expires ${w.label}`,
          message: `Your employer verification will expire on ${new Date(r.verification_expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. Renew ($10/year) to keep your verified badge on job postings.`,
          type: w.key,
          metadata: { target_id: `e:${r.id}`, kind: "employer", expires_at: r.verification_expires_at },
        })),
      ].filter((n) => !already.has(n.metadata.target_id));

      if (rows.length === 0) {
        breakdown[w.key] = 0;
        continue;
      }

      // Insert notifications one at a time so we can capture each id for the audit log.
      // (still a single sweep — count is small: verifications expiring in a 1-day slice.)
      let sentCount = 0;
      for (const row of rows) {
        const kind = row.metadata.kind as "vendor" | "employer";
        const targetId = row.metadata.target_id as string;
        const expiresIso = row.metadata.expires_at as string;

        // 1) In-app notification
        let notificationId: string | null = null;
        let inAppStatus: "sent" | "failed" = "sent";
        let inAppError: string | null = null;
        const { data: inserted, error: insErr } = await supabase
          .from("notifications")
          .insert(row)
          .select("id")
          .single();
        if (insErr) {
          inAppStatus = "failed";
          inAppError = insErr.message;
          console.warn("expiry in-app insert failed", targetId, insErr);
        } else {
          notificationId = inserted?.id ?? null;
          sentCount += 1;
        }

        // 2) Profile + email lookup
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, business_name")
          .eq("user_id", row.user_id)
          .maybeSingle();
        let recipientEmail: string | null = null;
        try {
          const { data: userLookup } = await supabase.auth.admin.getUserById(row.user_id);
          recipientEmail = userLookup?.user?.email ?? null;
        } catch (_e) {
          // ignore — email is best-effort metadata for the audit log
        }
        const expiresOn = new Date(expiresIso).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        let emailStatus: "sent" | "failed" | "skipped" = "sent";
        let emailError: string | null = null;
        if (inAppStatus === "failed") {
          // Don't send email if we couldn't record the in-app notification
          emailStatus = "skipped";
          emailError = "in-app insert failed";
        } else {
          try {
            const { error: emailErr } = await supabase.functions.invoke("send-booking-email", {
              body: {
                templateKey: "verification_expiring",
                recipientUserId: row.user_id,
                variables: {
                  recipient_name: profile?.display_name ?? "there",
                  business_name: profile?.business_name ?? profile?.display_name ?? "your business",
                  when_label: w.label,
                  expires_on: expiresOn,
                },
              },
            });
            if (emailErr) {
              emailStatus = "failed";
              emailError = emailErr.message;
            }
          } catch (e) {
            emailStatus = "failed";
            emailError = e instanceof Error ? e.message : String(e);
            console.warn("expiry email failed", row.user_id, e);
          }
        }

        // 3) Audit log entry (best-effort — never fail the sweep on log write)
        try {
          await supabase.from("verification_reminder_log").insert({
            window_key: w.key,
            window_days: w.days,
            window_label: w.label,
            kind,
            target_id: targetId,
            recipient_user_id: row.user_id,
            recipient_email: recipientEmail,
            recipient_name:
              profile?.business_name ?? profile?.display_name ?? null,
            expires_at: expiresIso,
            notification_id: notificationId,
            in_app_status: inAppStatus,
            in_app_error: inAppError,
            email_status: emailStatus,
            email_error: emailError,
            metadata: {
              title: row.title,
              type: row.type,
            },
          });
        } catch (e) {
          console.warn("reminder log insert failed", targetId, e);
        }
      }
      breakdown[w.key] = sentCount;
    }


    return new Response(
      JSON.stringify({ expired: expiredRes, warnings_sent: breakdown }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
