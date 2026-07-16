import DashboardLayout from "@/components/DashboardLayout";
import NotificationPreferences from "@/components/settings/NotificationPreferences";
import PushNotificationSettings from "@/components/settings/PushNotificationSettings";
import SecuritySettings from "@/components/settings/SecuritySettings";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";
import RestartTourSection from "@/components/settings/RestartTourSection";

export default function ProviderSettingsPage() {
  return (
    <DashboardLayout title="Settings" subtitle="Manage your notifications and account preferences.">
      <div className="space-y-6">
        <NotificationPreferences />
        <PushNotificationSettings />

        <SecuritySettings />
        <RestartTourSection role="provider" />
        <DeleteAccountSection />
      </div>
    </DashboardLayout>
  );
}
