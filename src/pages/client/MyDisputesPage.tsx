import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ReportIssueModal from "@/components/disputes/ReportIssueModal";
import {
  AlertTriangle, Plus, Clock, Eye, CheckCircle, XCircle,
} from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { Heading, LoadingState } from "@/components/ui/app";

interface Dispute {
  id: string;
  type: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

const statusConfig: Record<string, { color: string; label: string }> = {
  open: { color: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400", label: "Open" },
  under_review: { color: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400", label: "Under Review" },
  resolved: { color: "bg-secondary text-secondary-foreground", label: "Resolved" },
  dismissed: { color: "bg-muted text-muted-foreground", label: "Dismissed" },
};

export default function MyDisputesPage() {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(disputes, 10);

  const fetchDisputes = async () => {
    if (!user) return;
    let q = supabase
      .from("disputes")
      .select("*")
      .order("created_at", { ascending: false });
    q = q.eq("reporter_id", user.id);
    const { data } = await q;
    setDisputes((data as Dispute[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDisputes(); }, [user]);

  if (loading) {
    return (
      <DashboardLayout title="My Reports">
        <LoadingState variant="page" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="My Reports"
      subtitle="Track your submitted reports and disputes."
      actions={
        <Button size="sm" className="gap-1.5" onClick={() => setReportOpen(true)}>
          <Plus className="w-4 h-4" /> Report Issue
        </Button>
      }
    >
      {disputes.length === 0 ? (
        <div className="bg-card rounded-sm border border-border p-12 text-center">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-primary/30" />
          <p className="text-description-sm mb-4">You haven't submitted any reports</p>
          <Button size="sm" onClick={() => setReportOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Report an Issue
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {pageItems.map((d) => {
            const info = statusConfig[d.status] || statusConfig.open;
            return (
              <div key={d.id} className="bg-card rounded-sm border border-border p-5 animate-reveal">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <Heading level={3}  className="truncate">{d.subject}</Heading>
                  </div>
                  <Badge variant="secondary" className={cn("text-[10px] shrink-0", info.color)}>
                    {info.label}
                  </Badge>
                </div>
                <p className="text-fs-xs text-body line-clamp-2 mb-3">{d.description}</p>
                <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
                  <span className="capitalize">{d.type.replace("_", " ")}</span>
                  <span>·</span>
                  <span>{new Date(d.created_at).toLocaleDateString()}</span>
                  {d.resolved_at && (
                    <>
                      <span>·</span>
                      <span>Resolved {new Date(d.resolved_at).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
                {d.admin_notes && d.status !== "open" && (
                  <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                    <p className="text-fs-xs text-muted-foreground font-medium mb-1">Admin Response</p>
                    <p className="text-fs-xs text-body">{d.admin_notes}</p>
                  </div>
                )}
              </div>
            );
          })}
          <NumberedPagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={setPage}
            pageSize={pageSize}
          onPageSizeChange={setPageSize}
          />
        </div>
      )}

      <ReportIssueModal
        open={reportOpen}
        onOpenChange={setReportOpen}
        onSubmitted={fetchDisputes}
      />
    </DashboardLayout>
  );
}
