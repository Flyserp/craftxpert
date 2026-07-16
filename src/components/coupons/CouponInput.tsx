import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Tag, X } from "lucide-react";

export interface AppliedCoupon {
  coupon_id: string;
  code: string;
  discount_amount: number;
  final_price: number;
  discount_type: string;
  discount_value: number;
}

interface Props {
  orderAmount: number;
  applicableTo: "booking" | "subscription" | "sponsorship" | "lead_credits";
  applied: AppliedCoupon | null;
  onChange: (coupon: AppliedCoupon | null) => void;
  disabled?: boolean;
}

export default function CouponInput({ orderAmount, applicableTo, applied, onChange, disabled }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const apply = async () => {
    const c = code.trim().toUpperCase();
    if (!c) { toast.error("Enter a coupon code"); return; }
    if (orderAmount <= 0) { toast.error("No amount to discount"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-coupon", {
        body: { code: c, order_amount: orderAmount, applicable_to: applicableTo },
      });
      if (error || !data?.valid) {
        toast.error(data?.error || "Invalid or expired coupon");
        return;
      }
      onChange({
        coupon_id: data.coupon_id,
        code: data.code,
        discount_amount: data.discount_amount,
        final_price: data.final_price,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
      });
      setCode("");
      toast.success(`Coupon ${data.code} applied`);
    } catch {
      toast.error("Failed to validate coupon");
    } finally {
      setLoading(false);
    }
  };

  const remove = () => onChange(null);

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-sm border border-primary/40 bg-primary/5 px-3 py-2">
        <div className="flex items-center gap-2 text-fs-sm">
          <Tag className="w-3.5 h-3.5 text-primary" />
          <span className="font-mono font-semibold">{applied.code}</span>
          <span className="text-muted-foreground">−${applied.discount_amount.toFixed(2)}</span>
        </div>
        <Button variant="ghost" size="sm" className="w-10 p-0" onClick={remove} disabled={disabled}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Coupon code"
        className="uppercase font-mono"
        disabled={disabled || loading}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }}
      />
      <Button type="button" variant="outline" onClick={apply} disabled={disabled || loading || !code.trim()} className="shrink-0">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
        <span className="ml-1.5">Apply</span>
      </Button>
    </div>
  );
}

export async function incrementCouponUsage(couponId: string) {
  const { data } = await supabase.from("promo_coupons").select("current_uses").eq("id", couponId).single();
  if (data) {
    await supabase.from("promo_coupons").update({ current_uses: (data.current_uses || 0) + 1 }).eq("id", couponId);
  }
}