import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { JOB_STATUS_META, JOB_STATUS_ORDER, type JobStatus } from "./jobLifecycle";

interface Props {
  status: JobStatus;
  className?: string;
  /** Optional ISO timestamps keyed by status for "happened at" labels. */
  timestamps?: Partial<Record<JobStatus, string | null>>;
}

/**
 * Renders the canonical 10-state job lifecycle. Past steps are filled,
 * the current step is highlighted, future steps are muted. Cancelled and
 * Disputed are surfaced as terminal/alert rows appended to the visible flow.
 */
export default function JobLifecycleTimeline({ status, className, timestamps }: Props) {
  const currentIndex = JOB_STATUS_ORDER.indexOf(status === "cancelled" || status === "disputed" ? "published" : status);

  const steps: { key: JobStatus; done: boolean; current: boolean; alert?: boolean }[] = JOB_STATUS_ORDER.map((k, i) => ({
    key: k,
    done: currentIndex >= 0 && i <= currentIndex,
    current: k === status,
  }));

  if (status === "cancelled" || status === "disputed") {
    steps.push({ key: status, done: true, current: true, alert: true });
  }

  return (
    <div className={cn("bg-card border border-border rounded-sm p-4", className)}>
      <p className="text-fs-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">
        Job lifecycle
      </p>
      <ol className="relative">
        {steps.map((s, i) => {
          const meta = JOB_STATUS_META[s.key];
          const Icon = s.done ? meta.icon : Circle;
          const isLast = i === steps.length - 1;
          const at = timestamps?.[s.key];
          return (
            <li key={`${s.key}-${i}`} className="flex gap-3 pb-4 last:pb-0 relative">
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[15px] top-8 bottom-0 w-px",
                    s.done && !s.alert ? "bg-primary/40" : "bg-border",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ring-4 ring-card",
                  s.alert
                    ? "bg-destructive/15 text-destructive"
                    : s.current
                      ? "bg-primary text-primary-foreground"
                      : s.done
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn(
                    "text-fs-sm font-semibold",
                    s.alert ? "text-destructive" : s.done ? "text-heading" : "text-muted-foreground",
                  )}>
                    {meta.label}
                  </p>
                  {at && (
                    <p className="text-[10px] tabular-nums text-muted-foreground">
                      {new Date(at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
                <p className="text-fs-xs text-muted-foreground mt-0.5">{meta.help}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}