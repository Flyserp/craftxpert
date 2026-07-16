import { Target, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Heading } from "@/components/ui/app";

interface Props {
  totalRequests: number;
  completedCount: number;
  acceptedCount: number;
  cancelledCount: number;
}

const BookingConversionWidget = ({ totalRequests, completedCount, acceptedCount, cancelledCount }: Props) => {
  const conversionRate = totalRequests > 0 ? Math.round((completedCount / totalRequests) * 100) : 0;
  const acceptanceRate = totalRequests > 0 ? Math.round((acceptedCount / totalRequests) * 100) : 0;
  const cancellationRate = totalRequests > 0 ? Math.round((cancelledCount / totalRequests) * 100) : 0;

  const metrics = [
    { label: "Conversion", value: `${conversionRate}%`, desc: `${completedCount} of ${totalRequests} completed`, color: "text-primary", good: conversionRate >= 50 },
    { label: "Acceptance", value: `${acceptanceRate}%`, desc: `${acceptedCount} accepted`, color: "text-blue-500", good: acceptanceRate >= 60 },
    { label: "Cancellation", value: `${cancellationRate}%`, desc: `${cancelledCount} cancelled`, color: "text-destructive", good: cancellationRate <= 15 },
  ];

  return (
    <section className="bg-card rounded-sm border border-border p-5 animate-reveal-delay-2">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-amber-500" />
        <Heading level={3} >Booking Conversion</Heading>
      </div>

      {/* Circular progress */}
      <div className="flex justify-center mb-4">
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke="hsl(var(--primary))" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${conversionRate * 2.64} ${264 - conversionRate * 2.64}`}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-fs-xl font-bold text-heading tabular-nums">{conversionRate}%</span>
            <span className="text-[10px] text-muted-foreground">conversion</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-center justify-between">
            <div>
              <p className="text-fs-xs font-medium text-heading">{m.label}</p>
              <p className="text-[10px] text-muted-foreground">{m.desc}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={cn("text-fs-sm font-bold tabular-nums", m.color)}>{m.value}</span>
              {m.good ? (
                <TrendingUp className="w-3 h-3 text-primary" />
              ) : (
                <TrendingDown className="w-3 h-3 text-destructive" />
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default BookingConversionWidget;
