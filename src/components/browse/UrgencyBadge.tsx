import { Siren, Clock } from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { cn } from "@/lib/utils";
import type { NearestSlot } from "@/hooks/useNearestVendorSlots";

interface UrgencyBadgeProps {
  slot: NearestSlot;
  className?: string;
}

const UrgencyBadge = ({ slot, className }: UrgencyBadgeProps) => {
  const { date, hoursFromNow } = slot;
  const isUrgent = hoursFromNow <= 6;
  const isSoon = hoursFromNow <= 24;

  let label: string;
  if (hoursFromNow < 1) {
    label = "Available now";
  } else if (hoursFromNow < 24 && isToday(date)) {
    label = `Today ${format(date, "h:mm a")}`;
  } else if (isTomorrow(date)) {
    label = `Tomorrow ${format(date, "h:mm a")}`;
  } else {
    label = format(date, "EEE h:mm a");
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold",
        isUrgent
          ? "bg-destructive/12 text-destructive ring-1 ring-destructive/25"
          : isSoon
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/30"
          : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/25",
        className,
      )}
      title={`Next available: ${format(date, "EEEE, MMM d 'at' h:mm a")}`}
    >
      {isUrgent ? <Siren className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      {label}
    </span>
  );
};

export default UrgencyBadge;
