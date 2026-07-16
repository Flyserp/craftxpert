import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  MapPin, Calendar, DollarSign, ArrowLeft, CheckCircle2, XCircle, Clock,
  User, MessageSquare, Inbox, Send, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { acceptProposal, declineProposal, shortlistProposal } from "@/lib/taskProposals";
import { Star, Paperclip } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { Heading } from "@/components/ui/app";
import CancelJobButton from "@/components/jobs/CancelJobButton";

interface TaskDetail {
  id: string;
  title: string;
  description: string;
  address: string;
  preferred_date: string | null;
  preferred_time: string | null;
  budget_min: number | null;
  budget_max: number | null;
  status: string;
  customer_id: string;
  category_id: string;
  created_at: string;
  photos: string[] | null;
}

interface ProposalWithVendor {
  id: string;
  vendor_id: string;
  service_id: string | null;
  quoted_price: number | null;
  eta_date: string | null;
  message: string | null;
  status: string;
  direction: string;
  created_at: string;
  booking_id: string | null;
  estimated_duration: string | null;
  attachments: string[];
  vendor_name: string;
  vendor_avatar: string | null;
  service_title: string | null;
}

export default function ClientTaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [proposals, setProposals] = useState<ProposalWithVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId || !user) return;
    fetchAll();
  }, [taskId, user]);

  const fetchAll = async () => {
    if (!taskId || !user) return;
    setLoading(true);

    const { data: taskData, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .eq("customer_id", user.id)
      .single();

    if (error || !taskData) {
      toast.error("Task not found");
      navigate("/client-dashboard");
      return;
    }
    setTask(taskData as TaskDetail);

    // Fetch proposals
    const { data: propData } = await supabase
      .from("task_proposals")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    if (propData && propData.length > 0) {
      const providerIds = [...new Set(propData.map((p: any) => p.vendor_id))];
      const serviceIds = [...new Set(propData.map((p: any) => p.service_id).filter(Boolean))];
      const [profilesRes, servicesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", providerIds),
        serviceIds.length
          ? supabase.from("vendor_services").select("id, title").in("id", serviceIds)
          : Promise.resolve({ data: [] }),
      ]);
      const vendorMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p]));
      const serviceMap = new Map((servicesRes.data || []).map((s: any) => [s.id, s.title]));

      setProposals(
        propData.map((p: any) => ({
          ...p,
          attachments: Array.isArray(p.attachments) ? p.attachments : [],
          vendor_name: vendorMap.get(p.vendor_id)?.display_name || "Provider",
          vendor_avatar: vendorMap.get(p.vendor_id)?.avatar_url || null,
          service_title: p.service_id ? serviceMap.get(p.service_id) || null : null,
        }))
      );
    } else {
      setProposals([]);
    }

    setLoading(false);
  };

  const handleAccept = async (p: ProposalWithVendor) => {
    if (!task) return;
    setActionLoading(p.id);
    const { error, bookingId } = await acceptProposal({
      proposalId: p.id,
      taskId: task.id,
      providerId: p.vendor_id,
      customerId: task.customer_id,
      serviceId: p.service_id,
      quotedPrice: p.quoted_price,
      etaDate: p.eta_date,
      taskTitle: task.title,
      preferredTime: task.preferred_time,
    });
    setActionLoading(null);
    if (error) toast.error(error);
    else {
      toast.success("Proposal accepted! Booking created.");
      fetchAll();
    }
  };

  const handleDecline = async (p: ProposalWithVendor) => {
    if (!task) return;
    setActionLoading(p.id);
    await declineProposal(p.id, p.vendor_id, task.title);
    setActionLoading(null);
    toast.success("Proposal declined");
    fetchAll();
  };

  const handleShortlist = async (p: ProposalWithVendor) => {
    if (!task) return;
    setActionLoading(p.id);
    await shortlistProposal(p.id, p.vendor_id, task.title);
    setActionLoading(null);
    toast.success("Provider shortlisted");
    fetchAll();
  };

  if (loading || !task) {
    return (
      <DashboardLayout title="Task Details">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const applications = proposals.filter(p => p.direction === "vendor_applied");
  const invitations = proposals.filter(p => p.direction === "customer_invited");
  const acceptedProposal = proposals.find(p => p.status === "accepted");
  const applicationsPg = usePagination(applications, 8);
  const invitationsPg = usePagination(invitations, 8);

  return (
    <DashboardLayout title={task.title} subtitle="Review proposals and assign a professional to your task.">
      <div className="max-w-4xl space-y-6">
        <Link to="/client-dashboard" className="inline-flex items-center gap-1 text-fs-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
        </Link>

        {/* Task Summary */}
        <div className="bg-card border border-border rounded-sm p-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <Heading level={1} >{task.title}</Heading>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">{task.status.replace("_", " ")}</Badge>
              {!["cancelled", "completed", "expired"].includes(task.status) && (
                <CancelJobButton taskId={task.id} role="customer" onCancelled={fetchAll} />
              )}
            </div>
          </div>
          <p className="text-description-sm mb-4 whitespace-pre-wrap">{task.description}</p>
          <div className="grid sm:grid-cols-3 gap-3 text-fs-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" /><span className="truncate">{task.address}</span>
            </div>
            {task.preferred_date && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>{format(new Date(task.preferred_date + "T00:00:00"), "MMM d, yyyy")}{task.preferred_time && ` • ${task.preferred_time}`}</span>
              </div>
            )}
            {task.budget_min !== null && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="w-3.5 h-3.5" />
                <span>${task.budget_min}{task.budget_max ? ` – $${task.budget_max}` : "+"}</span>
              </div>
            )}
          </div>
          {task.photos && task.photos.length > 0 && (
            <div className="grid grid-cols-5 gap-2 mt-4">
              {task.photos.map((url, i) => (
                <img key={i} src={url} alt="" className="aspect-square object-cover rounded-lg border border-border" />
              ))}
            </div>
          )}
        </div>

        {acceptedProposal && (
          <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-sm p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-fs-sm font-semibold text-heading">{acceptedProposal.vendor_name} is assigned to this task</p>
              <p className="text-fs-xs text-muted-foreground mt-0.5">A booking has been created. View it in your bookings.</p>
            </div>
            {acceptedProposal.booking_id && (
              <Button size="sm" variant="outline" asChild>
                <Link to="/client-dashboard">View Booking</Link>
              </Button>
            )}
          </div>
        )}

        {/* Applications */}
        <Section
          icon={Inbox}
          title="Applications"
          count={applications.length}
          empty="No professionals have applied yet. Browse providers and invite them directly."
        >
          {applicationsPg.pageItems.map(p => (
            <ProposalRow
              key={p.id}
              proposal={p}
              onAccept={!acceptedProposal && (p.status === "pending" || p.status === "shortlisted") ? () => handleAccept(p) : undefined}
              onShortlist={!acceptedProposal && p.status === "pending" ? () => handleShortlist(p) : undefined}
              onDecline={(p.status === "pending" || p.status === "shortlisted") ? () => handleDecline(p) : undefined}
              loading={actionLoading === p.id}
            />
          ))}
          <NumberedPagination
            currentPage={applicationsPg.page}
            totalPages={applicationsPg.totalPages}
            totalItems={applicationsPg.totalItems}
            pageSize={applicationsPg.pageSize}
            onPageChange={applicationsPg.setPage}
          onPageSizeChange={applicationsPg.setPageSize}
          />
        </Section>

        {/* Invitations sent */}
        <Section
          icon={Send}
          title="Invitations Sent"
          count={invitations.length}
          empty="You haven't invited any providers yet. Use AI Match or visit a provider profile to invite them."
        >
          {invitations.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 -mt-1 mb-1">
              <StatusPill label="Pending" count={invitations.filter(p => p.status === "pending").length} tone="amber" />
              <StatusPill label="Accepted" count={invitations.filter(p => p.status === "accepted").length} tone="emerald" />
              <StatusPill label="Declined" count={invitations.filter(p => p.status === "declined").length} tone="destructive" />
            </div>
          )}
          {invitationsPg.pageItems.map(p => (
            <ProposalRow key={p.id} proposal={p} loading={actionLoading === p.id} />
          ))}
          <NumberedPagination
            currentPage={invitationsPg.page}
            totalPages={invitationsPg.totalPages}
            totalItems={invitationsPg.totalItems}
            pageSize={invitationsPg.pageSize}
            onPageChange={invitationsPg.setPage}
          onPageSizeChange={invitationsPg.setPageSize}
          />
        </Section>
      </div>
    </DashboardLayout>
  );
}

