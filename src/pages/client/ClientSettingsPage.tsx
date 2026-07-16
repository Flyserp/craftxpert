import DashboardLayout from "@/components/DashboardLayout";
import NotificationPreferences from "@/components/settings/NotificationPreferences";
import SecuritySettings from "@/components/settings/SecuritySettings";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";
import RestartTourSection from "@/components/settings/RestartTourSection";

export default function ClientSettingsPage() {
  return (
    <DashboardLayout title="Settings" subtitle="Manage your notifications and account preferences.">
      <div className="max-w-2xl space-y-6">
        <NotificationPreferences />
        <SecuritySettings />
        <RestartTourSection role="customer" />
        <DeleteAccountSection />
      </div>
    </DashboardLayout>
  );
}
