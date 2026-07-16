import { DollarSign, Clock, CalendarCheck, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  totalNet: number;
  pendingCount: number;
  activeCount: number;
  avgRating: string;
}

const ProviderStatsCards = ({ totalNet, pendingCount, activeCount, avgRating }: Props) => {
  const stats = [
    { icon: DollarSign, label: "Net Earnings", value: `$${totalNet.toFixed(0)}`, accent: "text-emerald-500", accentBg: "bg-emerald-500/10" },
    { icon: Clock, label: "Pending Requests", value: pendingCount, accent: "text-amber-500", accentBg: "bg-amber-500/10" },
    { icon: CalendarCheck, label: "Active Jobs", value: activeCount, accent: "text-blue-500", accentBg: "bg-blue-500/10" },
    { icon: Star, label: "Avg Rating", value: avgRating, accent: "text-amber-400", accentBg: "bg-amber-400/10" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className="bg-card rounded-sm border border-border p-5 animate-reveal transition-colors"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-meta">{s.label}</span>
            <div className={cn("w-9 h-9 rounded-sm flex items-center justify-center", s.accentBg)}>
              <s.icon className={cn("w-4.5 h-4.5", s.accent)} />
            </div>
          </div>
          <p className="text-stat">{s.value}</p>
        </div>
      ))}
    </div>
  );
};

export default ProviderStatsCards;
