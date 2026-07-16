import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Search, MoreHorizontal, Eye, Star, StarOff, Ban, Trash2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/app";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";

interface JobRow {
  id: string;
  title: string;
  description: string;
  status: string;
  featured: boolean;
  moderation_note: string | null;
  address: string;
  budget_min: number | null;
  budget_max: number | null;
  created_at: string;
  customer_id: string;
  customer_name?: string;
}

const STATUS_TONES: Record<string, string> = {
  open: "bg-emerald-500/10 text-emerald-600",
  in_progress: "bg-blue-500/10 text-blue-600",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-muted text-muted-foreground",
  suspended: "bg-destructive/10 text-destructive",
  closed: "bg-muted text-muted-foreground",
};

export default function AdminJobsPage() {
  const [rows, setRows] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [viewJob, setViewJob] = useState<JobRow | null>(null);
  const [moderate, setModerate] = useState<JobRow | null>(null);
  const [modNote, setModNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<JobRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tasks")
      .select("id, title, description, status, featured, moderation_note, address, budget_min, budget_max, created_at, customer_id")
      .order("created_at", { ascending: false })
      .limit(500);
    const jobs = (data || []) as JobRow[];
    const ids = Array.from(new Set(jobs.map((j) => j.customer_id)));
    const { data: profs } = await supabase
      .from("profiles").select("user_id, display_name")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const map = new Map((profs || []).map((p: any) => [p.user_id, p.display_name || "—"]));
    setRows(jobs.map((j) => ({ ...j, customer_name: map.get(j.customer_id) || "—" })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (featuredOnly && !r.featured) return false;
      if (query && !`${r.title} ${r.description} ${r.address} ${r.customer_name}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [rows, q, status, featuredOnly]);

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(filtered, 15);

  const update = async (id: string, patch: Partial<JobRow>) => {
    const { error } = await supabase.from("tasks").update(patch as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Job updated");
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } as JobRow : r)));
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Job deleted");
    setRows((prev) => prev.filter((r) => r.id !== id));
    setConfirmDelete(null);
  };

  const submitModeration = async () => {
    if (!moderate) return;
    await update(moderate.id, { status: "suspended", moderation_note: modNote || null } as any);
    setModerate(null);
    setModNote("");
  };

  return (
    <AdminPage title="Jobs" subtitle="Moderate posted jobs — feature, suspend, or remove inappropriate content.">
      {loading ? <LoadingState variant="section" /> : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-4 gap-3 bg-card border border-border rounded-sm p-4">
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search title, customer, address…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["all","open","in_progress","completed","cancelled","suspended","closed"].map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s === "all" ? "All statuses" : s.replace("_"," ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant={featuredOnly ? "default" : "outline"} onClick={() => setFeaturedOnly((v) => !v)} className="gap-1.5">
              <Star className="w-4 h-4" /> Featured only
            </Button>
          </div>

          <div className="bg-card border border-border rounded-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Featured</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Posted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No jobs found.</TableCell></TableRow>
                ) : pageItems.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-[280px]">
                      <div className="font-medium text-heading truncate">{r.title}</div>
                      {r.moderation_note && (
                        <div className="text-fs-xs text-destructive inline-flex items-center gap-1 mt-0.5">
                          <ShieldAlert className="w-3 h-3" /> {r.moderation_note}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{r.customer_name}</TableCell>
                    <TableCell>
                      <span className={`text-fs-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_TONES[r.status] || "bg-muted text-muted-foreground"}`}>
                        {r.status.replace("_"," ")}
                      </span>
                    </TableCell>
                    <TableCell>{r.featured ? <Star className="w-4 h-4 text-primary fill-primary" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="tabular-nums">
                      {r.budget_min || r.budget_max ? `$${r.budget_min ?? "—"}–$${r.budget_max ?? "—"}` : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{format(new Date(r.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Job actions"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Job actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => setViewJob(r)}><Eye className="w-4 h-4 mr-2" />View details</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => update(r.id, { featured: !r.featured })}>
                            {r.featured
                              ? <><StarOff className="w-4 h-4 mr-2" />Unfeature</>
                              : <><Star className="w-4 h-4 mr-2" />Feature</>}
                          </DropdownMenuItem>
                          {r.status === "suspended" ? (
                            <DropdownMenuItem onClick={() => update(r.id, { status: "open", moderation_note: null } as any)}>
                              <CheckCircle2 className="w-4 h-4 mr-2" />Reinstate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => { setModerate(r); setModNote(r.moderation_note || ""); }}>
                              <Ban className="w-4 h-4 mr-2" />Suspend / moderate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(r)}>
                            <Trash2 className="w-4 h-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filtered.length > 0 && (
            <NumberedPagination
              currentPage={page} totalPages={totalPages} onPageChange={setPage}
              totalItems={totalItems} pageSize={pageSize} onPageSizeChange={setPageSize}
            />
          )}
        </div>
      )}

      <Dialog open={!!viewJob} onOpenChange={(o) => !o && setViewJob(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewJob?.title}</DialogTitle>
            <DialogDescription>Posted by {viewJob?.customer_name} · {viewJob && format(new Date(viewJob.created_at), "PPP")}</DialogDescription>
          </DialogHeader>
          {viewJob && (
            <div className="space-y-3 text-body">
              <div><span className="text-fs-xs text-muted-foreground">Status:</span> <span className="capitalize">{viewJob.status}</span></div>
              <div><span className="text-fs-xs text-muted-foreground">Address:</span> {viewJob.address}</div>
              <div><span className="text-fs-xs text-muted-foreground">Budget:</span> ${viewJob.budget_min ?? "—"}–${viewJob.budget_max ?? "—"}</div>
              <div>
                <p className="text-fs-xs text-muted-foreground mb-1">Description</p>
                <p className="whitespace-pre-wrap">{viewJob.description}</p>
              </div>
              {viewJob.moderation_note && (
                <div className="text-destructive">
                  <p className="text-fs-xs font-medium">Moderation note</p>
                  <p className="text-body">{viewJob.moderation_note}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!moderate} onOpenChange={(o) => { if (!o) { setModerate(null); setModNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend job</DialogTitle>
            <DialogDescription>Hide this job from listings and notify the customer of the reason.</DialogDescription>
          </DialogHeader>
          <Textarea value={modNote} onChange={(e) => setModNote(e.target.value)} placeholder="Reason (e.g. inappropriate content, spam, duplicate)…" rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setModerate(null)}>Cancel</Button>
            <Button onClick={submitModeration} disabled={!modNote.trim()}>Suspend job</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the job and all its proposals. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => confirmDelete && remove(confirmDelete.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
}