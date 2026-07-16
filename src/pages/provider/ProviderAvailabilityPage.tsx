import DashboardLayout from "@/components/DashboardLayout";
import AvailabilityManager from "@/components/provider/AvailabilityManager";

export default function ProviderAvailabilityPage() {
  return (
    <DashboardLayout title="Availability" subtitle="Set your weekly schedule and block specific dates.">
      <AvailabilityManager />
    </DashboardLayout>
  );
}
