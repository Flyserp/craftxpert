import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Pencil, XCircle, Save, Plus, RefreshCw, Users, Trash2, Archive, Send } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/app/LoadingState";
import { EmptyState } from "@/components/ui/app/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import JobStatusBadge from "@/components/jobs/JobStatusBadge";
import JobLifecycleTimeline from "@/components/jobs/JobLifecycleTimeline";
import { normalizeJobStatus } from "@/components/jobs/jobLifecycle";

interface Job {
  id: string;
  title: string;
  description: string;
  address: string;
  budget_min: number | null;
  budget_max: number | null;
  preferred_date: string | null;
  status: string;
  payment_status: string;
  created_at: string;
  updated_at?: string | null;
  proposal_count?: number;
  has_dispute?: boolean;
}

export default function EmployerJobsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Job>>({});

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("tasks")
      .select("id, title, description, address, budget_min, budget_max, preferred_date, status, payment_status, created_at, updated_at, task_proposals(status), disputes(id)")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });
    const rows: Job[] = (data ?? []).map((t: any) => {
      const proposals: { status: string }[] = t.task_proposals ?? [];
      return {
        ...t,
        proposal_count: proposals.length,
        has_dispute: (t.disputes ?? []).length > 0,
      } as Job;
    });
    setJobs(rows);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const startEdit = (j: Job) => { setEditingId(j.id); setDraft(j); };
  const cancelEdit = () => { setEditingId(null); setDraft({}); };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase
      .from("tasks")
      .update({
        title: draft.title,
        description: draft.description,
        address: draft.address,
        budget_min: draft.budget_min ?? null,
        budget_max: draft.budget_max ?? null,
        preferred_date: draft.preferred_date || null,
      })
      .eq("id", editingId);
    if (error) { toast.error(error.message); return; }
    toast.success("Job updated");
    cancelEdit();
    load();
  };

  const closeJob = async (id: string) => {
    if (!confirm("Close this job? It will no longer accept proposals.")) return;
    const { error } = await supabase.from("tasks").update({ status: "closed" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Job closed");
    load();
  };

  const archiveJob = async (id: string) => {
    const { error } = await supabase.from("tasks").update({ status: "archived" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Job archived");
    load();
  };

  const publishJob = async (id: string) => {
    const { error } = await supabase.from("tasks").update({ status: "open" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Job published");
    load();
  };

  const deleteJob = async (id: string) => {
    if (!confirm("Delete this job permanently? Applicants and proposals will also be removed.")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Job deleted");
    load();
  };

  const renewJob = async (id: string) => {
    const input = prompt("New deadline (YYYY-MM-DD):");
    if (!input) return;
    const { error } = await (supabase as any).rpc("renew_task", { _task_id: id, _new_deadline: input });
    if (error) { toast.error(error.message); return; }
    toast.success("Job renewed and republished");
    load();
  };

  return (
    <DashboardLayout
      title="My Jobs"
      subtitle="Edit or close your posted jobs."
      actions={<Button asChild><Link to="/employer-post-job"><Plus className="h-4 w-4 mr-2" />Post a Job</Link></Button>}
    >
      {loading ? (
        <LoadingState />
      ) : jobs.length === 0 ? (
        <EmptyState title="No jobs posted yet" description="Publish your first job to start receiving proposals." />
      ) : (
        <div className="space-y-4">
          {jobs.map((j) => (
            <Card key={j.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">{j.title}</CardTitle>
                  <div className="mt-1 flex gap-2 flex-wrap">
                    <JobStatusBadge status={normalizeJobStatus(j.status, {
                      proposalCount: j.proposal_count,
                      hasShortlisted: false,
                      hasAccepted: false,
                      hasDispute: j.has_dispute,
                    })} />
                    <Badge variant="outline">Payment: {j.payment_status}</Badge>
                  </div>
                </div>
                {editingId !== j.id && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/employer-jobs/${j.id}/applicants`}>
                        <Users className="h-3 w-3 mr-1" />Applicants{j.proposal_count ? ` (${j.proposal_count})` : ""}
                      </Link>
                    </Button>
                    {j.status === "expired" && (
                      <Button size="sm" onClick={() => renewJob(j.id)}>
                        <RefreshCw className="h-3 w-3 mr-1" />Renew
                      </Button>
                    )}
                    {j.status === "draft" && (
                      <Button size="sm" onClick={() => publishJob(j.id)}>
                        <Send className="h-3 w-3 mr-1" />Publish
                      </Button>
                    )}
                    {j.status !== "closed" && j.status !== "expired" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => startEdit(j)}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => closeJob(j.id)}><XCircle className="h-3 w-3 mr-1" />Close</Button>
                      </>
                    )}
                    {j.status !== "archived" && (
                      <Button size="sm" variant="outline" onClick={() => archiveJob(j.id)}>
                        <Archive className="h-3 w-3 mr-1" />Archive
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteJob(j.id)}>
                      <Trash2 className="h-3 w-3 mr-1" />Delete
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {editingId === j.id ? (
                  <div className="space-y-3">
                    <div><Label>Title</Label><Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
                    <div><Label>Description</Label><Textarea rows={3} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><Label>Location</Label><Input value={draft.address ?? ""} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></div>
                      <div><Label>Deadline</Label><Input type="date" value={draft.preferred_date ?? ""} onChange={(e) => setDraft({ ...draft, preferred_date: e.target.value })} /></div>
                      <div><Label>Budget min</Label><Input type="number" value={draft.budget_min ?? ""} onChange={(e) => setDraft({ ...draft, budget_min: e.target.value ? Number(e.target.value) : null })} /></div>
                      <div><Label>Budget max</Label><Input type="number" value={draft.budget_max ?? ""} onChange={(e) => setDraft({ ...draft, budget_max: e.target.value ? Number(e.target.value) : null })} /></div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit}><Save className="h-3 w-3 mr-1" />Save</Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p className="line-clamp-2 text-foreground">{j.description}</p>
                    <p>📍 {j.address}</p>
                    {j.preferred_date && <p>📅 Deadline: {new Date(j.preferred_date).toLocaleDateString()}</p>}
                    {(j.budget_min || j.budget_max) && <p>💰 ${j.budget_min ?? 0} – ${j.budget_max ?? 0}</p>}
                  </div>
                )}
                {editingId !== j.id && (
                  <div className="mt-4">
                    <JobLifecycleTimeline
                      status={normalizeJobStatus(j.status, {
                        proposalCount: j.proposal_count,
                        hasDispute: j.has_dispute,
                      })}
                      timestamps={{ draft: j.created_at, published: j.created_at }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}