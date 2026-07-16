import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import CouponInput, { AppliedCoupon, incrementCouponUsage } from "@/components/coupons/CouponInput";

interface Props {
  open: boolean;
  serviceId: string | null;
  serviceTitle?: string;
  currentSponsoredUntil?: string | null;
  onClose: () => void;
  onDone: () => void;
}

export default function SponsorServiceDialog({ open, serviceId, serviceTitle, currentSponsoredUntil, onClose, onDone }: Props) {
  const [durations, setDurations] = useState<number[]>([7, 14, 30, 60, 90]);
  const [pricePerDay, setPricePerDay] = useState<number>(0.65);
  const [selected, setSelected] = useState<number>(30);
  const [saving, setSaving] = useState(false);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", ["sponsorship_price_per_day", "sponsorship_durations"]);
      const map = Object.fromEntries((data || []).map((r: any) => [r.key, r.value]));
      const price = parseFloat(map.sponsorship_price_per_day);
      if (!Number.isNaN(price) && price > 0) setPricePerDay(price);
      const list = String(map.sponsorship_durations || "")
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (list.length) {
        setDurations(list);
        setSelected(list.includes(30) ? 30 : list[0]);
      }
    })();
  }, [open]);

  const subtotal = pricePerDay * selected;
  const discount = coupon?.discount_amount ?? 0;
  const total = Math.max(0, subtotal - discount).toFixed(2);
  const isRenewal = currentSponsoredUntil && new Date(currentSponsoredUntil) > new Date();

  const handleConfirm = async () => {
    if (!serviceId) return;
    setSaving(true);
    const { error } = await supabase.rpc("sponsor_vendor_service", { _service_id: serviceId, _days: selected });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Failed to activate sponsorship");
      return;
    }
    if (coupon) await incrementCouponUsage(coupon.coupon_id);
    toast.success(`Sponsored for ${selected} days!`);
    onDone();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {isRenewal ? "Renew sponsorship" : "Sponsor service"}
          </DialogTitle>
          <DialogDescription>
            {serviceTitle ? <span className="font-medium text-heading">{serviceTitle}</span> : null}
            <span className="block mt-1">
              Sponsored services appear above other listings in search and category pages.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div>
          <p className="text-fs-xs font-medium text-heading mb-2">Duration</p>
          <div className="grid grid-cols-3 gap-2">
            {durations.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelected(d)}
                className={`rounded-md border px-3 py-2 text-fs-sm transition ${
                  selected === d
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <CouponInput
            orderAmount={subtotal}
            applicableTo="sponsorship"
            applied={coupon}
            onChange={setCoupon}
            disabled={saving}
          />
          <div className="rounded-md bg-muted/40 p-3 text-fs-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{selected} days × ${pricePerDay.toFixed(2)}/day</span>
              <span className="tabular-nums">${subtotal.toFixed(2)}</span>
            </div>
            {coupon && (
              <div className="flex items-center justify-between text-primary">
                <span>Coupon {coupon.code}</span>
                <span className="tabular-nums">−${discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-border/60">
              <span className="font-medium text-heading">Total</span>
              <span className="font-semibold text-heading tabular-nums">${total}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={saving} className="gap-1.5">
            <Sparkles className="w-4 h-4" />
            {saving ? "Processing…" : isRenewal ? "Renew" : "Activate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}