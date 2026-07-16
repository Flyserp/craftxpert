import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ShieldCheck,
  Flag,
  MessageSquareWarning,
  RefreshCcw,
  Clock,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Lock,
  Unlock,
  UserCheck,
  Check,
  Zap,
  ThumbsUp,
  ThumbsDown,
  XCircle,
  HelpCircle,
  CheckCheck,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { ModerationReports } from "@/components/admin/ModerationReports";

type Kind = "verification" | "report" | "dispute" | "refund";

type Assignment = {
  kind: Kind;
  entity_id: string;
  assigned_to: string;
  assignee_name?: string | null;
  claimed_at: string;
  expires_at: string;
  status: "claimed" | "released" | "completed";
};

type InboxItem = {
  id: string;
  kind: Kind;
  title: string;
  subtitle?: string | null;
  createdAt: string;
  dueAt: Date;
  priority: "urgent" | "high" | "normal";
  status: string;
  link: string;
  amount?: number | null;
  assignment?: Assignment | null;
  entityType?: string | null;
};

const SLA: Record<Kind, number> = {
  dispute: 24,
  report: 24,
  verification: 48,
  refund: 72,
};

const KIND_META: Record<Kind, { label: string; icon: any; color: string }> = {
  verification: { label: "Verification", icon: ShieldCheck, color: "text-blue-600" },
  report: { label: "Content Report", icon: Flag, color: "text-amber-600" },
  dispute: { label: "Dispute", icon: MessageSquareWarning, color: "text-rose-600" },
  refund: { label: "Refund", icon: RefreshCcw, color: "text-emerald-700" },
};

function computePriority(item: {
  createdAt: string;
  dueAt: Date;
  explicit?: string | null;
}): "urgent" | "high" | "normal" {
  const now = Date.now();
  if (item.explicit === "urgent" || item.explicit === "critical") return "urgent";
  if (now > item.dueAt.getTime()) return "urgent";
  const total = item.dueAt.getTime() - new Date(item.createdAt).getTime();
  const remaining = item.dueAt.getTime() - now;
  if (remaining / total < 0.25) return "high";
  if (item.explicit === "high") return "high";
  return "normal";
}

function slaTimer(dueAt: Date) {
  const now = Date.now();
  const overdue = now > dueAt.getTime();
  const label = formatDistanceToNowStrict(dueAt, { addSuffix: false });
  return { overdue, label };
}

