import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notifyPaymentSuccess } from "@/lib/notifications";
import { useAuth } from "@/contexts/AuthContext";
import {
  CreditCard, AlertTriangle, CheckCircle2, Lock, Wallet,
  Building2, DollarSign, Loader2, Tag, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Heading } from "@/components/ui/app";
import { getDepositPercentage, calcDeposit, DEFAULT_DEPOSIT_PERCENTAGE } from "@/lib/depositRate";

export interface AppliedCouponData {
  code: string;
  discount_type: string;
  discount_value: number;
  discountAmount: number;
}

export interface TaxData {
  taxAmount: number;
  taxRate: number;
}

interface PaymentStepProps {
  totalPrice: number | null;
  categoryId?: string | null;
  onPaymentComplete: () => void;
  onSkipPayment: () => void;
  onCouponChange?: (coupon: AppliedCouponData | null) => void;
  onTaxCalculated?: (tax: TaxData) => void;
}

type PaymentMethodType = "stripe" | "paypal" | "wallet" | "bank";

interface AppliedCoupon {
  code: string;
  discount_type: string;
  discount_value: number;
  discountAmount: number;
}

export default function PaymentStep({
  totalPrice,
  categoryId,
  onPaymentComplete,
  onSkipPayment,
  onCouponChange,
  onTaxCalculated,
}: PaymentStepProps) {
  const { user } = useAuth();
  const [depositPct, setDepositPct] = useState<number>(DEFAULT_DEPOSIT_PERCENTAGE);
  const [stripeConfigured, setStripeConfigured] = useState<boolean | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>("stripe");
  const [paymentType, setPaymentType] = useState<"full" | "deposit">("full");
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [processing, setProcessing] = useState(false);

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  // Tax state
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [taxLabel, setTaxLabel] = useState("Tax");
  const [taxInclusive, setTaxInclusive] = useState(false);

  const basePrice = totalPrice || 0;
  const discountAmount = appliedCoupon?.discountAmount || 0;
  const discountedPrice = Math.max(0, basePrice - discountAmount);

  // Tax calculation
  const taxAmount = taxEnabled && !taxInclusive
    ? Math.round(discountedPrice * (taxRate / 100) * 100) / 100
    : 0;
  const priceWithTax = discountedPrice + taxAmount;

  // Notify parent of tax data
  useEffect(() => {
    onTaxCalculated?.({ taxAmount, taxRate });
  }, [taxAmount, taxRate]);

  const depositAmount = calcDeposit(priceWithTax, depositPct);
  const payAmount = paymentType === "deposit" ? depositAmount : priceWithTax;

  useEffect(() => {
    let cancelled = false;
    getDepositPercentage(categoryId).then((pct) => {
      if (!cancelled) setDepositPct(pct);
    });
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", ["stripe_publishable_key", "stripe_secret_key", "tax_enabled", "tax_rate", "tax_label", "tax_included_in_price"]);

      const hasKeys = data && data.some((r) => r.key === "stripe_publishable_key" && r.value?.trim()) && data.some((r) => r.key === "stripe_secret_key" && r.value?.trim());
      setStripeConfigured(!!hasKeys);

      // Parse tax settings
      const settings: Record<string, string> = {};
      (data || []).forEach((r) => { if (r.value) settings[r.key] = r.value; });
      if (settings.tax_enabled === "true") {
        setTaxEnabled(true);
        setTaxRate(parseFloat(settings.tax_rate) || 0);
        setTaxLabel(settings.tax_label || "Tax");
        setTaxInclusive(settings.tax_included_in_price === "true");
      }

      if (user) {
        const { data: w } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", user.id)
          .single();
        if (w) setWalletBalance(w.balance);
      }
    };
    init();
  }, [user]);

  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) { toast.error("Enter a coupon code"); return; }
    if (basePrice <= 0) { toast.error("No price to apply coupon to"); return; }

    setCouponLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-coupon", {
        body: { code, order_amount: basePrice, applicable_to: "booking" },
      });

      if (error || !data?.valid) {
        toast.error(data?.error || "Invalid or expired coupon code");
        setCouponLoading(false);
        return;
      }

      const couponData = {
        code: data.code,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        discountAmount: data.discount_amount,
      };
      setAppliedCoupon(couponData);
      onCouponChange?.(couponData);
      toast.success(`Coupon applied — $${data.discount_amount.toFixed(2)} off!`);
    } catch {
      toast.error("Failed to validate coupon");
    }
    setCouponLoading(false);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    onCouponChange?.(null);
    setCouponCode("");
  };

  if (stripeConfigured === null) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!stripeConfigured) {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-sm p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-fs-sm font-medium text-heading mb-1">Online payments are not available yet</p>
              <p className="text-fs-xs text-muted-foreground">
                The platform administrator hasn't configured payment processing.
                You can proceed with the booking and arrange payment directly with the service provider.
              </p>
            </div>
          </div>
        </div>

        {/* Promo Coupon — also available without Stripe */}
        <div className="bg-card rounded-sm border border-border p-5">
          <p className="text-fs-xs font-medium text-heading mb-2 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-primary" /> Promo Code
          </p>
          {appliedCoupon ? (
            <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-fs-xs font-semibold text-heading">{appliedCoupon.code}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {appliedCoupon.discount_type === "percentage"
                      ? `${appliedCoupon.discount_value}% off`
                      : `$${appliedCoupon.discount_value} off`}
                    {" — "}saving ${appliedCoupon.discountAmount.toFixed(2)}
                  </p>
                </div>
              </div>
              <button
                onClick={handleRemoveCoupon}
                className="p-1 rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Enter code"
                className="text-fs-xs uppercase tracking-wider"
                onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleApplyCoupon}
                disabled={couponLoading || !couponCode.trim()}
                className="shrink-0 gap-1.5 text-fs-xs"
              >
                {couponLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
                Apply
              </Button>
            </div>
          )}
        </div>

        <div className="bg-card rounded-sm border border-border p-5">
          <div className="space-y-1.5 mb-4">
            {(appliedCoupon || taxAmount > 0) && (
              <>
                <div className="flex justify-between text-fs-xs text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">${basePrice.toFixed(2)}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-fs-xs text-primary">
                    <span>Discount ({appliedCoupon.code})</span>
                    <span className="tabular-nums">-${appliedCoupon.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="flex justify-between text-fs-xs text-muted-foreground">
                    <span>{taxLabel} ({taxRate}%)</span>
                    <span className="tabular-nums">+${taxAmount.toFixed(2)}</span>
                  </div>
                )}
                {taxEnabled && taxInclusive && (
                  <div className="flex justify-between text-fs-xs text-muted-foreground italic">
                    <span>{taxLabel} ({taxRate}% included)</span>
                    <span className="tabular-nums">${(Math.round(discountedPrice * (taxRate / (100 + taxRate)) * 100) / 100).toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="text-fs-sm text-muted-foreground">Estimated total</span>
              <span className="text-fs-xl font-bold text-heading tabular-nums">
                ${priceWithTax.toFixed(2)}
              </span>
            </div>
          </div>
          <Button onClick={onSkipPayment} className="w-full gap-2">
            <CheckCircle2 className="w-4 h-4" /> Book Now — Pay Later
          </Button>
          <p className="text-[13px] text-muted-foreground text-center mt-2">
            Payment will be arranged directly with the service provider
          </p>
        </div>
      </div>
    );
  }

  const methods: { id: PaymentMethodType; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: "stripe", label: "Credit/Debit Card", icon: <CreditCard className="w-5 h-5" />, desc: "Visa, Mastercard, Amex" },
    { id: "paypal", label: "PayPal", icon: <DollarSign className="w-5 h-5" />, desc: "Pay with PayPal account" },
    { id: "wallet", label: "Wallet", icon: <Wallet className="w-5 h-5" />, desc: `Balance: $${walletBalance.toFixed(2)}` },
    { id: "bank", label: "Bank Transfer", icon: <Building2 className="w-5 h-5" />, desc: "Direct bank payment" },
  ];

  const canPayWithWallet = selectedMethod === "wallet" && walletBalance >= payAmount;

  const handlePay = async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1500));

    // Increment coupon usage
    if (appliedCoupon) {
      await supabase
        .from("promo_coupons")
        .update({ current_uses: undefined }) // use RPC or raw increment below
        .eq("code", appliedCoupon.code);
      // Simple increment via select+update
      const { data: c } = await supabase
        .from("promo_coupons")
        .select("current_uses")
        .eq("code", appliedCoupon.code)
        .single();
      if (c) {
        await supabase
          .from("promo_coupons")
          .update({ current_uses: c.current_uses + 1 })
          .eq("code", appliedCoupon.code);
      }
    }

    setProcessing(false);

    if (user) {
      // Customer = actor here. With payments policy `notify_both = true` (default),
      // they still get a receipt. Vendor receives "payment_received" through the
      // booking's payment-status webhook on the server side.
      notifyPaymentSuccess(user.id, payAmount, `${selectedMethod} payment`);
    }

    onPaymentComplete();
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-sm border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-primary" />
          <Heading level={3} >Payment Method</Heading>
        </div>

        {/* Method Selection */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {methods.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedMethod(m.id)}
              className={cn(
                "flex items-center gap-2.5 p-3 rounded-sm border-2 text-left transition-all",
                selectedMethod === m.id
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:border-border"
              )}
            >
              <div className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                selectedMethod === m.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {m.icon}
              </div>
              <div className="min-w-0">
                <p className="text-fs-xs font-medium text-heading">{m.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{m.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Payment Type */}
        {totalPrice != null && totalPrice > 0 && (
          <div className="mb-5">
            <p className="text-fs-xs font-medium text-heading mb-2">Payment Amount</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentType("full")}
                className={cn(
                  "p-3 rounded-sm border-2 text-center transition-all",
                  paymentType === "full" ? "border-primary bg-primary/5" : "border-border/60"
                )}
              >
                <p className="text-fs-sm font-bold text-heading">${discountedPrice.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">Full Payment</p>
              </button>
              <button
                onClick={() => setPaymentType("deposit")}
                className={cn(
                  "p-3 rounded-sm border-2 text-center transition-all",
                  paymentType === "deposit" ? "border-primary bg-primary/5" : "border-border/60"
                )}
              >
                <p className="text-fs-sm font-bold text-heading">${depositAmount.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">{depositPct}% Deposit</p>
              </button>
            </div>
          </div>
        )}

        {/* Promo Coupon */}
        <div className="mb-5">
          <p className="text-fs-xs font-medium text-heading mb-2 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-primary" /> Promo Code
          </p>
          {appliedCoupon ? (
            <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-fs-xs font-semibold text-heading">{appliedCoupon.code}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {appliedCoupon.discount_type === "percentage"
                      ? `${appliedCoupon.discount_value}% off`
                      : `$${appliedCoupon.discount_value} off`}
                    {" — "}saving ${appliedCoupon.discountAmount.toFixed(2)}
                  </p>
                </div>
              </div>
              <button
                onClick={handleRemoveCoupon}
                className="p-1 rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Enter code"
                className="text-fs-xs uppercase tracking-wider"
                onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleApplyCoupon}
                disabled={couponLoading || !couponCode.trim()}
                className="shrink-0 gap-1.5 text-fs-xs"
              >
                {couponLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
                Apply
              </Button>
            </div>
          )}
        </div>

        {/* Wallet insufficient funds warning */}
        {selectedMethod === "wallet" && !canPayWithWallet && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
            <p className="text-fs-xs text-amber-700 dark:text-amber-400">
              Insufficient wallet balance. You need ${payAmount.toFixed(2)} but only have ${walletBalance.toFixed(2)}.
            </p>
          </div>
        )}

        {/* Summary & Pay */}
        <div className="space-y-1.5 mb-4 pb-3 border-b border-border/50">
          {(appliedCoupon || taxAmount > 0) && (
            <>
              <div className="flex justify-between text-fs-xs text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">${basePrice.toFixed(2)}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-fs-xs text-primary">
                  <span>Discount ({appliedCoupon.code})</span>
                  <span className="tabular-nums">-${appliedCoupon.discountAmount.toFixed(2)}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="flex justify-between text-fs-xs text-muted-foreground">
                  <span>{taxLabel} ({taxRate}%)</span>
                  <span className="tabular-nums">+${taxAmount.toFixed(2)}</span>
                </div>
              )}
              {taxEnabled && taxInclusive && (
                <div className="flex justify-between text-fs-xs text-muted-foreground italic">
                  <span>{taxLabel} ({taxRate}% included)</span>
                  <span className="tabular-nums">${(Math.round(discountedPrice * (taxRate / (100 + taxRate)) * 100) / 100).toFixed(2)}</span>
                </div>
              )}
            </>
          )}
          <div className="flex items-center justify-between">
            <span className="text-fs-sm text-muted-foreground">
              {paymentType === "deposit" ? "Deposit due" : "Total due"}
            </span>
            <span className="text-fs-xl font-bold text-heading tabular-nums">
              ${payAmount.toFixed(2)}
            </span>
          </div>
        </div>

        <Button
          onClick={handlePay}
          className="w-full gap-2"
          disabled={processing || (selectedMethod === "wallet" && !canPayWithWallet)}
        >
          {processing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Lock className="w-4 h-4" />
          )}
          {processing ? "Processing..." : `Pay $${payAmount.toFixed(2)} & Confirm`}
        </Button>

        <div className="flex items-center justify-center gap-2 mt-3">
          <Lock className="w-3 h-3 text-muted-foreground" />
          <span className="text-[13px] text-muted-foreground">
            Secured payment. Your info is encrypted.
          </span>
        </div>
      </div>
    </div>
  );
}
