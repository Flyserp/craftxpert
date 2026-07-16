import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SubInterval = "monthly" | "quarterly" | "yearly";
export type SubStatus = "active" | "expired" | "cancelled" | "pending";
export type SubTier = "individual" | "small_business";

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: SubTier;
  interval: SubInterval;
  price: number;
  currency: string;
  features: string[];
  sort_order: number;
}

export interface ProviderSubscription {
  id: string;
  plan_id: string;
  status: SubStatus;
  started_at: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  last_renewed_at: string | null;
  plan?: SubscriptionPlan | null;
}

export interface SubscriptionHistoryRow {
  id: string;
  status: SubStatus;
  started_at: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  plan?: { name: string; interval: SubInterval; price: number; tier: SubTier } | null;
}

export function useProviderSubscription() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<ProviderSubscription | null>(null);
  const [history, setHistory] = useState<SubscriptionHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: planRows } = await (supabase as any)
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    setPlans((planRows ?? []) as SubscriptionPlan[]);

    if (user) {
      const { data: subRow } = await (supabase as any)
        .from("provider_subscriptions")
        .select("*, plan:subscription_plans(*)")
        .eq("provider_id", user.id)
        .in("status", ["active", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Auto-expire stale row
      if (subRow && subRow.status === "active" && new Date(subRow.current_period_end) < new Date()) {
        await (supabase as any)
          .from("provider_subscriptions")
          .update({ status: "expired" })
          .eq("id", subRow.id);
        subRow.status = "expired";
      }
      setSubscription(subRow as ProviderSubscription | null);

      const { data: hist } = await (supabase as any)
        .from("provider_subscriptions")
        .select("id,status,started_at,current_period_end,cancel_at_period_end,plan:subscription_plans(name,interval,price,tier)")
        .eq("provider_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setHistory((hist ?? []) as SubscriptionHistoryRow[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Creates a pending subscription + a pending "subscription" payment_transaction.
  // Admin marks the payment completed → DB trigger activates the subscription
  // and cancels any prior active/pending plan (handles renew/upgrade/downgrade).
  const subscribe = useCallback(async (planId: string) => {
    if (!user) throw new Error("Not authenticated");
    const plan = plans.find((p) => p.id === planId);
    if (!plan) throw new Error("Plan not found");
    const now = new Date();
    const { data: subRow, error: subErr } = await (supabase as any)
      .from("provider_subscriptions")
      .insert({
      provider_id: user.id,
      plan_id: plan.id,
        status: "pending" as const,
      started_at: now.toISOString(),
        current_period_end: now.toISOString(),
      cancel_at_period_end: false,
      })
      .select("id")
      .single();
    if (subErr) throw subErr;

    const { error: payErr } = await (supabase as any).from("payment_transactions").insert({
      user_id: user.id,
      vendor_id: user.id,
      amount: Number(plan.price) || 0,
      payment_method: "manual",
      payment_type: "subscription",
      status: "pending",
      metadata: {
        subscription_id: subRow.id,
        plan_id: plan.id,
        plan_name: plan.name,
        interval: plan.interval,
      },
    });
    if (payErr) throw payErr;
    await load();
  }, [user, plans, load]);

  const renew = useCallback(async () => {
    if (!subscription) throw new Error("No subscription to renew");
    await subscribe(subscription.plan_id);
  }, [subscription, subscribe]);

  const cancel = useCallback(async () => {
    if (!subscription) return;
    const { error } = await (supabase as any)
      .from("provider_subscriptions")
      .update({ cancel_at_period_end: true })
      .eq("id", subscription.id);
    if (error) throw error;
    await load();
  }, [subscription, load]);

  const isActive = !!subscription
    && subscription.status === "active"
    && new Date(subscription.current_period_end) > new Date();

  return { plans, subscription, history, isActive, loading, subscribe, renew, cancel, reload: load };
}
