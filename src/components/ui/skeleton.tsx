import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "skeleton-shimmer animate-pulse rounded-sm bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
