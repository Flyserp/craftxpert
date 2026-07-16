import { useEffect, useState } from "react";
import { Bookmark, MapPin, Calendar, DollarSign, Send, Trash2 } from "lucide-react";
import { format } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/app/LoadingState";
import { EmptyState } from "@/components/ui/app/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSavedJobs } from "@/hooks/useSavedJobs";
import { Heading } from "@/components/ui/app";

interface SavedJob {
  id: string;
  title: string;
  description: string;
  address: string;
  preferred_date: string | null;
  budget_min: number | null;
  budget_max: number | null;
  status: string;
}

export default function SavedJobsPage() {
  const { user } = useAuth();
  const { savedIds, toggleSaved } = useSavedJobs();
  const [jobs, setJobs] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const ids = Array.from(savedIds);
      if (!ids.length) { setJobs([]); setLoading(false); return; }
      const { data } = await supabase
        .from("tasks")
        .select("id, title, description, address, preferred_date, budget_min, budget_max, status")
        .in("id", ids);
      setJobs((data ?? []) as SavedJob[]);
      setLoading(false);
    };
    load();
  }, [user, savedIds]);

  return (
    <DashboardLayout title="Saved Jobs" subtitle="Jobs you've bookmarked to apply to later.">
      {loading ? (
        <LoadingState />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved jobs"
          description="Tap the bookmark on any job to save it for later."
          actionLabel="Browse jobs"
          actionHref="/provider-tasks"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {jobs.map((j) => {
            const closed = j.status === "closed" || j.status === "expired" || j.status === "completed";
            return (
              <div key={j.id} className="bg-card border border-border rounded-sm p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Heading level={3}  className="line-clamp-1 flex-1">{j.title}</Heading>
                  <Badge variant={closed ? "secondary" : "outline"} className="text-[10px] capitalize">{j.status}</Badge>
                </div>
                <p className="text-fs-xs text-muted-foreground line-clamp-2 mb-3">{j.description}</p>
                <div className="grid grid-cols-2 gap-2 text-fs-xs text-muted-foreground mb-4">
                  <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /><span className="truncate">{j.address}</span></div>
                  {j.preferred_date && (
                    <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" />{format(new Date(j.preferred_date + "T00:00:00"), "MMM d")}</div>
                  )}
                  {j.budget_min !== null && (
                    <div className="flex items-center gap-1.5 col-span-2"><DollarSign className="w-3 h-3" />Budget: ${j.budget_min}{j.budget_max ? ` – $${j.budget_max}` : "+"}</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" asChild disabled={closed} className="flex-1 gap-1.5">
                    <Link to={`/provider-tasks?apply=${j.id}`}>
                      <Send className="w-3.5 h-3.5" /> Apply
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleSaved(j.id)} aria-label="Remove from saved">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
