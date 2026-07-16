import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { FileText, MapPin, DollarSign, Calendar } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState } from "@/components/ui/app/LoadingState";
import { EmptyState } from "@/components/ui/app/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Heading } from "@/components/ui/app";

type AppStatus = "pending" | "shortlisted" | "accepted" | "rejected" | "completed";

interface Application {
  id: string;
  status: AppStatus;
  quoted_price: number | null;
  eta_date: string | null;
  message: string | null;
  created_at: string;
  task: { id: string; title: string; address: string; status: string } | null;
  booking_status: string | null;
}

const TABS: { value: AppStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "completed", label: "Completed" },
];

const STATUS_STYLES: Record<AppStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  shortlisted: "bg-blue-100 text-blue-800 border-blue-200",
  accepted: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  completed: "bg-primary/10 text-primary border-primary/20",
};

export default function ApplicationsHistoryPage() {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AppStatus | "all">("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("task_proposals")
        .select("id, status, quoted_price, eta_date, message, created_at, booking_id, task:tasks(id, title, address, status), booking:bookings(status)")
        .eq("vendor_id", user.id)
        .eq("direction", "vendor_applied")
        .order("created_at", { ascending: false });

      const mapped: Application[] = (data ?? []).map((row: any) => {
        const bookingStatus = row.booking?.status ?? null;
        let status: AppStatus;
        if (bookingStatus === "completed") status = "completed";
        else if (row.status === "declined" || row.status === "withdrawn") status = "rejected";
        else if (row.status === "shortlisted") status = "shortlisted";
        else if (row.status === "accepted") status = "accepted";
        else status = "pending";
        return {
          id: row.id,
          status,
          quoted_price: row.quoted_price,
          eta_date: row.eta_date,
          message: row.message,
          created_at: row.created_at,
          task: row.task,
          booking_status: bookingStatus,
        };
      });
      setApps(mapped);
      setLoading(false);
    })();
  }, [user]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: apps.length };
    for (const a of apps) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [apps]);

  const filtered = tab === "all" ? apps : apps.filter((a) => a.status === tab);

  return (
    <DashboardLayout title="Application History" subtitle="Track every job you've applied to and its current status.">
      <Tabs value={tab} onValueChange={(v) => setTab(v as AppStatus | "all")}>
        <TabsList className="flex flex-wrap h-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              {t.label}
              <span className="text-fs-xs text-muted-foreground">({counts[t.value] ?? 0})</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab} className="mt-5">
          {loading ? (
            <LoadingState />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No applications"
              description="Apply to jobs from the task feed to see them here."
              actionLabel="Browse jobs"
              actionHref="/provider-tasks"
            />
          ) : (
            <div className="grid gap-3">
              {filtered.map((a) => (
                <div key={a.id} className="bg-card border border-border rounded-sm p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <Heading level={3}  className="truncate">
                        {a.task?.title ?? "Job removed"}
                      </Heading>
                      <p className="text-fs-xs text-muted-foreground">
                        Applied {format(new Date(a.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Badge variant="outline" className={`capitalize ${STATUS_STYLES[a.status]}`}>
                      {a.status}
                    </Badge>
                  </div>

                  {a.message && (
                    <p className="text-fs-xs text-muted-foreground line-clamp-2 mb-3">{a.message}</p>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-fs-xs text-muted-foreground mb-3">
                    {a.task?.address && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a.task.address}</span>
                    )}
                    {a.quoted_price !== null && (
                      <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${a.quoted_price}</span>
                    )}
                    {a.eta_date && (
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />ETA {format(new Date(a.eta_date + "T00:00:00"), "MMM d")}</span>
                    )}
                  </div>

                  {a.task && (
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/provider-tasks?apply=${a.task.id}`}>View job</Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
