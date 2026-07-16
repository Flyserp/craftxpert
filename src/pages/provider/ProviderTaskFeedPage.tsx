import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  ClipboardList, MapPin, Calendar, DollarSign, Send, Inbox, CheckCircle2, XCircle, Clock, Briefcase, Search, BadgeCheck, X, Bookmark, BookmarkCheck, Lock, Sparkles,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { acceptProposal, declineProposal, withdrawProposal } from "@/lib/taskProposals";
import { createNotification } from "@/lib/notifications";
import { useProviderSubscription } from "@/hooks/useProviderSubscription";
import { useSavedJobs } from "@/hooks/useSavedJobs";
import { useNavigate } from "react-router-dom";
import NumberedPagination from "@/components/common/NumberedPagination";
import { usePagination } from "@/hooks/usePagination";
import { Heading } from "@/components/ui/app";
import CancelJobButton from "@/components/jobs/CancelJobButton";

interface Task {
  id: string;
  title: string;
  description: string;
  address: string;
  preferred_date: string | null;
  preferred_time: string | null;
  budget_min: number | null;
  budget_max: number | null;
  category_id: string;
  customer_id: string;
  created_at: string;
  category_name?: string;
  customer_name?: string;
  proposal_count?: number;
  employer_verified?: boolean;
}

interface Proposal {
  id: string;
  task_id: string;
  customer_id: string;
  service_id: string | null;
  quoted_price: number | null;
  eta_date: string | null;
  message: string | null;
  status: string;
  direction: string;
  created_at: string;
  estimated_duration?: string | null;
  attachments?: string[];
  task?: Task;
}

interface ProviderService {
  id: string;
  title: string;
  category_id: string;
}

