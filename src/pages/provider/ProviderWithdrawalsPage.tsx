import DashboardLayout from "@/components/DashboardLayout";
import WithdrawalManager from "@/components/provider/WithdrawalManager";

export default function ProviderWithdrawalsPage() {
  return (
    <DashboardLayout title="Withdrawals" subtitle="Request payouts and track your withdrawal history.">
      <WithdrawalManager />
    </DashboardLayout>
  );
}
