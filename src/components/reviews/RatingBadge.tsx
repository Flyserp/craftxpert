import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingBadgeProps {
  rating: number;
  reviewCount: number;
  size?: "xs" | "sm" | "md";
  showCount?: boolean;
  emptyLabel?: string;
  className?: string;
}

/**
 * Reusable, accessible rating display.
 * - Renders the average rating as a single filled star + numeric value.
 * - Includes review count in parentheses (optional).
 * - Falls back to `emptyLabel` (default: "New") when there are no reviews.
 * - Provides an aria-label for screen readers.
 */
export function RatingBadge({
  rating,
  reviewCount,
  size = "sm",
  showCount = true,
  emptyLabel = "New",
  className,
}: RatingBadgeProps) {
  const hasReviews = reviewCount > 0 && rating > 0;

  const sizeClasses = {
    xs: { star: "w-3 h-3", text: "text-[11px]", count: "text-[10px]" },
    sm: { star: "w-3.5 h-3.5", text: "text-fs-xs", count: "text-[11px]" },
    md: { star: "w-4 h-4", text: "text-fs-sm", count: "text-fs-xs" },
  }[size];

  const display = hasReviews ? rating.toFixed(1) : emptyLabel;
  const ariaLabel = hasReviews
    ? `Rated ${rating.toFixed(1)} out of 5 from ${reviewCount} review${reviewCount === 1 ? "" : "s"}`
    : `${emptyLabel} — no reviews yet`;

  return (
    <span
      className={cn("inline-flex items-center gap-1 tabular-nums", className)}
      aria-label={ariaLabel}
    >
      <Star
        className={cn(
          sizeClasses.star,
          hasReviews ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
        )}
        aria-hidden="true"
      />
      <span className={cn(sizeClasses.text, "font-semibold text-heading")}>
        {display}
      </span>
      {hasReviews && showCount && (
        <span className={cn(sizeClasses.count, "text-muted-foreground")}>
          ({reviewCount})
        </span>
      )}
    </span>
  );
}

