import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { AppCard } from "../AppCard";
import { cn } from "@/lib/utils";

export interface AnalyticsCardProps {
  label: string;
  value: React.ReactNode;
  delta?: number;
  deltaLabel?: string;
  icon?: React.ReactNode;
  hint?: string;
  className?: string;
  footer?: React.ReactNode;
}

export function AnalyticsCard({
  label,
  value,
  delta,
  deltaLabel,
  icon,
  hint,
  className,
  footer,
}: AnalyticsCardProps) {
  const trend = delta == null ? "flat" : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up" ? "text-emerald-600" : trend === "down" ? "text-destructive" : "text-muted-foreground";

  return (
    <AppCard className={className} footer={footer}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-fs-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-fs-2xl font-bold text-heading tabular-nums truncate">{value}</p>
          {hint && <p className="mt-0.5 text-fs-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-sm bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
      </div>
      {delta != null && (
        <div className={cn("mt-2 inline-flex items-center gap-1 text-fs-xs font-medium", trendColor)}>
          <TrendIcon className="w-3.5 h-3.5" />
          <span>{delta > 0 ? "+" : ""}{delta}%</span>
          {deltaLabel && <span className="text-muted-foreground font-normal">{deltaLabel}</span>}
        </div>
      )}
    </AppCard>
  );
}

