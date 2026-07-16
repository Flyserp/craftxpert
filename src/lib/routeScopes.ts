/**
 * Route paths reserved for platform-wide Super Admins ONLY.
 *
 * Tenant-scoped moderators — even those with elevated trust-and-safety powers
 * inside their tenant — must never reach these surfaces. Use this list as the
 * single source of truth for both server-side gates (ProtectedRoute) and
 * client-side navigation (sidebars, quick links).
 *
 * A path is considered super-admin-only if either:
 *   1. The exact pathname matches an entry, or
 *   2. The pathname starts with `<entry>/`
 *
 * `/admin` itself is included so nothing under the Super Admin shell leaks.
 * Moderator-safe surfaces live under `/moderator/*` instead.
 */
export const SUPER_ADMIN_ONLY_PREFIXES: readonly string[] = [
  "/admin",
];

export function isSuperAdminOnlyPath(pathname: string): boolean {
  return SUPER_ADMIN_ONLY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}
