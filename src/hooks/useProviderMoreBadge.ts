import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_LOW_CREDIT_THRESHOLD = 3;

export interface ProviderMoreBadge {
  /** Number of pending withdrawal requests for this provider. */
  pendingWithdrawals: number;
  /** 1 if lead-credit balance is below LOW_CREDIT_THRESHOLD, otherwise 0. */
  lowCredits: number;
  /** Sum of all attention items (used for the bottom-nav More icon badge). */
  total: number;
}

/**
 * Returns provider "attention" counts broken down by source so the More sheet
 * can render inline badges next to Withdrawals and Plans.
 */
export function useProviderMoreBadge(): ProviderMoreBadge {
  const { user } = useAuth();
  const [state, setState] = useState<ProviderMoreBadge>({
    pendingWithdrawals: 0,
    lowCredits: 0,
    total: 0,
  });

  useEffect(() => {
    if (!user) {
      setState({ pendingWithdrawals: 0, lowCredits: 0, total: 0 });
      return;
    }

    let cancelled = false;
    let threshold = DEFAULT_LOW_CREDIT_THRESHOLD;

    const refresh = async () => {
      const [pendingRes, creditsRes] = await Promise.all([
        supabase
          .from("withdrawals")
          .select("id", { count: "exact", head: true })
          .eq("vendor_id", user.id)
          .eq("status", "pending"),
        supabase
          .from("vendor_lead_credits")
          .select("balance")
          .eq("vendor_id", user.id)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const pendingWithdrawals = pendingRes.count ?? 0;
      const balance = creditsRes.data?.balance ?? 0;
      const lowCredits = balance < threshold ? 1 : 0;
      setState({
        pendingWithdrawals,
        lowCredits,
        total: pendingWithdrawals + lowCredits,
      });
    };

    // Load admin-configured threshold from platform_settings; fall back to default.
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "low_credit_threshold")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const parsed = Number(data?.value);
        if (Number.isFinite(parsed) && parsed >= 0) threshold = parsed;
        refresh();
      });

    // Realtime: register handlers BEFORE subscribe (per project rules)
    const channel = supabase
      .channel(`provider-more-badge-${user.id}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "withdrawals",
          filter: `vendor_id=eq.${user.id}`,
        },
        () => refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vendor_lead_credits",
          filter: `vendor_id=eq.${user.id}`,
        },
        () => refresh()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return state;
}
