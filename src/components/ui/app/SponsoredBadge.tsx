import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface SponsoredBadgeProps {
  /** Whether the entity is marked as sponsored. */
  isSponsored?: boolean | null;
  /** ISO timestamp / Date when the sponsorship expires. Badge hides automatically once passed. */
  sponsoredUntil?: string | Date | null;
  /** Visual size. */
  size?: "sm" | "md";
  /** Hide the sparkle icon. */
  hideIcon?: boolean;
  className?: string;
}

/**
 * Reusable Sponsored badge.
 *
 * Renders nothing when:
 *  - `isSponsored` is falsy, OR
 *  - `sponsoredUntil` is provided and already in the past.
 *
 * Use on service cards, service details, search results, and category pages
 * to keep sponsored styling consistent across the app.
 */
export function SponsoredBadge({
  isSponsored,
  sponsoredUntil,
  size = "sm",
  hideIcon = false,
  className,
}: SponsoredBadgeProps) {
  if (!isSponsored) return null;
  if (sponsoredUntil) {
    const expiresAt = sponsoredUntil instanceof Date ? sponsoredUntil : new Date(sponsoredUntil);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
      return null;
    }
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 gap-1 rounded-sm border-accent/40 bg-accent/15 font-bold text-primary",
        size === "sm" ? "h-[18px] px-1.5 text-[9px]" : "h-5 px-2 text-fs-xs",
        className
      )}
    >
      {!hideIcon && <Sparkles className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />}
      Sponsored
    </Badge>
  );
}

export default SponsoredBadge;