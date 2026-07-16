import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Crown, Calendar, RefreshCw, AlertTriangle, Users, User, Clock } from "lucide-react";
import { useProviderSubscription, type SubscriptionPlan } from "@/hooks/useProviderSubscription";
import { LoadingState } from "@/components/ui/app/LoadingState";
import CouponInput, { AppliedCoupon, incrementCouponUsage } from "@/components/coupons/CouponInput";
import { Heading } from "@/components/ui/app";

const intervalLabel: Record<string, string> = {
  monthly: "/month",
  quarterly: "/quarter",
  yearly: "/year",
};

export default function ProviderSubscriptionPage() {
  const { plans, subscription, history, isActive, loading, subscribe, renew, cancel } = useProviderSubscription();
  const [busy, setBusy] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const maxPlanPrice = Math.max(0, ...plans.map((p) => Number(p.price) || 0));
  const currentPrice = Number(subscription?.plan?.price ?? 0);

  const grouped = useMemo(() => {
    const g: Record<string, SubscriptionPlan[]> = { individual: [], small_business: [] };
    for (const p of plans) (g[p.tier] ??= []).push(p);
    return g;
  }, [plans]);

  const daysUntil = subscription
    ? Math.ceil((new Date(subscription.current_period_end).getTime() - Date.now()) / 86_400_000)
    : null;
  const expiringSoon = isActive && daysUntil !== null && daysUntil <= 7;

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    setBusy(plan.id);
    try {
      await subscribe(plan.id);
      if (coupon) {
        await incrementCouponUsage(coupon.coupon_id);
        setCoupon(null);
      }
      toast.success(`Request submitted — ${plan.name} activates once payment is approved.`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to subscribe");
    } finally {
      setBusy(null);
    }
  };

  const handleRenew = async () => {
    setBusy("renew");
    try {
      await renew();
      toast.success("Renewal request submitted");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to renew");
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    try {
      await cancel();
      toast.success("Subscription will not renew");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to cancel");
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Subscription" subtitle="Choose the plan that fits your business.">
        <LoadingState />
      </DashboardLayout>
    );
  }

  const statusTone: Record<string, string> = {
    active: "bg-accent text-accent-foreground",
    expired: "bg-destructive/10 text-destructive",
    cancelled: "bg-muted text-muted-foreground",
    pending: "bg-muted text-muted-foreground",
  };

  return (
    <DashboardLayout title="Subscription" subtitle="Manage your plan, renewal and premium features.">
      <div className="space-y-6">
        {subscription && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  <CardTitle>Current Plan: {subscription.plan?.name ?? "—"}</CardTitle>
                </div>
                <Badge className={statusTone[subscription.status]}>{subscription.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Stat icon={<Calendar className="h-4 w-4" />} label="Started" value={new Date(subscription.started_at).toLocaleDateString()} />
              <Stat icon={<RefreshCw className="h-4 w-4" />} label={subscription.cancel_at_period_end ? "Ends on" : "Renews on"} value={new Date(subscription.current_period_end).toLocaleDateString()} />
              <Stat icon={<AlertTriangle className="h-4 w-4" />} label="Auto-renew" value={subscription.cancel_at_period_end ? "Off" : "On"} />
              {expiringSoon && (
                <div className="sm:col-span-3 flex items-center gap-2 rounded-sm border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                  <Clock className="h-4 w-4" />
                  Your plan {subscription.cancel_at_period_end ? "ends" : "renews"} in {daysUntil} day{daysUntil === 1 ? "" : "s"}.
                </div>
              )}
              {isActive && (
                <div className="sm:col-span-3 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleRenew} disabled={!!busy}>
                    {busy === "renew" ? "Processing…" : "Renew now"}
                  </Button>
                  {!subscription.cancel_at_period_end && (
                    <Button variant="ghost" onClick={handleCancel}>Cancel auto-renew</Button>
                  )}
                </div>
              )}
              {!isActive && (
                <div className="sm:col-span-3 rounded-sm border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  Your subscription is {subscription.status}. Premium features are restricted until an active plan is approved.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(["individual", "small_business"] as const).map((tier) => (
          <section key={tier} className="space-y-3">
            <div className="flex items-center gap-2">
              {tier === "individual" ? <User className="h-4 w-4 text-primary" /> : <Users className="h-4 w-4 text-primary" />}
              <Heading level={3} >
                {tier === "individual" ? "Individual" : "Small Business"}
              </Heading>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {(grouped[tier] ?? []).map((plan) => {
            const current = subscription?.plan_id === plan.id && isActive;
            const price = Number(plan.price) || 0;
            const isUpgrade = isActive && price > currentPrice && !current;
            const isDowngrade = isActive && price < currentPrice && !current;
            const discount = coupon
              ? coupon.discount_type === "percentage"
                ? Math.round((price * coupon.discount_value) / 100 * 100) / 100
                : Math.min(coupon.discount_value, price)
              : 0;
            const finalPrice = Math.max(0, price - discount);
            return (
              <Card key={plan.id} className={current ? "border-primary" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{plan.name}</CardTitle>
                    {current && <Badge>Current</Badge>}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    {coupon && discount > 0 ? (
                      <>
                        <span className="text-3xl font-semibold text-primary">${finalPrice.toFixed(0)}</span>
                        <span className="text-sm text-muted-foreground line-through">${price.toFixed(0)}</span>
                      </>
                    ) : (
                      <span className="text-3xl font-semibold">${price.toFixed(0)}</span>
                    )}
                    <span className="text-sm text-muted-foreground">{intervalLabel[plan.interval] ?? ""}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {(plan.features ?? []).map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    disabled={!!busy || current}
                    onClick={() => handleSubscribe(plan)}
                  >
                    {current
                      ? "Active"
                      : busy === plan.id
                      ? "Processing…"
                      : isUpgrade
                      ? "Upgrade"
                      : isDowngrade
                      ? "Downgrade"
                      : "Subscribe"}
                  </Button>
                </CardContent>
              </Card>
            );
              })}
            </div>
          </section>
        ))}

        {plans.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Have a coupon?</CardTitle></CardHeader>
            <CardContent>
              <CouponInput
                orderAmount={maxPlanPrice}
                applicableTo="subscription"
                applied={coupon}
                onChange={setCoupon}
                disabled={!!busy}
              />
            </CardContent>
          </Card>
        )}

        {history.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Subscription history</CardTitle></CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {history.map((h) => (
                  <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <div>
                      <div className="font-medium text-heading">{h.plan?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(h.started_at).toLocaleDateString()} → {new Date(h.current_period_end).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums text-muted-foreground">
                        ${Number(h.plan?.price ?? 0).toFixed(0)}
                      </span>
                      <Badge className={statusTone[h.status]}>{h.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-sm border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
