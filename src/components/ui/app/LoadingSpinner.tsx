import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const sizeMap = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
  xl: "w-12 h-12",
} as const;

export interface LoadingSpinnerProps {
  size?: keyof typeof sizeMap;
  className?: string;
  /** Wraps the spinner in a centered full-viewport container. */
  fullscreen?: boolean;
  label?: string;
}

/** Standard loading spinner. Replaces ad-hoc `<Loader2 className="animate-spin">` usage. */
export function LoadingSpinner({
  size = "md",
  className,
  fullscreen,
  label,
}: LoadingSpinnerProps) {
  const spinner = (
    <Loader2
      className={cn("animate-spin text-muted-foreground", sizeMap[size], className)}
      aria-label={label ?? "Loading"}
    />
  );
  if (!fullscreen) return spinner;
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center min-h-[60vh] gap-3"
    >
      {spinner}
      {label && <p className="text-fs-sm text-muted-foreground">{label}</p>}
    </div>
  );
}

