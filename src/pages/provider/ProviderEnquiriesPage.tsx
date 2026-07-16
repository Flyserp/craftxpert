import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Inbox,
  MessageSquare,
  Archive,
  ArchiveRestore,
  Check,
  X,
  Calendar,
  DollarSign,
  Loader2,
  Search,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { acceptProposal, declineProposal } from "@/lib/taskProposals";
import NumberedPagination from "@/components/common/NumberedPagination";
import { usePagination } from "@/hooks/usePagination";

interface EnquiryRow {
  id: string;
  task_id: string;
  customer_id: string;
  service_id: string | null;
  quoted_price: number | null;
  eta_date: string | null;
  message: string | null;
  status: string; // pending, accepted, declined, withdrawn
  created_at: string;
  task_title: string;
  task_address: string | null;
  task_preferred_time: string | null;
  customer_name: string;
  customer_avatar: string | null;
}

type FilterKey = "new" | "replied" | "archived";

const ARCHIVE_STORAGE_KEY = (uid: string) => `provider-enquiries-archived:${uid}`;

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

function loadArchived(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY(uid));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveArchived(uid: string, set: Set<string>) {
  localStorage.setItem(ARCHIVE_STORAGE_KEY(uid), JSON.stringify([...set]));
}

export default function ProviderEnquiriesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterKey>("new");
  const [query, setQuery] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) setArchived(loadArchived(user.id));
  }, [user]);

  const refresh = async () => {
    if (!user) return;
    setLoading(true);

    const { data: rows, error } = await supabase
      .from("task_proposals")
      .select(
        "id, task_id, customer_id, service_id, quoted_price, eta_date, message, status, created_at"
      )
      .eq("vendor_id", user.id)
      .eq("direction", "customer_invited")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const proposals = rows ?? [];
    if (proposals.length === 0) {
      setEnquiries([]);
      setLoading(false);
      return;
    }

    const taskIds = [...new Set(proposals.map((p) => p.task_id))];
    const customerIds = [...new Set(proposals.map((p) => p.customer_id))];

    const [tasksRes, profilesRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, address, preferred_time")
        .in("id", taskIds),
      supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", customerIds),
    ]);

    const taskMap = new Map(
      (tasksRes.data ?? []).map((t) => [t.id, t])
    );
    const profileMap = new Map(
      (profilesRes.data ?? []).map((p) => [p.user_id, p])
    );

    const merged: EnquiryRow[] = proposals.map((p) => {
      const t = taskMap.get(p.task_id);
      const c = profileMap.get(p.customer_id);
      return {
        ...p,
        task_title: t?.title ?? "Untitled task",
        task_address: t?.address ?? null,
        task_preferred_time: t?.preferred_time ?? null,
        customer_name: c?.display_name?.trim() || "Customer",
        customer_avatar: c?.avatar_url ?? null,
      };
    });

    setEnquiries(merged);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const counts = useMemo(() => {
    let n = 0,
      r = 0,
      a = 0;
    enquiries.forEach((e) => {
      if (archived.has(e.id)) {
        a += 1;
        return;
      }
      if (e.status === "pending") n += 1;
      else r += 1;
    });
    return { new: n, replied: r, archived: a };
  }, [enquiries, archived]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enquiries.filter((e) => {
      const isArchived = archived.has(e.id);
      if (filter === "archived" && !isArchived) return false;
      if (filter !== "archived" && isArchived) return false;
      if (filter === "new" && e.status !== "pending") return false;
      if (filter === "replied" && e.status === "pending") return false;
      if (q) {
        const hay =
          `${e.task_title} ${e.customer_name} ${e.message ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enquiries, archived, filter, query]);

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(filtered, 10);

  useEffect(() => {
    setPage(1);
  }, [filter, query, setPage]);

  const toggleArchive = (id: string) => {
    if (!user) return;
    const next = new Set(archived);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setArchived(next);
    saveArchived(user.id, next);
  };

  const handleAccept = async (e: EnquiryRow) => {
    if (!user) return;
    setActingId(e.id);
    const res = await acceptProposal({
      proposalId: e.id,
      taskId: e.task_id,
      providerId: user.id,
      customerId: e.customer_id,
      serviceId: e.service_id,
      quotedPrice: e.quoted_price,
      etaDate: e.eta_date,
      taskTitle: e.task_title,
      preferredTime: e.task_preferred_time,
    });
    setActingId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Enquiry accepted — booking created.");
    refresh();
  };

  const handleDecline = async (e: EnquiryRow) => {
    setActingId(e.id);
    await declineProposal(e.id, e.customer_id, e.task_title);
    setActingId(null);
    toast.success("Enquiry declined.");
    refresh();
  };

  const handleMessage = async (customerId: string) => {
    if (!user) return;
    setActingId(customerId);
    try {
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(participant_1.eq.${user.id},participant_2.eq.${customerId}),and(participant_1.eq.${customerId},participant_2.eq.${user.id})`
        )
        .maybeSingle();
      let convoId = existing?.id;
      if (!convoId) {
        const { data: created, error } = await supabase
          .from("conversations")
          .insert({ participant_1: user.id, participant_2: customerId })
          .select("id")
          .single();
        if (error) throw error;
        convoId = created.id;
      }
      navigate(`/chat/${convoId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not open chat.";
      toast.error(message);
    } finally {
      setActingId(null);
    }
  };

  return (
    <DashboardLayout
      title="Enquiries"
      subtitle="Direct invitations from customers asking you to quote on a task."
    >
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by task, customer, or message…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="new" className="gap-1.5">
            New
            {counts.new > 0 && (
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-[10px] bg-primary text-primary-foreground"
              >
                {counts.new}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="replied" className="gap-1.5">
            Replied
            {counts.replied > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {counts.replied}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="archived" className="gap-1.5">
            Archived
            {counts.archived > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {counts.archived}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="m-0">
          {loading ? (
            <div className="rounded-sm border border-border bg-card p-10 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading enquiries…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-sm border border-border bg-card p-10 text-center">
              <Inbox className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-description-sm">
                {filter === "new" && "No new enquiries. You're all caught up!"}
                {filter === "replied" && "No replied enquiries yet."}
                {filter === "archived" && "Nothing archived."}
              </p>
            </div>
          ) : (
            <>
              <ul className="space-y-3">
                {pageItems.map((e) => (
                  <EnquiryCard
                    key={e.id}
                    enquiry={e}
                    isArchived={archived.has(e.id)}
                    acting={actingId === e.id || actingId === e.customer_id}
                    onAccept={() => handleAccept(e)}
                    onDecline={() => handleDecline(e)}
                    onMessage={() => handleMessage(e.customer_id)}
                    onToggleArchive={() => toggleArchive(e.id)}
                  />
                ))}
              </ul>
              <NumberedPagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={totalItems}
                pageSize={pageSize}
          onPageSizeChange={setPageSize}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

function EnquiryCard({
  enquiry: e,
  isArchived,
  acting,
  onAccept,
  onDecline,
  onMessage,
  onToggleArchive,
}: {
  enquiry: EnquiryRow;
  isArchived: boolean;
  acting: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onMessage: () => void;
  onToggleArchive: () => void;
}) {
  const isPending = e.status === "pending";
  const statusLabel: Record<string, string> = {
    pending: "Awaiting reply",
    accepted: "Accepted",
    declined: "Declined",
    withdrawn: "Withdrawn",
  };
  const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "default",
    accepted: "secondary",
    declined: "destructive",
    withdrawn: "outline",
  };

  return (
    <li className="rounded-sm border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          {e.customer_avatar && (
            <AvatarImage src={e.customer_avatar} alt={e.customer_name} />
          )}
          <AvatarFallback className="bg-primary/10 text-primary text-fs-xs font-semibold">
            {initials(e.customer_name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <p className="text-fs-sm font-semibold text-foreground truncate">
                {e.customer_name}
              </p>
              <p className="text-fs-xs text-muted-foreground">
                {format(new Date(e.created_at), "MMM d, h:mm a")}
              </p>
            </div>
            <Badge
              variant={statusVariant[e.status] ?? "outline"}
              className={cn(
                "text-[10px] h-5",
                e.status === "pending" && "bg-primary text-primary-foreground"
              )}
            >
              {statusLabel[e.status] ?? e.status}
            </Badge>
          </div>

          <p className="mt-2 text-fs-sm font-medium text-foreground line-clamp-1">
            {e.task_title}
          </p>

          {e.message && (
            <p className="mt-1 text-fs-sm text-muted-foreground line-clamp-2">
              "{e.message}"
            </p>
          )}

          <div className="mt-2 flex items-center flex-wrap gap-x-3 gap-y-1 text-fs-xs text-muted-foreground">
            {e.eta_date && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(e.eta_date), "MMM d, yyyy")}
              </span>
            )}
            {e.quoted_price != null && (
              <span className="inline-flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                ${Number(e.quoted_price).toFixed(0)}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="mt-3 flex flex-wrap gap-2">
            {isPending && !isArchived && (
              <>
                <Button
                  size="sm"
                  onClick={onAccept}
                  disabled={acting}
                  className="gap-1.5"
                >
                  {acting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDecline}
                  disabled={acting}
                  className="gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Decline
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onMessage}
              disabled={acting}
              className="gap-1.5"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Message
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onToggleArchive}
              className="gap-1.5 ml-auto"
            >
              {isArchived ? (
                <>
                  <ArchiveRestore className="h-3.5 w-3.5" />
                  Unarchive
                </>
              ) : (
                <>
                  <Archive className="h-3.5 w-3.5" />
                  Archive
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}
