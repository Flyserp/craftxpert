import DashboardLayout from "@/components/DashboardLayout";
import ServiceListManager from "@/components/provider/ServiceListManager";

export default function ProviderServicesPage() {
  return (
    <DashboardLayout title="Services" subtitle="Manage the services you offer to customers.">
      <ServiceListManager />
    </DashboardLayout>
  );
}
