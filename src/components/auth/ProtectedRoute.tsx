import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { AppRole } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import PageSkeleton from "@/components/PageSkeleton";
import { useIsInsideDashboardShell } from "@/components/layouts/PageMetaContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
  redirectTo?: string;
}

/** Resolve the dashboard path for a user's strongest role */
const dashboardForRole = (perm: ReturnType<typeof usePermission>): string => {
  if (perm.isAdmin) return "/admin";
  if (perm.isModerator) return "/moderator";
  if (perm.isProvider) return perm.isStaff && !perm.hasRole("provider") ? "/staff-dashboard" : "/provider-dashboard";
  if (perm.isEmployer) return "/employer-dashboard";
  if (perm.isClient) return "/client-dashboard";
  return "/";
};

const ProtectedRoute = ({ children, requiredRole, redirectTo = "/login" }: ProtectedRouteProps) => {
  const { user, loading, needsProfileCompletion, signOut } = useAuth();
  const perm = usePermission();
  const location = useLocation();
  const navigate = useNavigate();
  const toastedRef = useRef(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const insideShell = useIsInsideDashboardShell();

  const role = requiredRole;
  // Admins implicitly satisfy the moderator gate (they can view moderator surfaces).
  const satisfiesRole =
    !role ||
    perm.canAny([role]) ||
    (role === "moderator" && perm.isAdmin);
  const wrongRole = !!user && !satisfiesRole && !needsProfileCompletion;
  // Admin is special: can't self-switch, so we keep the dialog flow.
  const isAdminGate = role === "admin";

  // Moderators trying to enter a Super Admin gate: bounce to their own
  // workspace with a clear toast instead of the "contact an admin" dialog.
  const moderatorHitsAdminGate = isAdminGate && wrongRole && perm.isModerator;

  useEffect(() => {
    if (loading || toastedRef.current) return;
    if (!user) {
      toast.info("Please sign in to continue.");
      toastedRef.current = true;
    } else if (moderatorHitsAdminGate) {
      toast.info("Super Admin only — this area is off-limits to moderators.");
      toastedRef.current = true;
    } else if (wrongRole && isAdminGate) {
      setSwitchOpen(true);
      toastedRef.current = true;
    } else if (wrongRole) {
      // Friendly redirect to the user's own dashboard with a toast.
      toast.info(`This area is for ${role}s — taking you back to your dashboard.`);
      toastedRef.current = true;
    }
  }, [loading, user, wrongRole, isAdminGate, moderatorHitsAdminGate, role]);

  if (loading) {
    // Scoped skeleton — no `min-h-screen` full-window overlay. When rendered
    // inside a DashboardShell, the shell's header + sidebar + breadcrumb bar
    // stay mounted and only this content region shows the skeleton. Outside
    // the shell (public authed pages) we still show a compact page skeleton
    // instead of blanking the viewport.
    return (
      <PageSkeleton
        layout={insideShell ? "cards" : "dashboard"}
        withHeader={!insideShell}
        count={6}
        className={insideShell ? "pt-2" : "pt-8"}
      />
    );
  }

  if (!user) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    const target = `${redirectTo}?redirect=${encodeURIComponent(from)}`;
    return <Navigate to={target} replace state={{ from }} />;
  }
  if (needsProfileCompletion) return <Navigate to="/complete-profile" replace />;

  if (wrongRole && !isAdminGate) {
    return <Navigate to={dashboardForRole(perm)} replace />;
  }

  if (moderatorHitsAdminGate) {
    return <Navigate to="/moderator" replace />;
  }

  if (wrongRole && isAdminGate) {
    const handleCancel = () => {
      setSwitchOpen(false);
      navigate(dashboardForRole(perm), { replace: true });
    };

    return (
      <AlertDialog open={switchOpen} onOpenChange={(o) => { if (!o) handleCancel(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Admin access required</AlertDialogTitle>
            <AlertDialogDescription>
              You're signed in with a different role. This area is restricted — contact a platform administrator if you need access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Back to my dashboard</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await signOut(); navigate("/login", { replace: true }); }}>
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
