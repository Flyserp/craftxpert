import { Siren, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface EmergencyToggleProps {
  enabled: boolean;
  onChange: (val: boolean) => void;
  matchCount?: number;
  className?: string;
}

/**
 * Emergency booking toggle. When enabled, the browse list filters and sorts
 * vendors by the soonest available slot in the next 48 hours.
 */
const EmergencyToggle = ({ enabled, onChange, matchCount, className }: EmergencyToggleProps) => {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-sm border transition-all",
        enabled
          ? "border-destructive/40 bg-destructive/8 shadow-sm"
          : "border-border/60 bg-card hover:border-primary/30",
        className,
      )}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
          enabled ? "bg-destructive/15 text-destructive" : "bg-primary/8 text-primary",
        )}
        aria-hidden
      >
        {enabled ? <Siren className="w-4.5 h-4.5" /> : <Zap className="w-4.5 h-4.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-fs-sm font-semibold text-heading">Emergency booking</span>
          {enabled && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground">
              ON
            </span>
          )}
        </div>
        <p className="text-fs-xs text-muted-foreground mt-0.5">
          {enabled
            ? matchCount === undefined
              ? "Showing pros available in the next 48 hours…"
              : `${matchCount} pro${matchCount === 1 ? "" : "s"} can take you in the next 48 hours.`
            : "Need help fast? Show only pros with slots in the next 48h."}
        </p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        aria-label="Toggle emergency booking mode"
      />
    </div>
  );
};

export default EmergencyToggle;