export default function ModerationInboxPage() {
  const { user } = useAuth();
  const location = useLocation();
  const moderatorScope = location.pathname.startsWith("/moderator");
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<Kind | "all" | "reviews">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "urgent" | "high" | "normal">("all");
  const [ownerFilter, setOwnerFilter] = useState<"all" | "mine" | "unassigned">(moderatorScope ? "mine" : "all");
  const [search, setSearch] = useState("");
  const [tick, setTick] = useState(0);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; kind: string; action: string; body: string }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<null | "approve" | "reject" | "dismiss" | "resolve" | "request_info">(null);
  const [bulkNote, setBulkNote] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);

  const keyOf = (i: { kind: Kind; id: string }) => `${i.kind}:${i.id}`;
  const toggleSelect = (k: string) =>
    setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("moderation_response_templates")
        .select("id, name, kind, action, body")
        .eq("is_active", true)
        .order("name");
      setTemplates(data || []);
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    const sb = supabase as any;
    const [ver, rep, dis, ref, assigns] = await Promise.all([
      supabase
        .from("vendor_verifications")
        .select("id, business_name, legal_name, status, submitted_at, created_at, vendor_id")
        .in("status", ["pending", "info_requested"])
        .order("submitted_at", { ascending: true })
        .limit(200),
      supabase
        .from("content_reports")
        .select("id, entity_type, entity_id, reason, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(200),
      supabase
        .from("disputes")
        .select("id, subject, type, priority, status, created_at")
        .in("status", ["open", "under_review", "info_requested"])
        .order("created_at", { ascending: true })
        .limit(200),
      supabase
        .from("refund_requests")
        .select("id, booking_id, amount, reason, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(200),
      sb
        .from("moderation_assignments")
        .select("kind, entity_id, assigned_to, claimed_at, expires_at, status")
        .neq("status", "completed")
        .limit(500),
    ]);

    // Fetch profile names for assignees
    const assignmentRows: Assignment[] = (assigns.data || []) as any;
    const assigneeIds = Array.from(new Set(assignmentRows.map((a) => a.assigned_to)));
    let nameMap = new Map<string, string>();
    if (assigneeIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", assigneeIds);
      (profs || []).forEach((p: any) => nameMap.set(p.user_id, p.display_name || "Moderator"));
    }
    const assignByKey = new Map<string, Assignment>();
    assignmentRows.forEach((a) =>
      assignByKey.set(`${a.kind}:${a.entity_id}`, {
        ...a,
        assignee_name: nameMap.get(a.assigned_to) || "Moderator",
      }),
    );

    const merged: InboxItem[] = [];
    const push = (i: Omit<InboxItem, "assignment">) => {
      merged.push({ ...i, assignment: assignByKey.get(`${i.kind}:${i.id}`) || null });
    };

    (ver.data || []).forEach((r: any) => {
      const created = r.submitted_at || r.created_at;
      const dueAt = new Date(new Date(created).getTime() + SLA.verification * 3600_000);
      push({
        id: r.id, kind: "verification",
        title: r.business_name || r.legal_name || "Vendor verification",
        subtitle: `Status: ${r.status}`,
        createdAt: created, dueAt,
        priority: computePriority({ createdAt: created, dueAt }),
        status: r.status, link: "/admin/verifications",
      });
    });
    (rep.data || []).forEach((r: any) => {
      const dueAt = new Date(new Date(r.created_at).getTime() + SLA.report * 3600_000);
      const isReview = String(r.entity_type ?? "").toLowerCase() === "review";
      push({
        id: r.id, kind: "report",
        title: isReview ? "Review reported" : `${r.entity_type} reported`,
        subtitle: r.reason || null,
        createdAt: r.created_at, dueAt,
        priority: computePriority({ createdAt: r.created_at, dueAt }),
        status: r.status, link: "/admin/moderation",
        entityType: r.entity_type ?? null,
      });
    });
    (dis.data || []).forEach((r: any) => {
      const dueAt = new Date(new Date(r.created_at).getTime() + SLA.dispute * 3600_000);
      push({
        id: r.id, kind: "dispute",
        title: r.subject || "Dispute", subtitle: r.type ? `Type: ${r.type}` : null,
        createdAt: r.created_at, dueAt,
        priority: computePriority({ createdAt: r.created_at, dueAt, explicit: r.priority }),
        status: r.status, link: "/admin/disputes",
      });
    });
    (ref.data || []).forEach((r: any) => {
      const dueAt = new Date(new Date(r.created_at).getTime() + SLA.refund * 3600_000);
      push({
        id: r.id, kind: "refund",
        title: `Refund request`, subtitle: r.reason || null,
        createdAt: r.created_at, dueAt,
        priority: computePriority({ createdAt: r.created_at, dueAt }),
        status: r.status, link: "/admin/refunds",
        amount: r.amount,
      });
    });

    setItems(merged);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runRpc = async (name: string, args: Record<string, any>, key: string) => {
    setBusyKey(key);
    const { error } = await (supabase as any).rpc(name, args);
    setBusyKey(null);
    if (error) {
      toast({ title: "Action failed", description: error.message, variant: "destructive" });
      return false;
    }
    await load();
    return true;
  };

  const claim = (item: InboxItem) =>
    runRpc("claim_moderation_case", { _kind: item.kind, _entity_id: item.id }, `claim:${item.kind}:${item.id}`)
      .then((ok) => ok && toast({ title: "Case claimed", description: "Locked to you for 30 minutes." }));

  const takeover = (item: InboxItem) =>
    runRpc("takeover_moderation_case", { _kind: item.kind, _entity_id: item.id }, `take:${item.kind}:${item.id}`)
      .then((ok) => ok && toast({ title: "Case taken over" }));

  const release = (item: InboxItem) =>
    runRpc("release_moderation_case", { _kind: item.kind, _entity_id: item.id }, `rel:${item.kind}:${item.id}`)
      .then((ok) => ok && toast({ title: "Case released" }));

  const complete = (item: InboxItem) =>
    runRpc("complete_moderation_case", { _kind: item.kind, _entity_id: item.id, _notes: null }, `done:${item.kind}:${item.id}`)
      .then((ok) => ok && toast({ title: "Marked complete" }));

  const runBulk = async () => {
    if (!bulkAction || selected.size === 0) return;
    setBulkRunning(true);
    const payload = Array.from(selected).map((k) => {
      const [kind, ...rest] = k.split(":");
      return { kind, entity_id: rest.join(":") };
    });
    const { data, error } = await (supabase as any).rpc("bulk_moderation_action", {
      _items: payload,
      _action: bulkAction,
      _note: bulkNote.trim() || null,
    });
    setBulkRunning(false);
    if (error) {
      toast({ title: "Bulk action failed", description: error.message, variant: "destructive" });
      return;
    }
    const ok = data?.ok ?? 0;
    const failed = data?.failed ?? 0;
    toast({
      title: `Bulk ${bulkAction.replace("_", " ")} complete`,
      description: `${ok} succeeded${failed ? `, ${failed} failed` : ""}.`,
      variant: failed && !ok ? "destructive" : undefined,
    });
    setBulkAction(null);
    setBulkNote("");
    setSelected(new Set());
    await load();
  };

  const runBulkClaim = async (action: "claim" | "release" | "complete") => {
    if (selected.size === 0) return;
    setBulkRunning(true);
    const payload = Array.from(selected).map((k) => {
      const [kind, ...rest] = k.split(":");
      return { kind, entity_id: rest.join(":") };
    });
    const { data, error } = await (supabase as any).rpc("bulk_moderation_claim_action", {
      _items: payload,
      _action: action,
      _ttl_minutes: 30,
      _note: null,
    });
    setBulkRunning(false);
    if (error) {
      toast({ title: `Bulk ${action} failed`, description: error.message, variant: "destructive" });
      return;
    }
    const ok = data?.ok ?? 0;
    const skipped = data?.skipped ?? 0;
    const failed = data?.failed ?? 0;
    toast({
      title: `Bulk ${action} complete`,
      description: `${ok} succeeded${skipped ? `, ${skipped} skipped` : ""}${failed ? `, ${failed} failed` : ""}.`,
      variant: failed && !ok ? "destructive" : undefined,
    });
    setSelected(new Set());
    await load();
  };


  const filtered = useMemo(() => {
    void tick;
    const priorityRank = { urgent: 0, high: 1, normal: 2 } as const;
    return items
      .filter((i) => {
        if (kindFilter === "all") return true;
        if (kindFilter === "reviews")
          return i.kind === "report" && String(i.entityType ?? "").toLowerCase() === "review";
        return i.kind === kindFilter;
      })
      .filter((i) => (priorityFilter === "all" ? true : i.priority === priorityFilter))
      .filter((i) => {
        if (ownerFilter === "all") return true;
        const a = i.assignment;
        const activeClaim = a && a.status === "claimed" && new Date(a.expires_at) > new Date();
        if (ownerFilter === "mine") return activeClaim && a!.assigned_to === user?.id;
        if (ownerFilter === "unassigned") return !activeClaim;
        return true;
      })
      .filter((i) =>
        search ? (i.title + " " + (i.subtitle || "")).toLowerCase().includes(search.toLowerCase()) : true,
      )
      .sort((a, b) => {
        const pr = priorityRank[a.priority] - priorityRank[b.priority];
        if (pr !== 0) return pr;
        return a.dueAt.getTime() - b.dueAt.getTime();
      });
  }, [items, kindFilter, priorityFilter, ownerFilter, search, tick, user?.id]);

  const counts = useMemo(() => {
    const c = { all: items.length, urgent: 0, high: 0, normal: 0, mine: 0 } as Record<string, number>;
    for (const i of items) {
      c[i.priority]++;
      const a = i.assignment;
      if (a && a.status === "claimed" && new Date(a.expires_at) > new Date() && a.assigned_to === user?.id) c.mine++;
    }
    return c;
  }, [items, tick, user?.id]);

  const perKindCount = useMemo(() => {
    const c: Record<string, number> = { all: items.length, reviews: 0 };
    for (const k of Object.keys(KIND_META)) c[k] = 0;
    for (const i of items) {
      c[i.kind]++;
      if (i.kind === "report" && String(i.entityType ?? "").toLowerCase() === "review") c.reviews++;
    }
    return c;
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-heading">{moderatorScope ? "My Moderation Inbox" : "Moderation Inbox"}</h1>
          <p className="text-description-sm mt-1">
            {moderatorScope
              ? "Cases claimed by you. Switch to All owners to browse the shared queue."
              : "Prioritized queue with SLA timers, moderator claims, and takeover of expired assignments."}
          </p>
        </div>
        <div className="flex gap-2">
          <ModerationReports />
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Open items" value={counts.all} tone="default" />
        <SummaryCard label="Urgent / overdue" value={counts.urgent} tone="urgent" />
        <SummaryCard label="High priority" value={counts.high} tone="high" />
        <SummaryCard label="Claimed by me" value={counts.mine} tone="normal" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 flex-wrap">
        <Tabs value={kindFilter} onValueChange={(v) => setKindFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All ({perKindCount.all})</TabsTrigger>
            <TabsTrigger value="verification">Verify ({perKindCount.verification})</TabsTrigger>
            <TabsTrigger value="report">Reports ({perKindCount.report})</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({perKindCount.reviews})</TabsTrigger>
            <TabsTrigger value="dispute">Disputes ({perKindCount.dispute})</TabsTrigger>
            <TabsTrigger value="refund">Refunds ({perKindCount.refund})</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Any</TabsTrigger>
            <TabsTrigger value="urgent">Urgent</TabsTrigger>
            <TabsTrigger value="high">High</TabsTrigger>
            <TabsTrigger value="normal">Normal</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={ownerFilter} onValueChange={(v) => setOwnerFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All owners</TabsTrigger>
            <TabsTrigger value="mine">Mine</TabsTrigger>
            <TabsTrigger value="unassigned">Unassigned</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          placeholder="Search title or reason..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="md:max-w-xs"
        />
      </div>

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 rounded-md border bg-card px-4 py-3 shadow-sm flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex flex-wrap gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>Clear</Button>
            <Button size="sm" variant="secondary" disabled={bulkRunning} onClick={() => runBulkClaim("claim")}>
              <Lock className="h-3.5 w-3.5 mr-1.5" /> Claim
            </Button>
            <Button size="sm" variant="outline" disabled={bulkRunning} onClick={() => runBulkClaim("release")}>
              <Unlock className="h-3.5 w-3.5 mr-1.5" /> Release
            </Button>
            <Button size="sm" variant="outline" disabled={bulkRunning} onClick={() => runBulkClaim("complete")}>
              <Check className="h-3.5 w-3.5 mr-1.5" /> Complete
            </Button>
            <span className="w-px h-6 bg-border mx-1" />
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-600/90 text-white"
              onClick={() => setBulkAction("approve")}>
              <ThumbsUp className="h-3.5 w-3.5 mr-1.5" /> Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setBulkAction("reject")}>
              <ThumbsDown className="h-3.5 w-3.5 mr-1.5" /> Reject
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setBulkAction("dismiss")}>
              <XCircle className="h-3.5 w-3.5 mr-1.5" /> Dismiss
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => setBulkAction("resolve")}>
              <CheckCheck className="h-3.5 w-3.5 mr-1.5" /> Resolve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkAction("request_info")}>
              <HelpCircle className="h-3.5 w-3.5 mr-1.5" /> Request info
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-subheading">Queue ({filtered.length})</CardTitle>
          {filtered.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox
                checked={filtered.length > 0 && filtered.every((i) => selected.has(keyOf(i)))}
                onCheckedChange={(v) => {
                  setSelected((s) => {
                    const n = new Set(s);
                    if (v) filtered.forEach((i) => n.add(keyOf(i)));
                    else filtered.forEach((i) => n.delete(keyOf(i)));
                    return n;
                  });
                }}
              />
              Select all visible
            </label>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-description-sm">
              Nothing waiting. All queues are clear.
            </div>
          ) : (
            <ul className="divide-y">

              {filtered.map((item) => {
                const meta = KIND_META[item.kind];
                const Icon = meta.icon;
                const sla = slaTimer(item.dueAt);
                const a = item.assignment;
                const claimActive = !!a && a.status === "claimed" && new Date(a.expires_at) > new Date();
                const claimExpired = !!a && a.status === "claimed" && new Date(a.expires_at) <= new Date();
                const mine = claimActive && a!.assigned_to === user?.id;
                const busyPrefix = `${item.kind}:${item.id}`;
                const isBusy = busyKey?.endsWith(busyPrefix);

                return (
                  <li key={`${item.kind}-${item.id}`} className="flex flex-wrap gap-3 items-center px-4 py-3">
                    <Checkbox
                      checked={selected.has(keyOf(item))}
                      onCheckedChange={() => toggleSelect(keyOf(item))}
                      aria-label="Select case"
                    />
                    <div className={`shrink-0 rounded-md bg-muted p-2 ${meta.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{item.title}</span>
                        <PriorityBadge priority={item.priority} />
                        <Badge variant="outline" className="text-xs capitalize">{meta.label}</Badge>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {item.status.replace(/_/g, " ")}
                        </Badge>
                        {claimActive && (
                          <Badge className={mine ? "bg-emerald-600 text-white hover:bg-emerald-600" : "bg-slate-700 text-white hover:bg-slate-700"}>
                            <Lock className="h-3 w-3 mr-1" />
                            {mine ? "You" : a!.assignee_name}
                          </Badge>
                        )}
                        {claimExpired && (
                          <Badge variant="outline" className="text-xs border-amber-500 text-amber-700">
                            Claim expired
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {item.subtitle || "—"}
                        {item.amount ? ` · $${Number(item.amount).toFixed(2)}` : ""}
                        {" · opened "}
                        {formatDistanceToNowStrict(new Date(item.createdAt), { addSuffix: true })}
                        {claimActive && (
                          <>
                            {" · lock "}
                            {formatDistanceToNowStrict(new Date(a!.expires_at), { addSuffix: true })}
                          </>
                        )}
                      </div>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 text-xs font-medium ${
                        sla.overdue ? "text-destructive" : "text-muted-foreground"
                      }`}
                      title={item.dueAt.toLocaleString()}
                    >
                      {sla.overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                      {sla.overdue ? `Overdue ${sla.label}` : `Due in ${sla.label}`}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!claimActive && (
                        <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => claim(item)}>
                          <Lock className="h-3.5 w-3.5 mr-1.5" /> Claim
                        </Button>
                      )}
                      {claimActive && mine && (
                        <>
                          <Button size="sm" variant="outline" disabled={isBusy} onClick={() => release(item)}>
                            <Unlock className="h-3.5 w-3.5 mr-1.5" /> Release
                          </Button>
                          <Button size="sm" variant="default" disabled={isBusy} onClick={() => complete(item)}>
                            <Check className="h-3.5 w-3.5 mr-1.5" /> Done
                          </Button>
                        </>
                      )}
                      {claimActive && !mine && (
                        <Button size="sm" variant="outline" disabled={isBusy} onClick={() => takeover(item)}>
                          <Zap className="h-3.5 w-3.5 mr-1.5" /> Take over
                        </Button>
                      )}
                      {claimExpired && (
                        <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => takeover(item)}>
                          <UserCheck className="h-3.5 w-3.5 mr-1.5" /> Reclaim
                        </Button>
                      )}
                      <Button asChild size="sm" variant="ghost">
                        <Link to={item.link} aria-label="Review">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!bulkAction} onOpenChange={(o) => !o && !bulkRunning && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="capitalize">
              {bulkAction?.replace("_", " ")} {selected.size} case{selected.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will update the underlying records, mark any active moderator claims as completed, and
              write an entry to the admin audit log for every selected item. Verifications cannot be dismissed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            {(() => {
              const selectedKinds = new Set(Array.from(selected).map((k) => k.split(":")[0]));
              const matches = templates.filter(
                (t) =>
                  (bulkAction ? t.action === bulkAction : true) &&
                  (t.kind === "general" || selectedKinds.has(t.kind)),
              );
              if (matches.length === 0) return null;
              return (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Insert canned response</label>
                  <Select
                    value={selectedTemplate}
                    onValueChange={(id) => {
                      setSelectedTemplate(id);
                      const t = templates.find((x) => x.id === id);
                      if (t) setBulkNote(t.body);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {matches.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}
            <label className="text-sm font-medium">
              {bulkAction === "request_info" ? "Message to user (optional)" : "Note (optional)"}
            </label>
            <Textarea
              placeholder="Add context for the user or your audit trail. Variables like {{admin_note}} in templates are left as-is if unresolved."
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              Variables: <code>{"{{admin_note}}"}</code>, <code>{"{{user_name}}"}</code>,{" "}
              <code>{"{{business_name}}"}</code>, <code>{"{{entity_type}}"}</code>. Edit freely before confirming.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkRunning}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={bulkRunning} onClick={(e) => { e.preventDefault(); runBulk(); }}>
              {bulkRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function SummaryCard({
  label, value, tone,
}: { label: string; value: number; tone: "default" | "urgent" | "high" | "normal" }) {
  const toneMap = {
    default: "border-border",
    urgent: "border-destructive/40 bg-destructive/5",
    high: "border-amber-500/40 bg-amber-500/5",
    normal: "border-border",
  } as const;
  return (
    <Card className={toneMap[tone]}>
      <CardContent className="pt-6">
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-description-sm mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

function PriorityBadge({ priority }: { priority: "urgent" | "high" | "normal" }) {
  if (priority === "urgent")
    return <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">Urgent</Badge>;
  if (priority === "high")
    return <Badge className="bg-amber-500 text-white hover:bg-amber-500">High</Badge>;
  return <Badge variant="secondary">Normal</Badge>;
}