function Section({
  icon: Icon, title, count, children, empty,
}: { icon: any; title: string; count: number; children: React.ReactNode; empty: string; }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <Heading level={2} >{title}</Heading>
        <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full tabular-nums">{count}</span>
      </div>
      {count === 0 ? (
        <div className="text-fs-xs text-muted-foreground border border-dashed border-border/60 rounded-sm py-8 text-center">{empty}</div>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </div>
  );
}

function StatusPill({ label, count, tone }: { label: string; count: number; tone: "amber" | "emerald" | "destructive" }) {
  const toneClass =
    tone === "amber" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
    : tone === "emerald" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : "bg-destructive/10 text-destructive";
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full", toneClass)}>
      <span className="tabular-nums">{count}</span> {label}
    </span>
  );
}

function ProposalRow({
  proposal, onAccept, onDecline, onShortlist, loading,
}: { proposal: ProposalWithVendor; onAccept?: () => void; onDecline?: () => void; onShortlist?: () => void; loading?: boolean; }) {
  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    accepted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    declined: "bg-destructive/10 text-destructive",
    withdrawn: "bg-muted text-muted-foreground",
    shortlisted: "bg-primary/10 text-primary",
  };

  return (
    <div className="bg-card border border-border rounded-sm p-4">
      <div className="flex items-start gap-3 mb-3">
        <Link to={`/provider/${proposal.vendor_id}`} className="shrink-0">
          {proposal.vendor_avatar ? (
            <img src={proposal.vendor_avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/provider/${proposal.vendor_id}`} className="text-fs-sm font-semibold text-heading hover:underline">
            {proposal.vendor_name}
          </Link>
          {proposal.service_title && (
            <p className="text-fs-xs text-muted-foreground">{proposal.service_title}</p>
          )}
        </div>
        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize", statusColors[proposal.status])}>
          {proposal.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-fs-xs mb-3">
        {proposal.quoted_price !== null && (
          <div>
            <div className="text-muted-foreground">Quote</div>
            <div className="text-foreground font-semibold">${Number(proposal.quoted_price).toFixed(2)}</div>
          </div>
        )}
        {proposal.eta_date && (
          <div>
            <div className="text-muted-foreground">Earliest start</div>
            <div className="text-foreground font-semibold">{format(new Date(proposal.eta_date + "T00:00:00"), "MMM d, yyyy")}</div>
          </div>
        )}
        {proposal.estimated_duration && (
          <div>
            <div className="text-muted-foreground">Estimated duration</div>
            <div className="text-foreground font-semibold">{proposal.estimated_duration}</div>
          </div>
        )}
      </div>

      {proposal.message && (
        <p className="text-fs-xs text-muted-foreground italic bg-muted/30 rounded-lg p-2.5 mb-3">"{proposal.message}"</p>
      )}

      {proposal.attachments && proposal.attachments.length > 0 && (
        <div className="mb-3 space-y-1">
          {proposal.attachments.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-fs-xs text-primary hover:underline">
              <Paperclip className="w-3 h-3" /> Attachment {i + 1}
            </a>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant="outline" asChild className="gap-1.5">
          <Link to={`/provider/${proposal.vendor_id}`}><User className="w-3.5 h-3.5" /> View Profile</Link>
        </Button>
        {onShortlist && (
          <Button size="sm" variant="outline" onClick={onShortlist} disabled={loading} className="gap-1.5 ml-auto">
            <Star className="w-3.5 h-3.5" /> Shortlist
          </Button>
        )}
        {onAccept && (
          <Button size="sm" onClick={onAccept} disabled={loading} className={cn("gap-1.5", !onShortlist && "ml-auto")}>
            <CheckCircle2 className="w-3.5 h-3.5" /> Accept
          </Button>
        )}
        {onDecline && (
          <Button size="sm" variant="outline" onClick={onDecline} disabled={loading} className="gap-1.5">
            <XCircle className="w-3.5 h-3.5" /> Decline
          </Button>
        )}
      </div>
    </div>
  );
}