export default function ProviderTaskFeedPage() {
  const { user } = useAuth();
  const { isActive: subscriptionActive, loading: subLoading } = useProviderSubscription();
  const navigate = useNavigate();
  const { savedIds, toggleSaved } = useSavedJobs();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<"open" | "applied" | "invitations">("open");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  // Filters / sort
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [location, setLocation] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<"newest" | "popular">("newest");
  const [appliedTasks, setAppliedTasks] = useState<{ task: Task; proposal: Proposal }[]>([]);
  const [invitations, setInvitations] = useState<{ task: Task; proposal: Proposal }[]>([]);
  const [services, setServices] = useState<ProviderService[]>([]);
  const [appliedTaskIds, setAppliedTaskIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Apply modal
  const [applyTask, setApplyTask] = useState<Task | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [quotedPrice, setQuotedPrice] = useState("");
  const [etaDate, setEtaDate] = useState("");
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploadingAtt, setUploadingAtt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const loc = location.trim().toLowerCase();
    const minB = budgetMin ? Number(budgetMin) : null;
    const maxB = budgetMax ? Number(budgetMax) : null;
    let list = tasks.filter(t => {
      if (q && !(`${t.title} ${t.description}`.toLowerCase().includes(q))) return false;
      if (categoryId && t.category_id !== categoryId) return false;
      if (loc && !(t.address || "").toLowerCase().includes(loc)) return false;
      if (verifiedOnly && !t.employer_verified) return false;
      const tMin = t.budget_min ?? 0;
      const tMax = t.budget_max ?? t.budget_min ?? Infinity;
      if (minB !== null && tMax < minB) return false;
      if (maxB !== null && tMin > maxB) return false;
      return true;
    });
    if (sort === "popular") {
      list = [...list].sort((a, b) => (b.proposal_count || 0) - (a.proposal_count || 0));
    } else {
      list = [...list].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    }
    return list;
  }, [tasks, search, categoryId, location, budgetMin, budgetMax, verifiedOnly, sort]);

  const openPg = usePagination(filteredTasks, 12);
  const appliedPg = usePagination(appliedTasks, 12);
  const invitationsPg = usePagination(invitations, 12);

  useEffect(() => {
    if (!user) return;
    fetchAll();
  }, [user]);

  // Auto-open apply modal when arriving via ?apply=<taskId> (e.g. from Saved Jobs)
  useEffect(() => {
    const id = searchParams.get("apply");
    if (!id || !tasks.length || applyTask) return;
    const t = tasks.find((x) => x.id === id);
    if (t) {
      openApplyModal(t);
      searchParams.delete("apply");
      setSearchParams(searchParams, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, searchParams]);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);

    const [tasksRes, catsRes, servicesRes, myProposalsRes] = await Promise.all([
      supabase.from("tasks").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(50),
      supabase.from("service_categories").select("id, name"),
      supabase.from("vendor_services").select("id, title, category_id").eq("vendor_id", user.id).eq("is_active", true),
      supabase.from("task_proposals").select("*").eq("vendor_id", user.id),
    ]);

    const cats = new Map((catsRes.data || []).map((c: any) => [c.id, c.name]));
    setCategories((catsRes.data || []) as any);
    const allTasks = (tasksRes.data || []) as Task[];

    // Get customer names + employer verification + proposal counts (for "popular")
    const customerIds = [...new Set(allTasks.map(t => t.customer_id))];
    const taskIds = allTasks.map(t => t.id);
    const [profilesRes, employerRes, propCountRes] = await Promise.all([
      customerIds.length
        ? supabase.from("profiles").select("user_id, display_name").in("user_id", customerIds)
        : Promise.resolve({ data: [] as any[] }),
      customerIds.length
        ? supabase.from("employer_profiles").select("user_id, verification_status").in("user_id", customerIds)
        : Promise.resolve({ data: [] as any[] }),
      taskIds.length
        ? supabase.from("task_proposals").select("task_id").in("task_id", taskIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const customerNames = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p.display_name]));
    const verifiedMap = new Map(
      (employerRes.data || []).map((e: any) => [e.user_id, e.verification_status === "verified"])
    );
    const propCounts = new Map<string, number>();
    (propCountRes.data || []).forEach((p: any) => {
      propCounts.set(p.task_id, (propCounts.get(p.task_id) || 0) + 1);
    });

    const enrich = (t: Task): Task => ({
      ...t,
      category_name: cats.get(t.category_id) || "",
      customer_name: customerNames.get(t.customer_id) || "Customer",
      employer_verified: !!verifiedMap.get(t.customer_id),
      proposal_count: propCounts.get(t.id) || 0,
    });

    setServices(servicesRes.data || []);

    const allProposals = (myProposalsRes.data || []) as Proposal[];
    const appliedSet = new Set(allProposals.filter(p => p.direction === "vendor_applied").map(p => p.task_id));
    setAppliedTaskIds(appliedSet);

    // Open tab: tasks not yet applied to
    setTasks(allTasks.filter(t => !appliedSet.has(t.id)).map(enrich));

    // Applied tab: my vendor_applied proposals + their tasks
    const appliedProposals = allProposals.filter(p => p.direction === "vendor_applied");
    if (appliedProposals.length) {
      const ids = appliedProposals.map(p => p.task_id);
      const { data: appliedTasksData } = await supabase.from("tasks").select("*").in("id", ids);
      const taskMap = new Map((appliedTasksData || []).map((t: any) => [t.id, enrich(t)]));
      setAppliedTasks(
        appliedProposals
          .map(p => ({ proposal: p, task: taskMap.get(p.task_id)! }))
          .filter(x => x.task)
      );
    } else {
      setAppliedTasks([]);
    }

    // Invitations: customer_invited proposals to me
    const invProposals = allProposals.filter(p => p.direction === "customer_invited");
    if (invProposals.length) {
      const ids = invProposals.map(p => p.task_id);
      const { data: invTasksData } = await supabase.from("tasks").select("*").in("id", ids);
      const taskMap = new Map((invTasksData || []).map((t: any) => [t.id, enrich(t)]));
      setInvitations(
        invProposals
          .map(p => ({ proposal: p, task: taskMap.get(p.task_id)! }))
          .filter(x => x.task)
      );
    } else {
      setInvitations([]);
    }

    setLoading(false);
  };

  const openApplyModal = (task: Task) => {
    if (!subLoading && !subscriptionActive) {
      setUpgradePromptOpen(true);
      return;
    }
    setApplyTask(task);
    setServiceId(services.find(s => s.category_id === task.category_id)?.id || services[0]?.id || "");
    setQuotedPrice(task.budget_min ? String(task.budget_min) : "");
    setEtaDate(task.preferred_date || "");
    setMessage("");
    setDuration("");
    setAttachments([]);
  };

  const handleApply = async () => {
    if (!user || !applyTask) return;
    if (!subLoading && !subscriptionActive) {
      setApplyTask(null);
      setUpgradePromptOpen(true);
      return;
    }
    if (!serviceId) {
      toast.error("Please select a service");
      return;
    }
    setSubmitting(true);
    const { error } = await (supabase as any).rpc("apply_to_task", {
      p_task_id: applyTask.id,
      p_customer_id: applyTask.customer_id,
      p_service_id: serviceId,
      p_quoted_price: quotedPrice ? Number(quotedPrice) : null,
      p_eta_date: etaDate || null,
      p_message: message.trim() || null,
      p_estimated_duration: duration.trim() || null,
      p_attachments: attachments as any,
    });
    setSubmitting(false);
    if (error) {
      if (error.message?.includes("INSUFFICIENT_CREDITS")) {
        toast.error("You're out of lead credits. Please buy more to apply.");
      } else if (error.message?.toLowerCase().includes("already applied")) {
        toast.error("You have already applied to this task.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    await createNotification({
      userId: applyTask.customer_id,
      type: "proposal_received",
      title: "New proposal received",
      message: `A professional applied to your task "${applyTask.title}".`,
      metadata: { task_id: applyTask.id },
    });
    toast.success("Proposal sent!");
    setApplyTask(null);
    fetchAll();
  };

  const handleAcceptInvitation = async (item: { task: Task; proposal: Proposal }) => {
    const { error, bookingId } = await acceptProposal({
      proposalId: item.proposal.id,
      taskId: item.task.id,
      providerId: user!.id,
      customerId: item.task.customer_id,
      serviceId: item.proposal.service_id,
      quotedPrice: item.proposal.quoted_price,
      etaDate: item.proposal.eta_date,
      taskTitle: item.task.title,
      preferredTime: item.task.preferred_time,
    });
    if (error) toast.error(error);
    else {
      toast.success("Invitation accepted! Booking created.");
      fetchAll();
    }
  };

  const handleDeclineInvitation = async (item: { task: Task; proposal: Proposal }) => {
    await declineProposal(item.proposal.id, item.task.customer_id, item.task.title);
    toast.success("Invitation declined");
    fetchAll();
  };

  const handleWithdraw = async (proposalId: string) => {
    await withdrawProposal(proposalId);
    toast.success("Proposal withdrawn");
    fetchAll();
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user) return;
    setUploadingAtt(true);
    const urls: string[] = [];
    for (const f of files) {
      const path = `${user.id}/proposals/${Date.now()}-${f.name}`;
      const { error } = await supabase.storage.from("task-photos").upload(path, f);
      if (error) { toast.error(error.message); continue; }
      const { data } = supabase.storage.from("task-photos").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    setAttachments(prev => [...prev, ...urls]);
    setUploadingAtt(false);
    e.target.value = "";
  };

  const tabs = [
    { id: "open" as const, label: "Open Tasks", count: tasks.length, icon: ClipboardList },
    { id: "applied" as const, label: "My Proposals", count: appliedTasks.length, icon: Send },
    { id: "invitations" as const, label: "Invitations", count: invitations.filter(i => i.proposal.status === "pending").length, icon: Inbox },
  ];

  return (
    <DashboardLayout title="Task Marketplace" subtitle="Browse open tasks from customers and submit your proposals.">
      <div>
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-fs-sm font-medium border-b-2 transition-colors -mb-px",
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.count > 0 && (
                <span className={cn(
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums",
                  tab === t.id ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                )}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-fs-sm text-muted-foreground">Loading…</div>
        ) : tab === "open" ? (
          <>
            {/* Filters */}
            <div className="bg-card border border-border rounded-sm p-4 mb-4 grid gap-3 md:grid-cols-12">
              <div className="md:col-span-4 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs…" className="pl-9" />
              </div>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="md:col-span-2 px-3 py-2 rounded-sm border border-input bg-background text-fs-sm">
                <option value="">All categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location" className="md:col-span-2" />
              <Input value={budgetMin} onChange={e => setBudgetMin(e.target.value)} type="number" min={0} placeholder="Min $" className="md:col-span-1" />
              <Input value={budgetMax} onChange={e => setBudgetMax(e.target.value)} type="number" min={0} placeholder="Max $" className="md:col-span-1" />
              <select value={sort} onChange={e => setSort(e.target.value as any)} className="md:col-span-2 px-3 py-2 rounded-sm border border-input bg-background text-fs-sm">
                <option value="newest">Newest</option>
                <option value="popular">Popular</option>
              </select>
              <div className="md:col-span-12 flex items-center justify-between flex-wrap gap-2">
                <label className="flex items-center gap-2 text-fs-sm cursor-pointer">
                  <input type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} className="rounded-sm" />
                  <BadgeCheck className="w-4 h-4 text-primary" /> Verified employers only
                </label>
                {(search || categoryId || location || budgetMin || budgetMax || verifiedOnly) && (
                  <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setCategoryId(""); setLocation(""); setBudgetMin(""); setBudgetMax(""); setVerifiedOnly(false); }} className="gap-1.5">
                    <X className="w-3.5 h-3.5" /> Clear filters
                  </Button>
                )}
                <span className="text-fs-xs text-muted-foreground ml-auto">{filteredTasks.length} job{filteredTasks.length === 1 ? "" : "s"}</span>
              </div>
            </div>

            {filteredTasks.length === 0 ? (
              <EmptyTab icon={ClipboardList} text={tasks.length === 0 ? "No open tasks right now. Check back soon!" : "No jobs match your filters."} />
            ) : (
              <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {openPg.pageItems.map(t => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onApply={() => openApplyModal(t)}
                  gated={!subLoading && !subscriptionActive}
                  saved={savedIds.has(t.id)}
                  onToggleSave={() => toggleSaved(t.id)}
                />
              ))}
            </div>
            <NumberedPagination
              currentPage={openPg.page}
              totalPages={openPg.totalPages}
              onPageChange={openPg.setPage}
              totalItems={openPg.totalItems}
              pageSize={openPg.pageSize}
          onPageSizeChange={openPg.setPageSize}
            />
              </>
            )}
          </>
        ) : tab === "applied" ? (
          appliedTasks.length === 0 ? (
            <EmptyTab icon={Send} text="You haven't sent any proposals yet." />
          ) : (
            <>
            <div className="grid gap-4 md:grid-cols-2">
              {appliedPg.pageItems.map(({ task, proposal }) => (
                <ProposalCard
                  key={proposal.id}
                  task={task}
                  proposal={proposal}
                  onWithdraw={proposal.status === "pending" ? () => handleWithdraw(proposal.id) : undefined}
                  onCancelAccepted={proposal.status === "accepted" ? fetchAll : undefined}
                />
              ))}
            </div>
            <NumberedPagination
              currentPage={appliedPg.page}
              totalPages={appliedPg.totalPages}
              onPageChange={appliedPg.setPage}
              totalItems={appliedPg.totalItems}
              pageSize={appliedPg.pageSize}
          onPageSizeChange={appliedPg.setPageSize}
            />
            </>
          )
        ) : (
          invitations.length === 0 ? (
            <EmptyTab icon={Inbox} text="No invitations yet." />
          ) : (
            <>
            <div className="grid gap-4 md:grid-cols-2">
              {invitationsPg.pageItems.map(item => (
                <ProposalCard
                  key={item.proposal.id}
                  task={item.task}
                  proposal={item.proposal}
                  isInvitation
                  onAccept={item.proposal.status === "pending" ? () => handleAcceptInvitation(item) : undefined}
                  onDecline={item.proposal.status === "pending" ? () => handleDeclineInvitation(item) : undefined}
                />
              ))}
            </div>
            <NumberedPagination
              currentPage={invitationsPg.page}
              totalPages={invitationsPg.totalPages}
              onPageChange={invitationsPg.setPage}
              totalItems={invitationsPg.totalItems}
              pageSize={invitationsPg.pageSize}
          onPageSizeChange={invitationsPg.setPageSize}
            />
            </>
          )
        )}
      </div>

      {/* Apply Modal */}
      <Dialog open={!!applyTask} onOpenChange={(open) => !open && setApplyTask(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Proposal</DialogTitle>
            <DialogDescription className="line-clamp-2">{applyTask?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-fs-sm font-medium mb-1.5">Which service?</label>
              {services.length === 0 ? (
                <p className="text-fs-xs text-destructive">
                  You need to <Link to="/provider-services" className="underline">add a service</Link> first.
                </p>
              ) : (
                <select
                  value={serviceId}
                  onChange={e => setServiceId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-fs-sm"
                >
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-fs-sm font-medium mb-1.5">Your quoted price ($)</label>
              <Input type="number" min={0} value={quotedPrice} onChange={e => setQuotedPrice(e.target.value)} placeholder="e.g. 120" />
              {applyTask?.budget_min && (
                <p className="text-[13px] text-muted-foreground mt-1">
                  Customer budget: ${applyTask.budget_min}{applyTask.budget_max ? ` – $${applyTask.budget_max}` : "+"}
                </p>
              )}
            </div>
            <div>
              <label className="block text-fs-sm font-medium mb-1.5">Earliest start date</label>
              <Input type="date" value={etaDate} onChange={e => setEtaDate(e.target.value)} />
              {applyTask?.preferred_date && (
                <p className="text-[13px] text-muted-foreground mt-1">
                  Customer prefers: {format(new Date(applyTask.preferred_date + "T00:00:00"), "MMM d, yyyy")}
                </p>
              )}
            </div>
            <div>
              <label className="block text-fs-sm font-medium mb-1.5">Estimated duration</label>
              <Input value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 2 days, 4 hours" />
            </div>
            <div>
              <label className="block text-fs-sm font-medium mb-1.5">Attachments (optional)</label>
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleAttachmentUpload}
                disabled={uploadingAtt}
                className="block w-full text-fs-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-sm file:border-0 file:bg-muted file:text-foreground file:cursor-pointer"
              />
              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {attachments.map((u, i) => (
                    <li key={i} className="flex items-center justify-between text-fs-xs text-muted-foreground bg-muted/40 rounded-sm px-2 py-1">
                      <a href={u} target="_blank" rel="noreferrer" className="truncate underline">{u.split("/").pop()}</a>
                      <button type="button" onClick={() => setAttachments(a => a.filter((_, x) => x !== i))} className="text-destructive ml-2">Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className="block text-fs-sm font-medium mb-1.5">Pitch (optional)</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value.slice(0, 500))}
                rows={3}
                maxLength={500}
                placeholder="Why are you a great fit for this task?"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-fs-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyTask(null)}>Cancel</Button>
            <Button onClick={handleApply} disabled={submitting || !serviceId}>
              {submitting ? "Sending…" : "Send Proposal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription upgrade prompt */}
      <AlertDialog open={upgradePromptOpen} onOpenChange={setUpgradePromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Subscription required
            </AlertDialogTitle>
            <AlertDialogDescription>
              You need an active provider subscription to apply to jobs. Upgrade your plan to
              unlock unlimited proposals, direct client messaging, and priority placement in the
              feed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setUpgradePromptOpen(false); navigate("/provider-subscription"); }}>
              View plans
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

function EmptyTab({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="text-center py-16 border border-dashed border-border/60 rounded-sm">
      <Icon className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
      <p className="text-description-sm">{text}</p>
    </div>
  );
}

function TaskCard({
  task, onApply, saved, onToggleSave, gated,
}: {
  task: Task;
  onApply: () => void;
  saved?: boolean;
  onToggleSave?: () => void;
  gated?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-sm p-5 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <Heading level={3}  className="line-clamp-1 flex-1">{task.title}</Heading>
        <div className="flex items-center gap-1 shrink-0">
          {task.category_name && <Badge variant="secondary" className="text-[10px]">{task.category_name}</Badge>}
          {onToggleSave && (
            <button
              type="button"
              onClick={onToggleSave}
              aria-label={saved ? "Remove from saved" : "Save job"}
              className="p-1 -m-1 text-muted-foreground hover:text-primary transition-colors"
            >
              {saved
                ? <BookmarkCheck className="w-4 h-4 fill-primary text-primary" />
                : <Bookmark className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mb-2 text-fs-xs text-muted-foreground">
        <span className="truncate">{task.customer_name}</span>
        {task.employer_verified && (
          <span className="inline-flex items-center gap-1 text-primary font-medium">
            <BadgeCheck className="w-3.5 h-3.5" /> Verified
          </span>
        )}
        <span className="ml-auto">{task.proposal_count || 0} proposal{task.proposal_count === 1 ? "" : "s"}</span>
      </div>
      <p className="text-fs-xs text-muted-foreground line-clamp-2 mb-3">{task.description}</p>
      <div className="grid grid-cols-2 gap-2 text-fs-xs text-muted-foreground mb-4">
        <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /><span className="truncate">{task.address}</span></div>
        {task.preferred_date && (
          <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /><span>{format(new Date(task.preferred_date + "T00:00:00"), "MMM d")}</span></div>
        )}
        {task.budget_min !== null && (
          <div className="flex items-center gap-1.5 col-span-2"><DollarSign className="w-3 h-3" /><span>Budget: ${task.budget_min}{task.budget_max ? ` – $${task.budget_max}` : "+"}</span></div>
        )}
      </div>
      <Button
        size="sm"
        onClick={onApply}
        variant={gated ? "outline" : "default"}
        className="w-full gap-1.5"
        title={gated ? "Subscribe to apply to jobs" : undefined}
      >
        {gated ? <Lock className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
        {gated ? "Subscribe to apply" : "Apply"}
      </Button>
    </div>
  );
}

function ProposalCard({
  task, proposal, isInvitation, onAccept, onDecline, onWithdraw, onCancelAccepted,
}: {
  task: Task; proposal: Proposal; isInvitation?: boolean;
  onAccept?: () => void; onDecline?: () => void; onWithdraw?: () => void;
  onCancelAccepted?: () => void;
}) {
  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    accepted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    declined: "bg-destructive/10 text-destructive",
    withdrawn: "bg-muted text-muted-foreground",
  };
  return (
    <div className="bg-card border border-border rounded-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <Heading level={3}  className="line-clamp-1 flex-1">{task.title}</Heading>
        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize", statusColors[proposal.status])}>
          {proposal.status}
        </span>
      </div>
      <p className="text-fs-xs text-muted-foreground line-clamp-2 mb-3">{task.description}</p>
      <div className="space-y-1 text-fs-xs text-muted-foreground mb-3">
        {proposal.quoted_price !== null && <div>Quote: <span className="text-foreground font-medium">${Number(proposal.quoted_price).toFixed(2)}</span></div>}
        {proposal.eta_date && <div>Start: <span className="text-foreground font-medium">{format(new Date(proposal.eta_date + "T00:00:00"), "MMM d, yyyy")}</span></div>}
        {proposal.message && <div className="text-muted-foreground italic line-clamp-2 pt-1">"{proposal.message}"</div>}
      </div>
      {isInvitation && proposal.status === "pending" && (
        <div className="flex gap-2">
          <Button size="sm" onClick={onAccept} className="flex-1 gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Accept</Button>
          <Button size="sm" variant="outline" onClick={onDecline} className="flex-1 gap-1.5"><XCircle className="w-3.5 h-3.5" /> Decline</Button>
        </div>
      )}
      {!isInvitation && onWithdraw && (
        <Button size="sm" variant="outline" onClick={onWithdraw} className="w-full gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Withdraw
        </Button>
      )}
      {!isInvitation && onCancelAccepted && (
        <CancelJobButton
          taskId={task.id}
          role="provider"
          className="w-full"
          onCancelled={onCancelAccepted}
        />
      )}
    </div>
  );
}
