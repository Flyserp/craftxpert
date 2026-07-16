import DashboardLayout from "@/components/DashboardLayout";
import { useUserWorkflow } from "@/hooks/useUserWorkflow";
import WorkflowTracker from "@/components/workflow/WorkflowTracker";
import { LoadingState } from "@/components/ui/app";

export default function WorkflowPage() {
  const { loading, steps, title } = useUserWorkflow();

  return (
    <DashboardLayout title="Your workflow" subtitle="Follow each step in order to unlock the next stage.">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {loading ? <LoadingState variant="section" /> : <WorkflowTracker title={title} steps={steps} />}
      </div>
    </DashboardLayout>
  );
}