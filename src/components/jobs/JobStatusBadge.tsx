import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { JOB_STATUS_META, type JobStatus } from "./jobLifecycle";

export default function JobStatusBadge({
  status, className, showIcon = true,
}: { status: JobStatus; className?: string; showIcon?: boolean }) {
  const meta = JOB_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge className={cn("gap-1 border-0", meta.tone, className)}>
      {showIcon && <Icon className="h-3 w-3" />}
      {meta.label}
    </Badge>
  );
}