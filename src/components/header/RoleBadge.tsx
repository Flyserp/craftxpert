import { cn } from "@/lib/utils";
import {
  ROLE_BADGE_BASE,
  ROLE_BADGE_DISABLED,
  ROLE_BADGE_LOADING,
  ROLE_TONES,
  type RoleTone,
} from "@/lib/roleTokens";

/** @deprecated Import `RoleTone` from `@/lib/roleTokens` instead. */
export type BadgeRole = RoleTone;

interface RoleBadgeProps {
  /** Resolved role. May be omitted while `loading`. */
  role?: RoleTone;
  /** Hide on small screens (used in desktop header cluster). */
  hideOnMobile?: boolean;
  /** Async role-resolution placeholder: shimmer + neutral tone. */
  loading?: boolean;
  /** Static "unavailable" state: muted + reduced opacity, non-interactive. */
  disabled?: boolean;
  /** Optional label override (defaults to the role string, or "Loading role" / "Role unavailable"). */
  label?: string;
  className?: string;
}

/**
 * Header role pill. Uses the shared ROLE_TONES map from `@/lib/roleTokens`
 * so any new badge surface (dashboards, audit filters, etc.) stays in sync.
 *
 * State precedence: `loading` > `disabled` > resolved `role`.
 */
export default function RoleBadge({
  role,
  hideOnMobile = false,
  loading = false,
  disabled = false,
  label,
  className,
}: RoleBadgeProps) {
  const isLoading = loading;
  const isDisabled = !loading && disabled;
  const resolvedRole: RoleTone = role ?? "Client";

  const tone = isLoading || isDisabled ? "" : ROLE_TONES[resolvedRole];
  const stateClasses = isLoading
    ? ROLE_BADGE_LOADING
    : isDisabled
      ? ROLE_BADGE_DISABLED
      : "";

  const ariaLabel =
    label ??
    (isLoading
      ? "Loading role"
      : isDisabled
        ? "Role unavailable"
        : `Active role: ${resolvedRole}`);

  const content = isLoading ? "\u00A0\u00A0\u00A0\u00A0" : isDisabled ? "—" : resolvedRole;

  return (
    <span
      className={cn(
        ROLE_BADGE_BASE,
        tone,
        stateClasses,
        hideOnMobile && "hidden md:inline-flex",
        className,
      )}
      // `role="status"` while loading: semantically correct for an async
      // placeholder AND satisfies axe's aria-prohibited-attr rule (a span
      // with only whitespace text needs an explicit role to carry aria-label).
      role={isLoading ? "status" : undefined}
      aria-label={ariaLabel}
      aria-busy={isLoading || undefined}
      aria-disabled={isDisabled || undefined}
      data-state={isLoading ? "loading" : isDisabled ? "disabled" : "ready"}
    >
      {content}
    </span>
  );
}
