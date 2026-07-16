import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/contexts/AuthContext";

/**
 * Centralized role + staff gating helper.
 *
 * Single source of truth for "what is this user allowed to see".
 * Wraps useAuth() roles plus a cached probe of provider_staff so callers
 * don't each re-query the database.
 *
 * Staff are treated as providers for UI gating (per product decision):
 * `isProvider` returns true for both real providers and active staff.
 */
export interface Permission {
  /** True while auth state is still hydrating — prefer to show skeletons */
  loading: boolean;
  isAuthenticated: boolean;
  isClient: boolean;
  /** True for users with the provider role OR active provider_staff membership */
  isProvider: boolean;
  /** True only for the super-admin role */
  isAdmin: boolean;
  /** True only for the moderator role */
  isModerator: boolean;
  /** True for admins OR moderators — use this to gate elevated-staff-only surfaces */
  isAdminOrModerator: boolean;
  /** True for users with the employer role (companies posting jobs) */
  isEmployer: boolean;
  /** True only for users with an active provider_staff row (a strict subset of isProvider) */
  isStaff: boolean;
  /** Convenience: check a specific app_role (does NOT include staff-as-provider) */
  hasRole: (role: AppRole) => boolean;
  /** Returns true if the user satisfies any of the given roles (treats staff as provider) */
  canAny: (roles: AppRole[]) => boolean;
}

export function usePermission(): Permission {
  const { user, loading, hasRole } = useAuth();
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsStaff(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("provider_staff")
        .select("id", { count: "exact", head: true })
        .eq("staff_user_id", user.id)
        .eq("is_active", true);
      if (!cancelled) setIsStaff((count ?? 0) > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isAdmin = hasRole("admin");
  const isModerator = hasRole("moderator");
  const isAdminOrModerator = isAdmin || isModerator;
  const isProviderRole = hasRole("provider");
  const isProvider = isProviderRole || isStaff;
  const isClient = hasRole("customer");
  const isEmployer = hasRole("employer");

  const canAny = (roles: AppRole[]) =>
    roles.some((r) => (r === "provider" ? isProvider : hasRole(r)));

  return {
    loading,
    isAuthenticated: !!user,
    isClient,
    isProvider,
    isAdmin,
    isModerator,
    isAdminOrModerator,
    isEmployer,
    isStaff,
    hasRole,
    canAny,
  };
}
