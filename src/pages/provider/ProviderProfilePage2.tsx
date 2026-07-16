import DashboardLayout from "@/components/DashboardLayout";
import ProviderProfileForm from "@/components/provider/ProviderProfileForm";
import ProviderPortfolioManager from "@/components/provider/ProviderPortfolioManager";

export default function ProviderProfilePage2() {
  return (
    <DashboardLayout title="Profile" subtitle="Update your business profile information.">
      <div className="space-y-6">
        <ProviderProfileForm />
        <ProviderPortfolioManager />
      </div>
    </DashboardLayout>
  );
}
