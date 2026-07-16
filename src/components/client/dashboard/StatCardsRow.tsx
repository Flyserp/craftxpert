import { ShoppingBag, CreditCard, Wallet, PiggyBank, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  totalOrders: number;
  totalSpend: number;
  walletBalance: number;
  totalSavings: number;
  ordersDelta?: number;   // percent
  spendDelta?: number;
  walletDelta?: number;
  savingsDelta?: number;
}

const cards = [
  { key: "orders", label: "Total Orders", icon: ShoppingBag, accent: "text-blue-500", bg: "bg-blue-500/10" },
  { key: "spend", label: "Total Spend", icon: CreditCard, accent: "text-violet-500", bg: "bg-violet-500/10" },
  { key: "wallet", label: "Wallet", icon: Wallet, accent: "text-emerald-500", bg: "bg-emerald-500/10" },
  { key: "savings", label: "Total Savings", icon: PiggyBank, accent: "text-amber-500", bg: "bg-amber-500/10" },
] as const;

export default function StatCardsRow({
  totalOrders, totalSpend, walletBalance, totalSavings,
  ordersDelta = 0, spendDelta = 0, walletDelta = 0, savingsDelta = 0,
}: Props) {
  const values: Record<string, { value: string; delta: number }> = {
    orders:  { value: String(totalOrders), delta: ordersDelta },
    spend:   { value: `$ ${totalSpend.toFixed(0)}`, delta: spendDelta },
    wallet:  { value: `$ ${walletBalance.toFixed(0)}`, delta: walletDelta },
    savings: { value: `$ ${totalSavings.toFixed(0)}`, delta: savingsDelta },
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c, i) => {
        const v = values[c.key];
        const positive = v.delta >= 0;
        return (
          <div
            key={c.key}
            className="bg-card border border-border rounded-sm p-5 animate-reveal transition-colors"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={cn("w-10 h-10 rounded-sm flex items-center justify-center", c.bg)}>
                <c.icon className={cn("w-5 h-5", c.accent)} />
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-[13px] font-semibold rounded-full px-1.5 py-0.5",
                  positive
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-destructive/10 text-destructive",
                )}
              >
                {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(v.delta)}%
              </span>
            </div>
            <p className="text-meta">{c.label}</p>
            <p className="text-stat mt-0.5">{v.value}</p>
          </div>
        );
      })}
    </div>
  );
}
