import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StarRating — the single source of truth for star icons across the app.
 *
 * Always renders 5 stars using the semantic `primary` token so ratings stay
 * consistent with the rest of the design system (hardcoded amber/yellow star
 * colors are considered legacy and should migrate to this component).
 *
 * Modes:
 *  - `value` + `max` (default 5): filled vs empty stars, with optional
 *    half-star support when the fractional part is >= 0.25 and < 0.75.
 *  - `count` only: renders `count` solid stars (for compact rating chips
 *    like "★ 4.9" where the numeric value lives next to the icon).
 */
export type StarRatingSize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASSES: Record<StarRatingSize, string> = {
  xs: "w-3 h-3",
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

interface StarRatingProps {
  /** Numeric rating (0..max). Ignored when `count` is provided. */
  value?: number;
  /** Total stars in the scale. Defaults to 5. */
  max?: number;
  /** Render exactly N solid primary stars (compact chip mode). */
  count?: number;
  /** Icon size preset. Defaults to `sm` (14px). */
  size?: StarRatingSize;
  /** Enable half-star rendering for fractional values. Defaults to `true`. */
  allowHalf?: boolean;
  /** Extra classes applied to the wrapper. */
  className?: string;
  /** Accessible label. Auto-generated from `value`/`count` when omitted. */
  ariaLabel?: string;
}

export function StarRating({
  value,
  max = 5,
  count,
  size = "sm",
  allowHalf = true,
  className,
  ariaLabel,
}: StarRatingProps) {
  const sizeCls = SIZE_CLASSES[size];

  // Compact chip mode: N solid primary stars, no empty slots.
  if (count !== undefined) {
    const label = ariaLabel ?? `${count} star${count === 1 ? "" : "s"}`;
    return (
      <span
        role="img"
        aria-label={label}
        className={cn("inline-flex items-center gap-0.5", className)}
      >
        {Array.from({ length: Math.max(0, Math.floor(count)) }).map((_, i) => (
          <Star key={i} className={cn(sizeCls, "fill-primary text-primary")} />
        ))}
      </span>
    );
  }

  const v = Math.max(0, Math.min(max, value ?? 0));
  const full = Math.floor(v);
  const frac = v - full;
  const hasHalf = allowHalf && frac >= 0.25 && frac < 0.75;
  const label = ariaLabel ?? `${v.toFixed(1)} out of ${max} stars`;

  return (
    <span
      role="img"
      aria-label={label}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {Array.from({ length: max }).map((_, i) => {
        const idx = i + 1;
        if (idx <= full) {
          return <Star key={i} className={cn(sizeCls, "fill-primary text-primary")} />;
        }
        if (hasHalf && idx === full + 1) {
          // Half-star: keep the same hue as filled + slightly stronger opacity
          // so the mid-tone still clears 3:1 non-text contrast on both themes.
          return <Star key={i} className={cn(sizeCls, "fill-primary/60 text-primary")} />;
        }
        // Empty star: outline only. Use muted-foreground (not the very faint
        // --border) with a thicker stroke so the shape is clearly perceivable
        // in both light and dark themes and meets WCAG 1.4.11 (3:1).
        return (
          <Star
            key={i}
            strokeWidth={2.25}
            className={cn(sizeCls, "text-muted-foreground/70 fill-transparent")}
          />
        );
      })}
    </span>
  );
}

export default StarRating;
