import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sends renewal reminders to vendors whose subscription renews soon.
// Windows: 7 days and 1 day before current_period_end. One notification per window per subscription.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = Date.now();

    // Load configurable reminder windows from platform_settings (fallback: 7,1)
    const { data: setting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "subscription_renewal_reminder_days_csv")
      .maybeSingle();

    const parsed = (setting?.value ?? "")
      .split(",")
      .map((s: string) => parseInt(s.trim(), 10))
      .filter((n: number) => Number.isFinite(n) && n > 0);

    const uniqueDays = Array.from(new Set(parsed.length > 0 ? parsed : [7, 1])).sort(
      (a, b) => b - a,
    );

    const windows = uniqueDays.map((days) => ({
      days,
      key: `renewal_${days}d`,
    }));


    let totalSent = 0;
    const perWindow: Record<string, number> = {};

    for (const w of windows) {
      const lower = new Date(now + (w.days - 1) * 24 * 60 * 60 * 1000).toISOString();
      const upper = new Date(now + w.days * 24 * 60 * 60 * 1000).toISOString();

      const { data: subs, error: sErr } = await supabase
        .from("provider_subscriptions")
        .select("id, provider_id, plan_id, current_period_end, cancel_at_period_end, status")
        .eq("status", "active")
        .eq("cancel_at_period_end", false)
        .gte("current_period_end", lower)
        .lt("current_period_end", upper);

      if (sErr) throw sErr;
      if (!subs || subs.length === 0) {
        perWindow[w.key] = 0;
        continue;
      }

      const subIds = subs.map((s) => s.id);
      const { data: existing } = await supabase
        .from("notifications")
        .select("metadata")
        .eq("type", w.key)
        .in("metadata->>subscription_id", subIds);

      const already = new Set(
        (existing || []).map((n: any) => n.metadata?.subscription_id).filter(Boolean),
      );

      const pending = subs.filter((s) => !already.has(s.id));
      if (pending.length === 0) {
        perWindow[w.key] = 0;
        continue;
      }

      const planIds = [...new Set(pending.map((s) => s.plan_id).filter(Boolean))];
      const { data: plans } = await supabase
        .from("subscription_plans")
        .select("id, name, price")
        .in("id", planIds);
      const planMap = Object.fromEntries((plans || []).map((p) => [p.id, p]));

      const notifications = pending.map((s) => {
        const plan = planMap[s.plan_id];
        const planName = plan?.name || "your plan";
        const when = new Date(s.current_period_end);
        const dateStr = when.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const title =
          w.days === 1 ? "Your subscription renews tomorrow" : `Your subscription renews in ${w.days} days`;
        const message = `Your ${planName} subscription is set to renew on ${dateStr}. Update payment or cancel from your subscription settings to avoid interruption.`;
        return {
          user_id: s.provider_id,
          title,
          message,
          type: w.key,
          metadata: {
            subscription_id: s.id,
            plan_id: s.plan_id,
            plan_name: planName,
            current_period_end: s.current_period_end,
            days_until_renewal: w.days,
          },
        };
      });

      const { error: iErr } = await supabase.from("notifications").insert(notifications);
      if (iErr) throw iErr;

      perWindow[w.key] = notifications.length;
      totalSent += notifications.length;
    }

    return new Response(JSON.stringify({ sent: totalSent, breakdown: perWindow }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
