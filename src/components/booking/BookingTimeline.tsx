import { format } from "date-fns";
import { CheckCircle2, Circle, XCircle, PlayCircle, CalendarCheck, Sparkles, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "pending" | "confirmed" | "accepted" | "in_progress" | "completed" | "cancelled" | string;

interface Props {
  status: Status;
  createdAt: string;
  updatedAt: string;
  bookingDate: string;
  startTime: string;
  paidAmount?: number;
  className?: string;
}

/**
 * Visual contract timeline derived from the booking's status + timestamps.
 * Past steps are filled, the current step is highlighted, future steps are muted.
 * Cancelled bookings short-circuit to a destructive "Cancelled" terminal step.
 */
export default function BookingTimeline({
  status, createdAt, updatedAt, bookingDate, startTime, paidAmount = 0, className,
}: Props) {
  const cancelled = status === "cancelled";
  const completed = status === "completed";
  const inProgress = status === "in_progress";
  const confirmed = status === "confirmed" || status === "accepted" || inProgress || completed;

  const scheduledAt = `${bookingDate}T${startTime.length === 5 ? `${startTime}:00` : startTime}`;

  const baseSteps = [
    {
      key: "hired",
      label: "Hired",
      help: "Provider assigned to this project.",
      icon: Sparkles,
      at: createdAt,
      done: true,
      current: status === "pending",
    },
    {
      key: "confirmed",
      label: "Project confirmed",
      help: paidAmount > 0 ? "Details locked in and deposit received." : "Details locked in.",
      icon: Receipt,
      at: confirmed ? createdAt : null,
      done: confirmed,
      current: status === "confirmed" || status === "accepted",
    },
    {
      key: "scheduled",
      label: "Scheduled",
      help: "Agreed start date and time.",
      icon: CalendarCheck,
      at: scheduledAt,
      done: confirmed,
      current: false,
    },
    {
      key: "in_progress",
      label: "Work in progress",
      help: "Provider has started the job.",
      icon: PlayCircle,
      at: inProgress || completed ? updatedAt : null,
      done: inProgress || completed,
      current: inProgress,
    },
    {
      key: "completed",
      label: "Completed",
      help: completed ? "Project marked complete. Eligible for review." : "Pending completion sign-off.",
      icon: CheckCircle2,
      at: completed ? updatedAt : null,
      done: completed,
      current: completed,
    },
  ];

  const steps = cancelled
    ? [
        ...baseSteps.slice(0, 2).map((s) => ({ ...s, current: false, done: true })),
        {
          key: "cancelled",
          label: "Cancelled",
          help: "This booking was cancelled.",
          icon: XCircle,
          at: updatedAt,
          done: true,
          current: true,
          destructive: true as const,
        },
      ]
    : baseSteps;

  return (
    <div className={cn("bg-card border border-border rounded-sm p-5", className)}>
      <p className="text-fs-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">
        Contract timeline
      </p>
      <ol className="relative">
        {steps.map((s, i) => {
          const Icon = s.done ? s.icon : Circle;
          const isLast = i === steps.length - 1;
          const destructive = "destructive" in s && s.destructive;
          return (
            <li key={s.key} className="flex gap-3 pb-5 last:pb-0 relative">
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[15px] top-8 bottom-0 w-px",
                    s.done && !destructive ? "bg-primary/40" : "bg-border",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ring-4 ring-card",
                  destructive
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
                  <p
                    className={cn(
                      "text-fs-sm font-semibold",
                      destructive ? "text-destructive" : s.done ? "text-heading" : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </p>
                  {s.at && (
                    <p className="text-[10px] tabular-nums text-muted-foreground">
                      {format(new Date(s.at), "MMM d, yyyy • HH:mm")}
                    </p>
                  )}
                </div>
                <p className="text-fs-xs text-muted-foreground mt-0.5">{s.help}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}