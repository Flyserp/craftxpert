import { usePermission } from "@/hooks/usePermission";
import AdminOnboarding from "./AdminOnboarding";
import ProviderOnboarding from "./ProviderOnboarding";
import EmployerOnboarding from "./EmployerOnboarding";
import CustomerOnboarding from "./CustomerOnboarding";

/**
 * Dispatches to the right onboarding flow based on the signed-in user's
 * strongest role. Admin is checked first so admins never accidentally
 * fall through to the customer wizard.
 */
const OnboardingRouter = () => {
  const perm = usePermission();

  if (perm.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (perm.isAdmin) return <AdminOnboarding />;
  if (perm.isProvider) return <ProviderOnboarding />;
  if (perm.isEmployer) return <EmployerOnboarding />;
  return <CustomerOnboarding />;
};

export default OnboardingRouter;
