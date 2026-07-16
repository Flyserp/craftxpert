import { format } from "date-fns";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Wallet, Receipt, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Heading } from "@/components/ui/app";

export interface UnifiedTx {
  id: string;
  kind: "booking" | "refund" | "topup" | "withdrawal" | "wallet";
  label: string;       // "Service Booking", "Service Refund", "Wallet Topup", …
  amount: number;      // signed
  created_at: string;
}

interface Props {
  transactions: UnifiedTx[];
  loading?: boolean;
}

const META: Record<UnifiedTx["kind"], { icon: typeof Wallet; tint: string; bg: string }> = {
  booking:    { icon: Receipt,        tint: "text-blue-500",     bg: "bg-blue-500/10" },
  refund:     { icon: Undo2,          tint: "text-emerald-500",  bg: "bg-emerald-500/10" },
  topup:      { icon: ArrowDownLeft,  tint: "text-violet-500",   bg: "bg-violet-500/10" },
  withdrawal: { icon: ArrowUpRight,   tint: "text-amber-500",    bg: "bg-amber-500/10" },
  wallet:     { icon: Wallet,         tint: "text-primary",      bg: "bg-primary/10" },
};

export default function RecentTransactions({ transactions, loading }: Props) {
  return (
    <section className="bg-card border border-border rounded-sm p-5 animate-reveal">
      <header className="flex items-center justify-between mb-4">
        <Heading level={3} >Recent Transaction</Heading>
        <Link to="/payment-history" className="text-fs-xs font-medium text-primary hover:underline">View all</Link>
      </header>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-sm bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <p className="text-fs-xs text-muted-foreground py-6 text-center">No transactions yet.</p>
      ) : (
        <ul className="divide-y divide-border/40 -mx-1">
          {transactions.slice(0, 6).map((t) => {
            const m = META[t.kind];
            const positive = t.amount >= 0;
            return (
              <li key={t.id} className="flex items-center gap-3 px-1 py-2.5">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", m.bg)}>
                  <m.icon className={cn("w-4 h-4", m.tint)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-fs-sm font-medium text-heading truncate">{t.label}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {format(new Date(t.created_at), "dd MMM yyyy  HH:mm")}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-fs-sm font-semibold tabular-nums whitespace-nowrap",
                    positive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                  )}
                >
                  {positive ? "+" : "-"}${Math.abs(t.amount).toFixed(2)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
