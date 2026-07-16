import { cn } from "@/lib/utils";
import { Clock, CheckCircle, Banknote, CreditCard } from "lucide-react";

interface Props {
  pending: number;
  approved: number;
  paid: number;
  pendingAmount: number;
}

export default function StatsRow({ pending, approved, paid, pendingAmount }: Props) {
  const stats = [
    { label: "Pending",        value: pending,                              icon: Clock,       accent: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Approved",       value: approved,                             icon: CheckCircle, accent: "text-blue-500",  bg: "bg-blue-500/10" },
    { label: "Paid",           value: paid,                                 icon: Banknote,    accent: "text-primary",   bg: "bg-primary/10" },
    { label: "Pending Amount", value: `$${pendingAmount.toFixed(2)}`,       icon: CreditCard,  accent: "text-rose-500",  bg: "bg-rose-500/10" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-card rounded-sm border border-border p-5 animate-reveal">
          <div className="flex items-center justify-between mb-3">
            <span className="text-fs-xs text-muted-foreground font-medium">{s.label}</span>
            <div className={cn("w-9 h-9 rounded-sm flex items-center justify-center", s.bg)}>
              <s.icon className={cn("w-4 h-4", s.accent)} />
            </div>
          </div>
          <p className="text-fs-2xl font-bold text-heading tabular-nums">{s.value}</p>
        </div>
      ))}
    </div>
  );
}
