import { useEffect, useState } from "react";
import { Percent, Wallet } from "lucide-react";
import { calcCommission, getCommissionRate } from "@/lib/commission";

interface Props {
  total: number;
  /** "provider" shows payout-focused copy, "client" shows fee-transparency copy. */
  audience: "provider" | "client";
  /** Optional explicit rate. When omitted, fetched from platform_settings. */
  rate?: number;
}

/**
 * Per-booking commission breakdown card. Calculates platform commission
 * automatically from the booking total using the global commission rate.
 */
export default function CommissionBreakdown({ total, audience, rate: rateProp }: Props) {
  const [rate, setRate] = useState<number | null>(rateProp ?? null);

  useEffect(() => {
    if (rateProp != null) { setRate(rateProp); return; }
    let alive = true;
    getCommissionRate().then((r) => { if (alive) setRate(r); });
    return () => { alive = false; };
  }, [rateProp]);

  if (rate === null) return null;
  const safeTotal = Math.max(0, total);
  const commission = calcCommission(safeTotal, rate);
  const payout = safeTotal - commission;

  const isProvider = audience === "provider";

  return (
    <div className="bg-card border border-border rounded-sm p-5">
      <p className="text-fs-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
        <Percent className="w-3 h-3" /> {isProvider ? "Commission & payout" : "Platform fee breakdown"}
      </p>
      <dl className="text-fs-xs space-y-1.5">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Booking total</dt>
          <dd className="tabular-nums text-heading">${safeTotal.toFixed(2)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">
            Commission rate
          </dt>
          <dd className="tabular-nums">{rate}%</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Platform commission</dt>
          <dd className="tabular-nums text-destructive">-${commission.toFixed(2)}</dd>
        </div>
        <div className="flex justify-between pt-1.5 border-t border-border/40 text-fs-sm">
          <dt className="font-semibold text-heading flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5" />
            {isProvider ? "Your payout" : "Provider receives"}
          </dt>
          <dd className="tabular-nums font-semibold text-primary">${payout.toFixed(2)}</dd>
        </div>
      </dl>
      <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
        {isProvider
          ? "Calculated automatically when this booking is paid. Payouts settle to your wallet."
          : "Your provider receives the payout after the platform commission is deducted."}
      </p>
    </div>
  );
}
