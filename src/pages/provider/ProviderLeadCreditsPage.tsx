import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Coins, Package, Wallet, CreditCard, Loader2, CheckCircle2,
  History, Sparkles, Zap, TrendingUp,
} from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { Heading, LoadingState } from "@/components/ui/app";

interface Bundle {
  key: string;
  label: string;
  credits: number;
  price: number;
  perCredit: number;
  savings: number;
  popular?: boolean;
}

interface Purchase {
  id: string;
  bundle_label: string;
  credits: number;
  amount: number;
  payment_method: string;
  created_at: string;
}

export default function ProviderLeadCreditsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const purchasePg = usePagination(purchases, 10);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<"wallet" | "stripe">("wallet");

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  const fetchAll = async () => {
    if (!user) return;

    const [creditsRes, walletRes, settingsRes, purchasesRes] = await Promise.all([
      supabase.from("vendor_lead_credits").select("balance").eq("vendor_id", user.id).single(),
      supabase.from("wallets").select("balance").eq("user_id", user.id).single(),
      supabase.from("platform_settings").select("key, value").in("key", [
        "lead_credit_price", "lead_credit_bundle_5", "lead_credit_bundle_10", "lead_credit_bundle_25",
      ]),
      supabase.from("lead_credit_purchases").select("*").eq("vendor_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);

    setBalance(creditsRes.data?.balance || 0);
    setWalletBalance(walletRes.data?.balance || 0);
    setPurchases((purchasesRes.data as Purchase[]) || []);

    // Build bundles from admin pricing
    const s: Record<string, number> = {};
    (settingsRes.data || []).forEach((r: any) => { s[r.key] = parseFloat(r.value) || 0; });

    const basePrice = s.lead_credit_price || 2;
    const bundleData: Bundle[] = [
      { key: "1", label: "1 Credit", credits: 1, price: basePrice, perCredit: basePrice, savings: 0 },
      { key: "5", label: "5 Credits", credits: 5, price: s.lead_credit_bundle_5 || basePrice * 5 * 0.9, perCredit: 0, savings: 0 },
      { key: "10", label: "10 Credits", credits: 10, price: s.lead_credit_bundle_10 || basePrice * 10 * 0.8, perCredit: 0, savings: 0, popular: true },
      { key: "25", label: "25 Credits", credits: 25, price: s.lead_credit_bundle_25 || basePrice * 25 * 0.7, perCredit: 0, savings: 0 },
    ];

    bundleData.forEach((b) => {
      b.perCredit = Math.round((b.price / b.credits) * 100) / 100;
      b.savings = Math.round((1 - b.perCredit / basePrice) * 100);
    });

    setBundles(bundleData);
    setLoading(false);
  };

  const handlePurchase = async (bundle: Bundle) => {
    if (!user) return;

    if (payMethod === "wallet" && walletBalance < bundle.price) {
      toast.error(`Insufficient wallet balance. Need $${bundle.price.toFixed(2)} but have $${walletBalance.toFixed(2)}`);
      return;
    }

    setPurchasing(bundle.key);

    try {
      // 1. Record the purchase
      const { error: purchaseErr } = await supabase.from("lead_credit_purchases").insert({
        vendor_id: user.id,
        bundle_label: bundle.label,
        credits: bundle.credits,
        amount: bundle.price,
        payment_method: payMethod,
      });
      if (purchaseErr) throw purchaseErr;

      // 2. Upsert credit balance
      const { data: existing } = await supabase
        .from("vendor_lead_credits")
        .select("balance")
        .eq("vendor_id", user.id)
        .single();

      if (existing) {
        await supabase
          .from("vendor_lead_credits")
          .update({ balance: existing.balance + bundle.credits })
          .eq("vendor_id", user.id);
      } else {
        await supabase
          .from("vendor_lead_credits")
          .insert({ vendor_id: user.id, balance: bundle.credits });
      }

      // 3. Deduct from wallet if wallet payment
      if (payMethod === "wallet") {
        await supabase
          .from("wallets")
          .update({ balance: walletBalance - bundle.price })
          .eq("user_id", user.id);

        await supabase.from("wallet_transactions").insert({
          user_id: user.id,
          wallet_id: (await supabase.from("wallets").select("id").eq("user_id", user.id).single()).data?.id || "",
          amount: -bundle.price,
          type: "purchase",
          description: `Lead credits: ${bundle.label}`,
        });
      }

      toast.success(`${bundle.credits} lead credit${bundle.credits > 1 ? "s" : ""} purchased!`);
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Purchase failed");
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Lead Credits">
        <LoadingState variant="section" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Lead Credits" subtitle="Purchase credits to unlock customer leads and grow your business.">
      <div className="max-w-3xl space-y-6">
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-sm border border-primary/20 p-6 animate-reveal">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-fs-xs text-muted-foreground mb-1">Your Credit Balance</p>
              <div className="flex items-baseline gap-2">
                <span className="text-fs-4xl font-bold text-heading tabular-nums">{balance}</span>
                <span className="text-fs-sm text-muted-foreground">credits</span>
              </div>
              <p className="text-fs-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Wallet className="w-3 h-3" /> Wallet: ${walletBalance.toFixed(2)}
              </p>
            </div>
            <div className="w-14 h-14 rounded-sm bg-primary/10 flex items-center justify-center">
              <Coins className="w-7 h-7 text-primary" />
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-card rounded-sm border border-border p-5 animate-reveal" style={{ animationDelay: "40ms" }}>
          <p className="text-fs-xs font-medium text-heading mb-3">Payment Method</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPayMethod("wallet")}
              className={cn(
                "flex items-center gap-3 p-3.5 rounded-sm border-2 text-left transition-all",
                payMethod === "wallet" ? "border-primary bg-primary/5" : "border-border/60 hover:border-border"
              )}
            >
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", payMethod === "wallet" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <p className="text-fs-xs font-medium text-heading">Wallet</p>
                <p className="text-[10px] text-muted-foreground">${walletBalance.toFixed(2)} available</p>
              </div>
            </button>
            <button
              onClick={() => setPayMethod("stripe")}
              className={cn(
                "flex items-center gap-3 p-3.5 rounded-sm border-2 text-left transition-all",
                payMethod === "stripe" ? "border-primary bg-primary/5" : "border-border/60 hover:border-border"
              )}
            >
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", payMethod === "stripe" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <p className="text-fs-xs font-medium text-heading">Credit Card</p>
                <p className="text-[10px] text-muted-foreground">Via Stripe</p>
              </div>
            </button>
          </div>
        </div>

        {/* Bundles */}
        <div className="animate-reveal" style={{ animationDelay: "80ms" }}>
          <Heading level={3}  className="mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Choose a Bundle
          </Heading>
          <div className="grid sm:grid-cols-2 gap-3">
            {bundles.map((b) => (
              <div
                key={b.key}
                className={cn(
                  "relative bg-card rounded-sm border p-5 transition-all",
                  b.popular ? "border-primary/40 ring-1 ring-primary/10" : "border-border/60"
                )}
              >
                {b.popular && (
                  <Badge className="absolute -top-2.5 right-4 bg-primary text-primary-foreground text-[9px] px-2 py-0.5">
                    Most Popular
                  </Badge>
                )}
                <div className="flex items-center gap-2 mb-3">
                  {b.credits === 1 ? (
                    <Coins className="w-5 h-5 text-primary" />
                  ) : b.credits <= 10 ? (
                    <Package className="w-5 h-5 text-primary" />
                  ) : (
                    <Zap className="w-5 h-5 text-primary" />
                  )}
                  <span className="text-fs-sm font-semibold text-heading">{b.label}</span>
                </div>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-fs-2xl font-bold text-heading tabular-nums">${b.price.toFixed(2)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-4">
                  ${b.perCredit.toFixed(2)}/credit
                  {b.savings > 0 && (
                    <span className="ml-1.5 text-primary font-semibold">Save {b.savings}%</span>
                  )}
                </p>

                <Button
                  onClick={() => handlePurchase(b)}
                  disabled={purchasing !== null}
                  size="sm"
                  className={cn("w-full gap-1.5", b.popular && "bg-primary")}
                  variant={b.popular ? "default" : "outline"}
                >
                  {purchasing === b.key ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  {purchasing === b.key ? "Processing…" : "Buy Now"}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Purchase History */}
        {purchases.length > 0 && (
          <div className="bg-card rounded-sm border border-border p-5 animate-reveal" style={{ animationDelay: "120ms" }}>
            <Heading level={3}  className="flex items-center gap-2 mb-4">
              <History className="w-4 h-4 text-primary" /> Purchase History
            </Heading>
            <div className="space-y-2">
              {purchasePg.pageItems.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-fs-xs font-medium text-heading">{p.bundle_label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(p.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-fs-xs font-semibold text-heading tabular-nums">+{p.credits} credits</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">${p.amount.toFixed(2)} · {p.payment_method}</p>
                  </div>
                </div>
              ))}
            </div>
            <NumberedPagination
              currentPage={purchasePg.page}
              totalPages={purchasePg.totalPages}
              totalItems={purchasePg.totalItems}
              onPageChange={purchasePg.setPage}
              pageSize={purchasePg.pageSize}
          onPageSizeChange={purchasePg.setPageSize}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
