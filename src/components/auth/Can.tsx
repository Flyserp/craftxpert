import type { ReactNode } from "react";
import { usePermission } from "@/hooks/usePermission";
import type { AppRole } from "@/contexts/AuthContext";

interface CanProps {
  /** Single required role (treats provider_staff as 'provider') */
  role?: AppRole;
  /** User satisfies if they match any of these roles */
  anyOf?: AppRole[];
  /** Render only when the user is logged in (regardless of role) */
  authenticated?: boolean;
  /** Render only when the user is logged out */
  guest?: boolean;
  /** Optional fallback for the negative case (e.g. an upsell CTA) */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Declarative UI gate. Hides children unless the current user satisfies
 * the role/auth requirements. Use for nav items, action buttons, and any
 * element whose visibility depends on permissions.
 *
 * Examples:
 *   <Can role="customer"><PostTaskButton /></Can>
 *   <Can anyOf={["provider", "admin"]}>...</Can>
 *   <Can authenticated fallback={<LoginCTA />}>...</Can>
 */
export default function Can({
  role,
  anyOf,
  authenticated,
  guest,
  fallback = null,
  children,
}: CanProps) {
  const perm = usePermission();

  if (perm.loading) return null;

  let allowed = true;
  if (guest) allowed = !perm.isAuthenticated;
  else if (authenticated) allowed = perm.isAuthenticated;
  else if (role) allowed = perm.canAny([role]);
  else if (anyOf?.length) allowed = perm.canAny(anyOf);

  return <>{allowed ? children : fallback}</>;
}
