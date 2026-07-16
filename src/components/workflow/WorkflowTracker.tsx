import { Link } from "react-router-dom";
import { Check, Lock, ArrowRight, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/app";

export type WorkflowStep = {
  key: string;
  label: string;
  description?: string;
  done: boolean;
  href?: string;
  cta?: string;
};

interface Props {
  title: string;
  steps: WorkflowStep[];
  className?: string;
}

/**
 * Linear progress tracker. Steps must be passed in workflow order; the first
 * incomplete step is treated as "current" and is the only one with an active
 * CTA — subsequent steps are locked until prior steps are done, enforcing
 * sequence at the UI level.
 */
export default function WorkflowTracker({ title, steps, className }: Props) {
  const currentIndex = steps.findIndex((s) => !s.done);
  const completed = steps.filter((s) => s.done).length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <section className={cn("rounded-sm border border-border bg-card p-5", className)}>
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="min-w-0">
          <Heading level={2}  className="truncate">{title}</Heading>
          <p className="text-fs-xs text-muted-foreground mt-0.5">
            {completed} of {steps.length} steps complete · {pct}%
          </p>
        </div>
        <div className="hidden sm:flex h-2 w-40 rounded-sm bg-muted overflow-hidden shrink-0">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ol className="space-y-2">
        {steps.map((step, i) => {
          const isCurrent = i === currentIndex;
          const isLocked = currentIndex !== -1 && i > currentIndex;
          const status: "done" | "current" | "locked" = step.done
            ? "done"
            : isCurrent
            ? "current"
            : "locked";

          return (
            <li
              key={step.key}
              className={cn(
                "flex items-start gap-3 rounded-sm border p-3 transition-colors",
                status === "done" && "border-border bg-muted/30",
                status === "current" && "border-primary/30 bg-primary/5",
                status === "locked" && "border-dashed border-border opacity-60",
              )}
            >
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-fs-xs font-medium",
                  status === "done" && "bg-primary text-primary-foreground",
                  status === "current" && "bg-primary/10 text-primary border border-primary/40",
                  status === "locked" && "bg-muted text-muted-foreground",
                )}
              >
                {status === "done" ? (
                  <Check className="h-4 w-4" />
                ) : status === "locked" ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-fs-sm font-medium text-heading">
                    {i + 1}. {step.label}
                  </p>
                  {status === "current" && (
                    <span className="text-fs-xs text-primary font-medium">Current step</span>
                  )}
                </div>
                {step.description && (
                  <p className="text-fs-xs text-muted-foreground mt-0.5 clamp-2">
                    {step.description}
                  </p>
                )}
              </div>
              {status === "current" && step.href && (
                <Button asChild size="sm" variant="default" className="shrink-0">
                  <Link to={step.href}>
                    {step.cta || "Continue"} <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              )}
              {status === "done" && step.href && (
                <Button asChild size="sm" variant="ghost" className="shrink-0">
                  <Link to={step.href}>Review</Link>
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}