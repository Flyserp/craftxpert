import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ADMIN_STATUS_TONES, ADMIN_STAT_ACCENTS } from "@/lib/roleTokens";
import { Search, ScrollText, RotateCcw, Banknote, ShieldCheck, Download, AlertTriangle, Ticket, Settings, UserPlus, UserX, Clock, Bell, BellOff, LogIn, CreditCard, UserCog, Briefcase, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { LoadingState } from "@/components/ui/app";

interface AuditRow {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  target_user_id: string | null;
  details: any;
  created_at: string;
}

// All color strings flow through the shared ADMIN_STATUS_TONES map so audit
// pills track the same palette as refunds/disputes/withdrawals.
const actionMeta: Record<string, { label: string; icon: typeof RotateCcw; color: string }> = {
  "refund.approved":    { label: "Refund Approved",    icon: RotateCcw,     color: ADMIN_STATUS_TONES.info },
  "withdrawal.paid":    { label: "Withdrawal Paid",    icon: Banknote,      color: ADMIN_STATUS_TONES.settled },
  "role.granted":       { label: "Role Granted",       icon: ShieldCheck,   color: ADMIN_STATUS_TONES.success },
  "role.revoked":       { label: "Role Revoked",       icon: ShieldCheck,   color: ADMIN_STATUS_TONES.danger },
  "dispute.resolved":   { label: "Dispute Resolved",   icon: AlertTriangle, color: ADMIN_STATUS_TONES.success },
  "dispute.closed":     { label: "Dispute Closed",     icon: AlertTriangle, color: ADMIN_STATUS_TONES.neutral },
  "coupon.created":     { label: "Coupon Created",     icon: Ticket,        color: ADMIN_STATUS_TONES.success },
  "coupon.deleted":     { label: "Coupon Deleted",     icon: Ticket,        color: ADMIN_STATUS_TONES.danger },
  "setting.insert":              { label: "Setting Created",      icon: Settings,      color: ADMIN_STATUS_TONES.warning },
  "setting.update":              { label: "Setting Updated",      icon: Settings,      color: ADMIN_STATUS_TONES.warning },
  "staff_invite.accepted":       { label: "Invite Accepted",      icon: UserPlus,      color: ADMIN_STATUS_TONES.success },
  "staff_invite.accept_failed":  { label: "Invite Failed",        icon: UserX,         color: ADMIN_STATUS_TONES.danger },
  "staff_invite.expired":        { label: "Invite Expired",       icon: Clock,         color: ADMIN_STATUS_TONES.neutral },
  "notification.delivered":      { label: "Notification Sent",    icon: Bell,          color: ADMIN_STATUS_TONES.success },
  "notification.partial":        { label: "Notification Partial", icon: Bell,          color: ADMIN_STATUS_TONES.warning },
  "notification.skipped":        { label: "Notification Skipped", icon: BellOff,       color: ADMIN_STATUS_TONES.neutral },
  "notification.failed":         { label: "Notification Failed",  icon: BellOff,       color: ADMIN_STATUS_TONES.danger },
  "auth.login":                  { label: "Login",                icon: LogIn,         color: ADMIN_STATUS_TONES.info },
  "payment.created":             { label: "Payment Created",      icon: CreditCard,    color: ADMIN_STATUS_TONES.info },
  "payment.succeeded":           { label: "Payment Succeeded",    icon: CreditCard,    color: ADMIN_STATUS_TONES.success },
  "payment.failed":              { label: "Payment Failed",       icon: CreditCard,    color: ADMIN_STATUS_TONES.danger },
  "payment.refunded":            { label: "Payment Refunded",     icon: CreditCard,    color: ADMIN_STATUS_TONES.warning },
  "user.updated":                { label: "User Updated",         icon: UserCog,       color: ADMIN_STATUS_TONES.neutral },
  "user.updated_by_admin":       { label: "User Updated (Admin)", icon: UserCog,       color: ADMIN_STATUS_TONES.warning },
  "job.created":                 { label: "Job Created",          icon: Briefcase,     color: ADMIN_STATUS_TONES.info },
  "job.status_changed":          { label: "Job Status Changed",   icon: Briefcase,     color: ADMIN_STATUS_TONES.warning },
  "verification.approved":       { label: "Verification Approved",icon: FileCheck2,    color: ADMIN_STATUS_TONES.success },
  "verification.rejected":       { label: "Verification Rejected",icon: FileCheck2,    color: ADMIN_STATUS_TONES.danger },
};

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<"all" | "7d" | "30d" | "90d">("all");
  const [tenant, setTenant] = useState<string>("all");

  const load = async () => {
    const { data } = await supabase
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    const items = (data as AuditRow[]) || [];
    setRows(items);

    const detailTenantIds = items
      .map((r) => r.details?.provider_id)
      .filter((v): v is string => typeof v === "string" && !!v);
    const ids = [...new Set([
      ...items.flatMap((r) => [r.actor_id, r.target_user_id]).filter(Boolean) as string[],
      ...detailTenantIds,
    ])];
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p.display_name || "Unknown"; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Realtime: stream new audit entries (logins, payments, job status, etc.)
  // straight into the table without requiring a refresh.
  useEffect(() => {
    const channel = supabase
      .channel(`admin-audit-log-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_audit_log" },
        async (payload) => {
          const row = payload.new as AuditRow;
          setRows((prev) => {
            if (prev.some((r) => r.id === row.id)) return prev;
            return [row, ...prev].slice(0, 500);
          });

          // Hydrate any unknown actor/target/tenant names referenced by the new row.
          const detailTenant = typeof row.details?.provider_id === "string" ? row.details.provider_id : null;
          const needed = [row.actor_id, row.target_user_id, detailTenant].filter(
            (id): id is string => !!id
          );
          setProfiles((prev) => {
            const missing = needed.filter((id) => !(id in prev));
            if (missing.length === 0) return prev;
            supabase
              .from("profiles")
              .select("user_id, display_name")
              .in("user_id", missing)
              .then(({ data }) => {
                if (!data || data.length === 0) return;
                setProfiles((curr) => {
                  const next = { ...curr };
                  data.forEach((p: any) => {
                    next[p.user_id] = p.display_name || "Unknown";
                  });
                  return next;
                });
              });
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // Resolve a "tenant" identifier per row. For staff invite events the tenant
  // is the provider being joined — captured either in details.provider_id or
  // (for accepted/expired/non-pending failures) target_user_id. Other audit
  // entries have no tenant scope and are excluded when a tenant filter is set.
  const tenantIdOf = (r: AuditRow): string | null => {
    const fromDetails = r.details?.provider_id;
    if (typeof fromDetails === "string" && fromDetails) return fromDetails;
    if (r.action.startsWith("staff_invite.") && r.target_user_id) return r.target_user_id;
    return null;
  };

  const tenantOptions = useMemo(() => {
    const ids = new Set<string>();
    rows.forEach((r) => { const t = tenantIdOf(r); if (t) ids.add(t); });
    return [...ids].map((id) => ({
      id,
      label: profiles[id] || `Tenant ${id.slice(0, 8)}`,
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, profiles]);

  const filtered = useMemo(() => {
    const cutoff = (() => {
      if (range === "all") return 0;
      const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
      return Date.now() - days * 24 * 60 * 60 * 1000;
    })();
    return rows.filter((r) => {
      if (filter !== "all" && r.action !== filter) return false;
      if (cutoff && new Date(r.created_at).getTime() < cutoff) return false;
      if (tenant !== "all" && tenantIdOf(r) !== tenant) return false;
      if (search) {
        const q = search.toLowerCase();
        const actor = (profiles[r.actor_id || ""] || "").toLowerCase();
        const target = (profiles[r.target_user_id || ""] || "").toLowerCase();
        const details = JSON.stringify(r.details || {}).toLowerCase();
        if (!actor.includes(q) && !target.includes(q) && !details.includes(q) && !r.action.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, search, profiles, range, tenant]);

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(filtered, 20);

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.error("Nothing to export with current filters");
      return;
    }
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["Timestamp", "Action", "Actor", "Target", "Summary", "Entity Type", "Entity ID", "Details"];
    const lines = filtered.map((r) => [
      new Date(r.created_at).toISOString(),
      r.action,
      r.actor_id ? profiles[r.actor_id] || "Unknown" : "",
      r.target_user_id ? profiles[r.target_user_id] || "Unknown" : "",
      summarize(r),
      r.entity_type,
      r.entity_id || "",
      JSON.stringify(r.details || {}),
    ].map(escape).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} ${filtered.length === 1 ? "entry" : "entries"}`);
  };

  const stats = useMemo(() => ({
    total: rows.length,
    refunds: rows.filter((r) => r.action === "refund.approved").length,
    withdrawals: rows.filter((r) => r.action === "withdrawal.paid").length,
    roles: rows.filter((r) => r.action.startsWith("role.")).length,
    invites: rows.filter((r) => r.action.startsWith("staff_invite.")).length,
  }), [rows]);

  const summarize = (r: AuditRow) => {
    const d: any = r.details || {};
    if (r.action === "refund.approved")  return `$${Number(d.amount || 0).toFixed(2)} credited`;
    if (r.action === "withdrawal.paid")  return `$${Number(d.amount || 0).toFixed(2)} via ${String(d.method || "").replace("_", " ")}`;
    if (r.action === "role.granted")     return `Granted "${d.role}"`;
    if (r.action === "role.revoked")     return `Revoked "${d.role}"`;
    if (r.action === "dispute.resolved") return `Resolved: ${d.subject || "dispute"}`;
    if (r.action === "dispute.closed")   return `Closed: ${d.subject || "dispute"}`;
    if (r.action === "coupon.created")   return `Created code "${d.code}" (${d.discount_type === "percentage" ? `${d.discount_value}%` : `$${d.discount_value}`} off)`;
    if (r.action === "coupon.deleted")   return `Deleted code "${d.code}"`;
    if (r.action === "setting.update")   return `${d.key}: ${d.old_value ?? "—"} → ${d.new_value ?? "—"}`;
    if (r.action === "setting.insert")   return `${d.key} = ${d.new_value ?? "—"}`;
    if (r.action === "staff_invite.accepted")     return `${d.email || "Staff"} joined${d.title ? ` as ${d.title}` : ""} (tenant ${String(d.provider_id || "").slice(0, 8)})`;
    if (r.action === "staff_invite.accept_failed") return `${d.email || "Unknown"} — ${d.reason === "not_found" ? "token not found" : `status: ${d.invitation_status || "invalid"}`}`;
    if (r.action === "staff_invite.expired")       return `${d.email || "Invite"} expired ${d.expired_at ? new Date(d.expired_at).toLocaleDateString() : ""}`;
    if (r.action === "auth.login")          return `Signed in${d.provider ? ` via ${d.provider}` :""}`;
    if (r.action.startsWith("payment."))    return `$${Number(d.amount || 0).toFixed(2)} ${d.method ||""}${d.previous_status ? ` (${d.previous_status} → ${d.new_status})` :""}`;
    if (r.action === "user.updated" || r.action === "user.updated_by_admin") {
      const keys = Object.keys(d.changes || {});
      return keys.length ? `Updated ${keys.join(", ")}` :"Profile updated";
    }
    if (r.action === "job.created")         return `Posted "${d.title || "job"}"`;
    if (r.action === "job.status_changed")  return `"${d.title || "Job"}": ${d.previous_status} → ${d.new_status}`;
    if (r.action === "verification.approved") return `Approved: ${d.business_name || "vendor"}`;
    if (r.action === "verification.rejected") return `Rejected: ${d.rejection_note || "see reasons"}`;
    return r.entity_type;
  };

  if (loading) {
    return (
      <AdminPage title="Audit Log">
        <LoadingState variant="page" />
      </AdminPage>
    );
  }

  return (
    <AdminPage title="Audit Log" subtitle="Every sensitive admin action, with actor and target.">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Entries",  value: stats.total,       icon: ScrollText,  ...ADMIN_STAT_ACCENTS.primary },
            { label: "Refunds",        value: stats.refunds,     icon: RotateCcw,   ...ADMIN_STAT_ACCENTS.info },
            { label: "Withdrawals",    value: stats.withdrawals, icon: Banknote,    ...ADMIN_STAT_ACCENTS.success },
            { label: "Role Changes",   value: stats.roles,       icon: ShieldCheck, ...ADMIN_STAT_ACCENTS.warning },
          ].map((s) => (
            <div key={s.label} className="bg-card rounded-sm border border-border p-5 animate-reveal">
              <div className="flex items-center justify-between mb-3">
                <span className="text-fs-xs text-muted-foreground font-medium">{s.label}</span>
                <div className={cn("w-9 h-9 rounded-sm flex items-center justify-center", s.bg)}>
                  <s.icon className={cn("w-4 h-4", s.accent)} />
                </div>
              </div>
              <p className="text-fs-2xl font-bold text-heading tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search actor, target, or details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="auth.login">Login</SelectItem>
              <SelectItem value="payment.created">Payment created</SelectItem>
              <SelectItem value="payment.succeeded">Payment succeeded</SelectItem>
              <SelectItem value="payment.failed">Payment failed</SelectItem>
              <SelectItem value="user.updated">User updated</SelectItem>
              <SelectItem value="user.updated_by_admin">User updated (admin)</SelectItem>
              <SelectItem value="job.created">Job created</SelectItem>
              <SelectItem value="job.status_changed">Job status changed</SelectItem>
              <SelectItem value="verification.approved">Verification approved</SelectItem>
              <SelectItem value="verification.rejected">Verification rejected</SelectItem>
              <SelectItem value="refund.approved">Refund approved</SelectItem>
              <SelectItem value="withdrawal.paid">Withdrawal paid</SelectItem>
              <SelectItem value="role.granted">Role granted</SelectItem>
              <SelectItem value="role.revoked">Role revoked</SelectItem>
              <SelectItem value="dispute.resolved">Dispute resolved</SelectItem>
              <SelectItem value="dispute.closed">Dispute closed</SelectItem>
              <SelectItem value="coupon.created">Coupon created</SelectItem>
              <SelectItem value="coupon.deleted">Coupon deleted</SelectItem>
              <SelectItem value="setting.update">Setting changed</SelectItem>
              <SelectItem value="staff_invite.accepted">Invite accepted</SelectItem>
              <SelectItem value="staff_invite.accept_failed">Invite failed</SelectItem>
              <SelectItem value="staff_invite.expired">Invite expired</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tenant} onValueChange={setTenant} disabled={tenantOptions.length === 0}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="All tenants" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tenants</SelectItem>
              {tenantOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv} className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-card rounded-sm border border-border p-12 text-center">
            <ScrollText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-description-sm">
              {rows.length === 0 ? "No admin actions logged yet" : "No entries match your filters"}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-fs-sm">
                <thead>
                  <tr className="border-b border-border text-fs-xs text-muted-foreground">
                    <th className="text-left py-3 px-5 font-medium">Action</th>
                    <th className="text-left py-3 px-5 font-medium">Actor</th>
                    <th className="text-left py-3 px-5 font-medium">Target</th>
                    <th className="text-left py-3 px-5 font-medium">Summary</th>
                    <th className="text-left py-3 px-5 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((r) => {
                    const meta = actionMeta[r.action] || { label: r.action, icon: ScrollText, color: "bg-muted text-muted-foreground" };
                    const Icon = meta.icon;
                    return (
                      <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", meta.color)}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <Badge variant="secondary" className={cn("text-[10px]", meta.color)}>{meta.label}</Badge>
                          </div>
                        </td>
                        <td className="py-3 px-5 text-heading">{r.actor_id ? profiles[r.actor_id] || "Unknown" : "—"}</td>
                        <td className="py-3 px-5 text-body">{r.target_user_id ? profiles[r.target_user_id] || "Unknown" : "—"}</td>
                        <td className="py-3 px-5 text-body">{summarize(r)}</td>
                        <td className="py-3 px-5 text-fs-xs text-muted-foreground whitespace-nowrap">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 pb-4">
              <NumberedPagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                onPageChange={setPage}
                pageSize={pageSize}
          onPageSizeChange={setPageSize}
              />
            </div>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
