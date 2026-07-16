import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, Search, Copy, Download, Layers } from "lucide-react";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { LoadingState } from "@/components/ui/app";

interface AuditRow {
  id: string;
  actor_id: string | null;
  entity_id: string | null;
  details: any;
  created_at: string;
}

export default function UnknownInviteRolesPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("id, actor_id, entity_id, details, created_at")
        .eq("action", "staff_invite.unknown_role")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) {
        toast.error("Failed to load events");
        setLoading(false);
        return;
      }
      const items = (data as AuditRow[]) || [];
      setRows(items);

      const ids = [...new Set(
        items.flatMap((r) => [r.actor_id, r.details?.provider_id]).filter(Boolean) as string[],
      )];
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
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => {
      const d = r.details || {};
      const provider = (profiles[d.provider_id || ""] || "").toLowerCase();
      return (
        (r.entity_id || "").toLowerCase().includes(q) ||
        String(d.received_role || "").toLowerCase().includes(q) ||
        String(d.provider_name || "").toLowerCase().includes(q) ||
        provider.includes(q)
      );
    });
  }, [rows, search, profiles]);

  // Group events into "schema drift incidents" — one per (provider, received_role).
  // Each incident tracks count, first/last seen, supported roles, and sample invite ids.
  type Incident = {
    key: string;
    providerId: string | null;
    providerLabel: string;
    receivedRole: string;
    supportedRoles: string[];
    count: number;
    firstSeen: string;
    lastSeen: string;
    sampleInviteIds: string[];
    appVersions: string[];
  };

  const incidents = useMemo<Incident[]>(() => {
    const map = new Map<string, Incident>();
    for (const r of filtered) {
      const d = r.details || {};
      const providerId: string | null = d.provider_id || null;
      const receivedRole = d.received_role == null ? "null" : String(d.received_role);
      const key = `${providerId ?? "unknown"}::${receivedRole}`;
      const providerLabel =
        d.provider_name ||
        (providerId ? profiles[providerId] : null) ||
        (providerId ? `Tenant ${providerId.slice(0, 8)}` : "Unknown tenant");
      const supported: string[] = Array.isArray(d.supported_roles) ? d.supported_roles : [];
      const inviteId = r.entity_id || "";
      const appVersion = d.app_version ? String(d.app_version) : "";

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          providerId,
          providerLabel,
          receivedRole,
          supportedRoles: supported,
          count: 1,
          firstSeen: r.created_at,
          lastSeen: r.created_at,
          sampleInviteIds: inviteId ? [inviteId] : [],
          appVersions: appVersion ? [appVersion] : [],
        });
      } else {
        existing.count += 1;
        if (new Date(r.created_at) < new Date(existing.firstSeen)) existing.firstSeen = r.created_at;
        if (new Date(r.created_at) > new Date(existing.lastSeen)) existing.lastSeen = r.created_at;
        if (inviteId && !existing.sampleInviteIds.includes(inviteId) && existing.sampleInviteIds.length < 5) {
          existing.sampleInviteIds.push(inviteId);
        }
        if (appVersion && !existing.appVersions.includes(appVersion)) {
          existing.appVersions.push(appVersion);
        }
        // Prefer the longest known supported_roles snapshot
        if (supported.length > existing.supportedRoles.length) existing.supportedRoles = supported;
      }
    }
    return [...map.values()].sort(
      (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime(),
    );
  }, [filtered, profiles]);

  const incPg = usePagination(incidents, 15);
  const evtPg = usePagination(filtered, 25);

  const copy = (text: string, label = "Copied") => {
    navigator.clipboard.writeText(text).then(() => toast.success(label));
  };

  const exportCsv = () => {
    if (filtered.length === 0) { toast.error("Nothing to export"); return; }
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["Timestamp", "Invite ID", "Received Role", "Supported Roles", "Provider", "App Version"];
    const lines = filtered.map((r) => {
      const d = r.details || {};
      return [
        new Date(r.created_at).toISOString(),
        r.entity_id || "",
        d.received_role ?? "",
        Array.isArray(d.supported_roles) ? d.supported_roles.join("|") : "",
        d.provider_name || profiles[d.provider_id || ""] || d.provider_id || "",
        d.app_version || "",
      ].map(escape).join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `unknown-invite-roles-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <AdminPage title="Unknown Invite Roles">
        <LoadingState variant="page" />
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="Unknown Invite Roles"
      subtitle="Schema-drift events where an invite role was not recognised by the accept page."
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-sm border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-fs-xs text-muted-foreground font-medium">Total Events</span>
              <div className="w-9 h-9 rounded-sm flex items-center justify-center bg-amber-500/10">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
            </div>
            <p className="text-fs-2xl font-bold text-heading tabular-nums">{rows.length}</p>
          </div>
          <div className="bg-card rounded-sm border border-border p-5">
            <span className="text-fs-xs text-muted-foreground font-medium">Unique Invites</span>
            <p className="text-fs-2xl font-bold text-heading tabular-nums mt-3">
              {new Set(rows.map((r) => r.entity_id).filter(Boolean)).size}
            </p>
          </div>
          <div className="bg-card rounded-sm border border-border p-5">
            <span className="text-fs-xs text-muted-foreground font-medium">Distinct Roles</span>
            <p className="text-fs-2xl font-bold text-heading tabular-nums mt-3">
              {new Set(rows.map((r) => r.details?.received_role).filter(Boolean)).size}
            </p>
          </div>
          <div className="bg-card rounded-sm border border-border p-5">
            <span className="text-fs-xs text-muted-foreground font-medium">Affected Providers</span>
            <p className="text-fs-2xl font-bold text-heading tabular-nums mt-3">
              {new Set(rows.map((r) => r.details?.provider_id).filter(Boolean)).size}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by invite id, role, or provider..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={exportCsv} className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-card rounded-sm border border-border p-12 text-center">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-description-sm">
              {rows.length === 0 ? "No unknown-role events recorded" : "No events match your search"}
            </p>
          </div>
        ) : (
          <Tabs defaultValue="incidents" className="space-y-4">
            <TabsList>
              <TabsTrigger value="incidents" className="gap-2">
                <Layers className="w-4 h-4" />
                Incidents ({incidents.length})
              </TabsTrigger>
              <TabsTrigger value="events" className="gap-2">
                <AlertTriangle className="w-4 h-4" />
                Events ({filtered.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="incidents" className="m-0">
              <div className="bg-card rounded-sm border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-fs-sm">
                    <thead>
                      <tr className="border-b border-border text-fs-xs text-muted-foreground">
                        <th className="text-left py-3 px-5 font-medium">Provider / Tenant</th>
                        <th className="text-left py-3 px-5 font-medium">Received Role</th>
                        <th className="text-left py-3 px-5 font-medium">Supported Roles</th>
                        <th className="text-right py-3 px-5 font-medium">Events</th>
                        <th className="text-left py-3 px-5 font-medium">First Seen</th>
                        <th className="text-left py-3 px-5 font-medium">Last Seen</th>
                        <th className="text-left py-3 px-5 font-medium">Sample Invite IDs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incPg.pageItems.map((inc) => (
                        <tr key={inc.key} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-5">
                            <div className="text-heading">{inc.providerLabel}</div>
                            {inc.providerId ? (
                              <button
                                type="button"
                                onClick={() => copy(inc.providerId!, "Tenant ID copied")}
                                className="font-mono text-[10px] text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                              >
                                {inc.providerId.slice(0, 8)}…
                                <Copy className="w-2.5 h-2.5 opacity-60" />
                              </button>
                            ) : null}
                          </td>
                          <td className="py-3 px-5">
                            <Badge
                              variant="secondary"
                              className="bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 text-[11px]"
                            >
                              {inc.receivedRole}
                            </Badge>
                          </td>
                          <td className="py-3 px-5">
                            <div className="flex flex-wrap gap-1">
                              {inc.supportedRoles.length === 0 ? (
                                <span className="text-fs-xs text-muted-foreground">—</span>
                              ) : inc.supportedRoles.map((s) => (
                                <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-5 text-right">
                            <Badge variant="secondary" className="tabular-nums">{inc.count}</Badge>
                          </td>
                          <td className="py-3 px-5 text-fs-xs text-muted-foreground whitespace-nowrap">
                            {new Date(inc.firstSeen).toLocaleString()}
                          </td>
                          <td className="py-3 px-5 text-fs-xs text-muted-foreground whitespace-nowrap">
                            {new Date(inc.lastSeen).toLocaleString()}
                          </td>
                          <td className="py-3 px-5">
                            <div className="flex flex-wrap gap-1">
                              {inc.sampleInviteIds.length === 0 ? (
                                <span className="text-fs-xs text-muted-foreground">—</span>
                              ) : inc.sampleInviteIds.map((id) => (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => copy(id, "Invite ID copied")}
                                  className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-heading hover:bg-muted/70 inline-flex items-center gap-1"
                                  title={id}
                                >
                                  {id.slice(0, 8)}
                                  <Copy className="w-2.5 h-2.5 opacity-60" />
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 pb-4">
                  <NumberedPagination
                    currentPage={incPg.page}
                    totalPages={incPg.totalPages}
                    totalItems={incPg.totalItems}
                    onPageChange={incPg.setPage}
                    pageSize={incPg.pageSize}
          onPageSizeChange={incPg.setPageSize}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="events" className="m-0">
              <div className="bg-card rounded-sm border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-fs-sm">
                    <thead>
                      <tr className="border-b border-border text-fs-xs text-muted-foreground">
                        <th className="text-left py-3 px-5 font-medium">When</th>
                        <th className="text-left py-3 px-5 font-medium">Invite</th>
                        <th className="text-left py-3 px-5 font-medium">Received Role</th>
                        <th className="text-left py-3 px-5 font-medium">Supported Roles</th>
                        <th className="text-left py-3 px-5 font-medium">Provider</th>
                        <th className="text-right py-3 px-5 font-medium">Invite ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evtPg.pageItems.map((r) => {
                        const d = r.details || {};
                        const supported: string[] = Array.isArray(d.supported_roles) ? d.supported_roles : [];
                        const providerLabel =
                          d.provider_name || profiles[d.provider_id || ""] || (d.provider_id ? `Tenant ${String(d.provider_id).slice(0, 8)}` : "—");
                        const inviteId = r.entity_id || "";
                        return (
                          <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-5 text-fs-xs text-muted-foreground whitespace-nowrap">
                              {new Date(r.created_at).toLocaleString()}
                            </td>
                            <td className="py-3 px-5">
                              {inviteId ? (
                                <button
                                  type="button"
                                  onClick={() => copy(inviteId, "Invite ID copied")}
                                  className="font-mono text-fs-xs text-heading hover:text-primary inline-flex items-center gap-1.5"
                                  title="Copy invite ID"
                                >
                                  {inviteId.slice(0, 8)}…
                                  <Copy className="w-3 h-3 opacity-60" />
                                </button>
                              ) : "—"}
                            </td>
                            <td className="py-3 px-5">
                              <Badge variant="secondary" className="bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 text-[11px]">
                                {String(d.received_role ?? "null")}
                              </Badge>
                            </td>
                            <td className="py-3 px-5">
                              <div className="flex flex-wrap gap-1">
                                {supported.length === 0 ? (
                                  <span className="text-fs-xs text-muted-foreground">—</span>
                                ) : supported.map((s) => (
                                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-5 text-body">{providerLabel}</td>
                            <td className="py-3 px-5 text-right">
                              {inviteId ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="gap-1.5 h-8 font-mono text-fs-xs"
                                  onClick={() => copy(inviteId, "Invite ID copied")}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  Copy full ID
                                </Button>
                              ) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 pb-4">
                  <NumberedPagination
                    currentPage={evtPg.page}
                    totalPages={evtPg.totalPages}
                    totalItems={evtPg.totalItems}
                    onPageChange={evtPg.setPage}
                    pageSize={evtPg.pageSize}
          onPageSizeChange={evtPg.setPageSize}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AdminPage>
  );
}
