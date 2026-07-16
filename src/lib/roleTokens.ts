/**
 * Shared role-tone tokens.
 *
 * Single source of truth for the visual treatment of "user role" pills/chips
 * across the app (header badge, dashboard chips, audit-log filters, etc.).
 *
 * Rules:
 *  - Always reference these constants — never hand-roll role colors in components.
 *  - Tokens are semantic (primary/muted/...). Dark-mode variants flip via the
 *    HSL token system in src/index.css; only structural `dark:` utilities
 *    (separation rings, borders) live here.
 *  - To add a role, extend `RoleTone` and `ROLE_TONES` together.
 */

export type RoleTone = "Admin" | "Provider" | "Client";

/** Background + text + border tone for each role. */
export const ROLE_TONES: Record<RoleTone, string> = {
  Admin:
    "bg-primary text-primary-foreground border-primary " +
    "dark:border-background dark:ring-1 dark:ring-primary/40 dark:shadow-[0_0_0_1px_hsl(var(--background))]",
  Provider:
    "bg-primary/10 text-primary border-primary/30 " +
    "dark:bg-primary/15 dark:border-primary/50",
  Client:
    "bg-muted text-muted-foreground border-border " +
    "dark:bg-muted dark:text-foreground/80 dark:border-border",
};

/** Shared base classes for any small role pill (size, shape, typography). */
export const ROLE_BADGE_BASE =
  "inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border";

/**
 * Loading state: neutral skeleton tone + shimmer. Keeps the same footprint so
 * layout never shifts when the role resolves.
 */
export const ROLE_BADGE_LOADING =
  "bg-muted text-transparent border-border animate-pulse select-none pointer-events-none " +
  "dark:bg-muted dark:border-border";

/**
 * Disabled state: muted tone + reduced opacity, non-interactive. Use when the
 * role is known but currently inapplicable (e.g. impersonation paused).
 */
export const ROLE_BADGE_DISABLED =
  "bg-muted text-muted-foreground border-border opacity-60 cursor-not-allowed select-none " +
  "dark:bg-muted dark:text-foreground/60 dark:border-border";

/**
 * Admin Panel CTA button (header). Centralised so dark-mode contrast
 * tokens (separation ring + lightened hover) live with the rest of the
 * role-themed classes and can be unit-tested.
 *
 * Dark-mode contract:
 *  - `dark:border-background`   — separates pill from sibling chrome.
 *  - `dark:ring-1 dark:ring-primary/50` — soft glow for accent visibility.
 *  - `dark:hover:bg-primary/85` — keeps hover legible on lime/teal flip.
 */
export const ADMIN_PANEL_BUTTON_CLASSES =
  "h-8 gap-1.5 text-sm font-semibold " +
  "bg-primary text-primary-foreground border border-primary hover:bg-primary/90 " +
  "dark:border-background dark:ring-1 dark:ring-primary/50 dark:hover:bg-primary/85 " +
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// ============================================================================
// Admin surface tokens
// ----------------------------------------------------------------------------
// Centralised tone strings for admin tables, audit log, refund/dispute/
// withdrawal pages, etc. Inline color classes inside admin pages are forbidden:
// every status pill, stat-card accent, icon tile, and plan chip MUST resolve
// through the maps below so dark-mode contrast and palette stay coherent.
// ============================================================================

/**
 * Status tone keys used across admin tables (refunds, disputes, withdrawals,
 * audit log). Map each domain-specific status onto one of these semantic keys
 * — never invent ad-hoc colors per page.
 */
export type AdminStatusTone =
  | "info"     // blue   — in-progress / under review / approved-pending-payout
  | "success"  // emerald — granted / accepted / created
  | "warning"  // amber   — pending / setting changed / medium priority
  | "danger"   // destructive — denied / revoked / failed / high priority
  | "neutral"  // muted   — closed / dismissed / expired / low priority
  | "settled"; // secondary — fully resolved end-states (paid, resolved)

/** Background + text classes for each admin status tone (light + dark). */
export const ADMIN_STATUS_TONES: Record<AdminStatusTone, string> = {
  info:    "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  danger:  "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
  settled: "bg-secondary text-secondary-foreground",
};

/**
 * Accent palette for the rounded icon tile + colored glyph used in admin
 * stat cards. Each entry returns the matched `{ bg, accent }` pair so the
 * call site can apply them with `cn(...)` directly.
 *
 * Keep this aligned with `AdminStatusTone` — `accent` keys are a superset
 * because some stat cards visualise raw counts that don't have a status.
 */
export type AdminStatAccent =
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

export const ADMIN_STAT_ACCENTS: Record<
  AdminStatAccent,
  { bg: string; accent: string }
> = {
  primary: { bg: "bg-primary/10",       accent: "text-primary" },
  info:    { bg: "bg-blue-500/10",      accent: "text-blue-500" },
  success: { bg: "bg-emerald-500/10",   accent: "text-emerald-500" },
  warning: { bg: "bg-amber-500/10",     accent: "text-amber-500" },
  danger:  { bg: "bg-destructive/10",   accent: "text-destructive" },
  neutral: { bg: "bg-muted",            accent: "text-muted-foreground" },
};

/**
 * Icon-tile presets for dropdown items (e.g. AdminFloatingNav footer).
 * Combined `bg + text` for a small rounded square that hosts a lucide icon.
 */
export const ADMIN_ICON_TILE = {
  primary: "bg-primary/10 text-primary",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
} as const;

/**
 * Subscription plan chip colors used on the admin Users page. Plans are a
 * fixed enum (free/pro/elite) — not a status — so they get their own map
 * to avoid overloading `ADMIN_STATUS_TONES`.
 */
export type AdminPlanTone = "free" | "pro" | "elite";

export const ADMIN_USER_PLAN_TONES: Record<AdminPlanTone, string> = {
  free:  ADMIN_STATUS_TONES.settled,
  pro:   ADMIN_STATUS_TONES.info,
  elite: ADMIN_STATUS_TONES.warning,
};

/**
 * Avatar fallback tone shared by admin tables (Users page, future audit
 * actor avatars, etc.). Keeps the tinted-primary monogram coherent.
 */
export const ADMIN_AVATAR_FALLBACK = "bg-primary/10 text-primary";

/** Resolve an app role string ("admin"/"provider"/"client") to a RoleTone. */
export function resolveRoleTone(input: string | null | undefined): RoleTone {
  switch ((input ?? "").toLowerCase()) {
    case "admin":
      return "Admin";
    case "provider":
    case "vendor":
      return "Provider";
    default:
      return "Client";
  }
}
