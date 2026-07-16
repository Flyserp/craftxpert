import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, BadgeCheck, Clock, AlertCircle, Inbox, History, Check, X, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  STATUS_META,
  type VerificationRow,
  type VerificationStatus,
} from "@/lib/verification";
import AdminVerificationReviewDialog from "@/components/admin/verifications/ReviewDialog";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { Heading } from "@/components/ui/app";

type RowWithVendor = VerificationRow & {
  vendor_name?: string | null;
  vendor_email?: string | null;
};

interface HistoryEntry {
  id: string;
  action: string;
  entity_id: string | null;
  target_user_id: string | null;
  actor_id: string | null;
  details: any;
  created_at: string;
  actor_name?: string | null;
  target_name?: string | null;
}

/** Admin vendor verification queue. */
export default function AdminVerificationsPage() {
  const [rows, setRows] = useState<RowWithVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<VerificationStatus | "all" | "history">("pending");
  const [search, setSearch] = useState("");
  const [activeRow, setActiveRow] = useState<RowWithVendor | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState<"oldest" | "newest" | "updated_desc" | "updated_asc">("oldest");
  const [docFilter, setDocFilter] = useState<"all" | "complete" | "incomplete">("all");
  const [updatedWithin, setUpdatedWithin] = useState<"any" | "24h" | "7d" | "30d">("any");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    const { data: verifs } = await supabase
      .from("vendor_verifications")
      .select("*")
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    const ids = (verifs ?? []).map((r) => r.vendor_id);
    let nameMap: Record<string, string> = {};
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p.display_name ?? ""]));
    }
    setRows(
      (verifs ?? []).map((r) => ({
        ...r,
        vendor_name: nameMap[r.vendor_id] ?? null,
      })),
    );
    setLoading(false);
  };

  const isComplete = (r: RowWithVendor) =>
    !!(r.government_id_url && r.proof_of_address_url && (r.business_registration_url || r.professional_license_url));

  const toggleOne = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const bulkReview = async (action: "approve" | "reject") => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    const { data: userData } = await supabase.auth.getUser();
    const patch =
      action === "approve"
        ? { status: "approved" as const, reviewed_at: new Date().toISOString(), reviewed_by: userData.user?.id ?? null, rejection_note: null, rejection_reasons: [] }
        : { status: "rejected" as const, reviewed_at: new Date().toISOString(), reviewed_by: userData.user?.id ?? null, rejection_note: "Bulk rejected — please review your submission.", rejection_reasons: [] };
    const { error } = await supabase.from("vendor_verifications").update(patch).in("id", ids);
    setBulkBusy(false);
    if (error) return toast.error(`Bulk ${action} failed`);
    toast.success(`${ids.length} verification${ids.length > 1 ? "s" : ""} ${action === "approve" ? "approved" : "rejected"}`);
    setSelected(new Set());
    fetchRows();
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    const { data: logs } = await supabase
      .from("admin_audit_log")
      .select("id, action, entity_id, target_user_id, actor_id, details, created_at")
      .like("action", "verification.%")
      .order("created_at", { ascending: false })
      .limit(100);

    const userIds = Array.from(new Set(
      (logs ?? []).flatMap((l) => [l.actor_id, l.target_user_id]).filter(Boolean) as string[]
    ));
    let names: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      names = Object.fromEntries((profs ?? []).map((p) => [p.user_id, p.display_name ?? ""]));
    }
    setHistory((logs ?? []).map((l) => ({
      ...l,
      actor_name: l.actor_id ? names[l.actor_id] ?? null : null,
      target_name: l.target_user_id ? names[l.target_user_id] ?? null : null,
    })));
    setHistoryLoading(false);
  };

  useEffect(() => {
    fetchRows();
  }, []);

  useEffect(() => {
    if (tab === "history") fetchHistory();
  }, [tab]);

  useEffect(() => {
    setSelected(new Set());
    setDocFilter("all");
    setUpdatedWithin("any");
    setSortOrder(tab === "pending" ? "oldest" : "updated_desc");
  }, [tab]);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, draft: 0, info_requested: 0 };
    rows.forEach((r) => {
      if ((c as Record<string, number>)[r.status] !== undefined) {
        (c as Record<string, number>)[r.status]++;
      }
    });
    return c;
  }, [rows]);

  const lastUpdatedAt = (r: RowWithVendor) =>
    new Date((r.reviewed_at ?? r.updated_at ?? r.submitted_at ?? r.created_at) as string).getTime();

  const filtered = useMemo(() => {
    const cutoffMs =
      updatedWithin === "24h" ? 24 * 60 * 60 * 1000 :
      updatedWithin === "7d"  ? 7 * 24 * 60 * 60 * 1000 :
      updatedWithin === "30d" ? 30 * 24 * 60 * 60 * 1000 : null;
    const now = Date.now();
    const list = rows.filter((r) => {
      if (tab !== "all" && r.status !== tab) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${r.business_name ?? ""} ${r.legal_name ?? ""} ${r.vendor_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (docFilter === "complete" && !isComplete(r)) return false;
      if (docFilter === "incomplete" && isComplete(r)) return false;
      if (cutoffMs !== null && now - lastUpdatedAt(r) > cutoffMs) return false;
      return true;
    });
    list.sort((a, b) => {
      if (sortOrder === "updated_desc" || sortOrder === "updated_asc") {
        const au = lastUpdatedAt(a);
        const bu = lastUpdatedAt(b);
        return sortOrder === "updated_desc" ? bu - au : au - bu;
      }
      const ad = new Date(a.submitted_at ?? a.created_at).getTime();
      const bd = new Date(b.submitted_at ?? b.created_at).getTime();
      return sortOrder === "oldest" ? ad - bd : bd - ad;
    });
    return list;
  }, [rows, tab, search, docFilter, sortOrder, updatedWithin]);

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(filtered, 15);

  const openReview = (r: RowWithVendor) => {
    setActiveRow(r);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <Heading level={1}  className="mb-1">Vendor verifications</Heading>
        <p className="text-fs-sm text-muted-foreground">
          Review submitted KYC documents and approve or reject vendor applications.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Pending",  value: counts.pending,  icon: Clock,       tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
          { label: "Approved", value: counts.approved, icon: BadgeCheck,  tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
          { label: "Rejected", value: counts.rejected, icon: AlertCircle, tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
          { label: "Total",    value: rows.length,     icon: BadgeCheck,  tone: "bg-primary/10 text-primary" },
        ].map((s) => (
          <Card key={s.label} className="p-4 flex items-center justify-between">
            <div>
              <p className="text-fs-xs text-muted-foreground font-medium">{s.label}</p>
              <p className="text-fs-2xl font-bold text-heading tabular-nums">{s.value}</p>
            </div>
            <div className={cn("w-9 h-9 rounded-sm flex items-center justify-center", s.tone)}>
              <s.icon className="w-4 h-4" />
            </div>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList>
            <TabsTrigger value="pending" className="gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Pending
              <span className="ml-1 text-[10px] font-semibold opacity-70">{counts.pending}</span>
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-1.5">
              <BadgeCheck className="w-3.5 h-3.5" /> Approved
              <span className="ml-1 text-[10px] font-semibold opacity-70">{counts.approved}</span>
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Rejected
              <span className="ml-1 text-[10px] font-semibold opacity-70">{counts.rejected}</span>
            </TabsTrigger>
            <TabsTrigger value="info_requested" className="gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" /> Info requested
              <span className="ml-1 text-[10px] font-semibold opacity-70">{counts.info_requested}</span>
            </TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="w-3.5 h-3.5" /> History
            </TabsTrigger>
          </TabsList>
          {tab !== "history" && <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendor or business…"
              className="pl-8 h-9 text-fs-sm"
            />
          </div>}
        </div>
      </Tabs>

      {tab !== "history" && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as typeof sortOrder)}>
            <SelectTrigger className="h-9 w-48 text-fs-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="oldest">Submitted · Oldest first</SelectItem>
              <SelectItem value="newest">Submitted · Newest first</SelectItem>
              <SelectItem value="updated_desc">Last updated · Newest</SelectItem>
              <SelectItem value="updated_asc">Last updated · Oldest</SelectItem>
            </SelectContent>
          </Select>
          <Select value={updatedWithin} onValueChange={(v) => setUpdatedWithin(v as typeof updatedWithin)}>
            <SelectTrigger className="h-9 w-44 text-fs-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any time</SelectItem>
              <SelectItem value="24h">Updated · last 24 h</SelectItem>
              <SelectItem value="7d">Updated · last 7 days</SelectItem>
              <SelectItem value="30d">Updated · last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={docFilter} onValueChange={(v) => setDocFilter(v as typeof docFilter)}>
            <SelectTrigger className="h-9 w-44 text-fs-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All documents</SelectItem>
              <SelectItem value="complete">Complete docs</SelectItem>
              <SelectItem value="incomplete">Incomplete docs</SelectItem>
            </SelectContent>
          </Select>
          {tab === "pending" && selected.size > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-fs-xs text-muted-foreground">{selected.size} selected</span>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkReview("reject")}>
                {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                Bulk reject
              </Button>
              <Button size="sm" disabled={bulkBusy} onClick={() => bulkReview("approve")}>
                {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Bulk approve
              </Button>
            </div>
          )}
        </div>
      )}

      {tab === "history" ? (
        historyLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : history.length === 0 ? (
          <Card className="p-10 text-center">
            <History className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-fs-sm font-medium">No history yet</p>
            <p className="text-fs-xs text-muted-foreground mt-1">Approvals and rejections will appear here.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {history.map((h) => {
              const isApproved = h.action.endsWith(".approved");
              const isRejected = h.action.endsWith(".rejected");
              const Icon = isApproved ? BadgeCheck : isRejected ? AlertCircle : Clock;
              const tone = isApproved
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : isRejected
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400";
              return (
                <Card key={h.id} className="p-3 flex items-start gap-3">
                  <div className={cn("w-8 h-8 rounded-sm flex items-center justify-center shrink-0", tone)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-fs-sm">
                      <span className="font-medium">{h.actor_name || "Admin"}</span>
                      {" "}{isApproved ? "approved" : isRejected ? "rejected" : h.action.replace("verification.", "")}{" "}
                      verification for{" "}
                      <span className="font-medium">{h.target_name || h.details?.business_name || "vendor"}</span>
                    </p>
                    {h.details?.rejection_note && (
                      <p className="text-fs-xs text-muted-foreground mt-0.5 italic">"{h.details.rejection_note}"</p>
                    )}
                    <p className="text-fs-xs text-muted-foreground mt-0.5">
                      {new Date(h.created_at).toLocaleString()}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Inbox className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-fs-sm font-medium text-foreground">Nothing to review</p>
          <p className="text-fs-xs text-muted-foreground mt-1">
            {tab === "pending"
              ? "No vendors are waiting for review right now."
              : "No verifications match your filters."}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {tab === "pending" && pageItems.length > 0 && (
            <div className="flex items-center gap-2 px-1 pb-1">
              <Checkbox
                checked={pageItems.every((r) => selected.has(r.id))}
                onCheckedChange={(c) => {
                  setSelected((s) => {
                    const next = new Set(s);
                    if (c) pageItems.forEach((r) => next.add(r.id));
                    else pageItems.forEach((r) => next.delete(r.id));
                    return next;
                  });
                }}
              />
              <span className="text-fs-xs text-muted-foreground">Select all on page</span>
            </div>
          )}
          {pageItems.map((r) => {
            const meta = STATUS_META[r.status];
            return (
              <Card
                key={r.id}
                className="p-4 flex items-center gap-4 cursor-pointer transition-colors hover:bg-muted/40"
                onClick={() => openReview(r)}
              >
                {tab === "pending" && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={() => toggleOne(r.id)}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-fs-sm font-semibold text-foreground truncate">
                      {r.business_name || r.vendor_name || "Unnamed vendor"}
                    </p>
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold", meta.tone)}>
                      {meta.label}
                    </span>
                    {!isComplete(r) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        Incomplete
                      </span>
                    )}
                  </div>
                  <p className="text-fs-xs text-muted-foreground">
                    {r.vendor_name && r.business_name ? `${r.vendor_name} · ` : ""}
                    Submitted{" "}
                    {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : "—"}
                    {" · Updated "}
                    {new Date(lastUpdatedAt(r)).toLocaleString()}
                  </p>
                </div>
                <Button size="sm" variant="outline">
                  Review
                </Button>
              </Card>
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

      <AdminVerificationReviewDialog
        row={activeRow}
        vendorName={activeRow?.vendor_name ?? undefined}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onReviewed={fetchRows}
      />
    </div>
  );
}
