import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import PageSkeleton, { type PageSkeletonLayout } from "@/components/PageSkeleton";

export type LoadingStateVariant = "page" | "section" | "inline" | "overlay";

export interface LoadingStateProps {
  variant?: LoadingStateVariant;
  /** Optional title/description — retained for API compat; not rendered in skeleton variants. */
  title?: string;
  description?: string;
  className?: string;
  /** Skeleton scaffold shape (only used for variant="page" / "section"). */
  layout?: PageSkeletonLayout;
  /** Number of skeleton rows/cards to render. */
  count?: number;
}

/**
 * Unified loading view. Renders content-shaped skeletons for page/section
 * variants (replacing the old spinner + splash preloader look) and keeps
 * a lightweight spinner for inline/overlay cases where a skeleton doesn't fit.
 */
export function LoadingState({
  variant = "section",
  title = "Loading…",
  className,
  layout,
  count,
}: LoadingStateProps) {
  if (variant === "page") {
    return (
      <div role="status" aria-live="polite" className={cn("animate-fade-in", className)}>
        <PageSkeleton layout={layout ?? "page"} count={count} />
        <span className="sr-only">{title}</span>
      </div>
    );
  }

  if (variant === "section") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={cn("w-full py-6 animate-fade-in", className)}
      >
        <PageSkeleton
          layout={layout ?? "cards"}
          count={count ?? 6}
          withHeader={false}
          className="min-h-0"
        />
        <span className="sr-only">{title}</span>
      </div>
    );
  }

  if (variant === "overlay") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={cn(
          "absolute inset-0 z-20 bg-background/70 backdrop-blur-sm rounded-sm flex items-center justify-center animate-fade-in",
          className,
        )}
      >
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/70" />
        <span className="sr-only">{title}</span>
      </div>
    );
  }

  // inline — small skeleton row (preferred over spinner for consistency)
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("flex items-center gap-2 py-2 animate-fade-in", className)}
    >
      <Skeleton className="h-4 w-4 rounded-full" />
      <Skeleton className="h-3 w-24" />
      <span className="sr-only">{title}</span>
    </div>
  );
}
