import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ShieldCheck, RefreshCcw, Search, Download } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { LoadingState } from "@/components/ui/app";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";

type AppRole = "admin" | "moderator" | "provider" | "customer" | "employer";

interface Row {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  target_user_id: string | null;
  details: any;
  created_at: string;
}

interface Actor {
  user_id: string;
  display_name: string | null;
  email?: string | null;
  roles: AppRole[];
  tier: string | null; // provider subscription tier, when relevant
}

/**
 * Prefixes that identify a moderation-relevant audit action.
 * Keep in sync with the RPCs and edge functions that write to admin_audit_log.
 */
const MODERATION_ACTION_PATTERNS = [
  "verification.",
  "dispute.",
  "refund.",
  "report.",
  "moderation.",
  "content_report.",
  "role.",
  "user.updated_by_admin",
];

const ROLE_TONE: Record<AppRole, string> = {
  admin: "bg-primary/10 text-primary border-primary/20",
  moderator: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  provider: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  employer: "bg-purple-500/10 text-purple-700 border-purple-500/20",
  customer: "bg-muted text-muted-foreground border-border",
};

function isModerationAction(action: string) {
  return MODERATION_ACTION_PATTERNS.some((p) =>
    p.endsWith(".") ? action.startsWith(p) : action === p,
  );
}

export default function ModerationAuditPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [actors, setActors] = useState<Map<string, Actor>>(new Map());
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AppRole>("all");
  const [actionFilter, setActionFilter] = useState<"all" | string>("all");

  const load = async () => {
    setLoading(true);

    // Fetch a generous window; filter client-side by the moderation prefix set
    // so we can include new action names without a schema change.
    const { data, error } = await supabase
      .from("admin_audit_log")
      .select("id, actor_id, action, entity_type, entity_id, target_user_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      setLoading(false);
      return;
    }

    const filtered = (data || []).filter((r: any) => isModerationAction(r.action)) as Row[];
    setRows(filtered);

    // Enrich actors: profile name + roles + provider tier (if any).
    const actorIds = Array.from(new Set(filtered.map((r) => r.actor_id).filter(Boolean))) as string[];
    if (actorIds.length > 0) {
      const [{ data: profs }, { data: userRoles }, { data: subs }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name").in("user_id", actorIds),
        (supabase as any).from("user_roles").select("user_id, role").in("user_id", actorIds),
        supabase
          .from("provider_subscriptions")
          .select("provider_id, plan_id, status, current_period_end")
          .in("provider_id", actorIds)
          .eq("status", "active"),
      ]);

      const planIds = Array.from(new Set((subs || []).map((s: any) => s.plan_id).filter(Boolean)));
      const planMap = new Map<string, string>();
      if (planIds.length > 0) {
        const { data: plans } = await supabase
          .from("subscription_plans")
          .select("id, name")
          .in("id", planIds);
        (plans || []).forEach((p: any) => planMap.set(p.id, p.name));
      }

      const rolesById = new Map<string, AppRole[]>();
      (userRoles || []).forEach((r: any) => {
        const list = rolesById.get(r.user_id) || [];
        list.push(r.role);
        rolesById.set(r.user_id, list);
      });
      const tierById = new Map<string, string | null>();
      (subs || []).forEach((s: any) => {
        const active = s.current_period_end && new Date(s.current_period_end) > new Date();
        if (active) tierById.set(s.provider_id, planMap.get(s.plan_id) || null);
      });

      const map = new Map<string, Actor>();
      (profs || []).forEach((p: any) =>
        map.set(p.user_id, {
          user_id: p.user_id,
          display_name: p.display_name,
          roles: rolesById.get(p.user_id) || [],
          tier: tierById.get(p.user_id) ?? null,
        }),
      );
      // Ensure every actor has an entry (even if profile missing)
      actorIds.forEach((id) => {
        if (!map.has(id)) {
          map.set(id, {
            user_id: id,
            display_name: null,
            roles: rolesById.get(id) || [],
            tier: tierById.get(id) ?? null,
          });
        }
      });
      setActors(map);
    } else {
      setActors(new Map());
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.action));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      const actor = r.actor_id ? actors.get(r.actor_id) : undefined;
      if (roleFilter !== "all") {
        if (!actor?.roles.includes(roleFilter)) return false;
      }
      if (!q) return true;
      const hay = [
        r.action,
        r.entity_type,
        r.entity_id,
        actor?.display_name,
        actor?.user_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, actors, search, roleFilter, actionFilter]);

  const { page, setPage, pageSize, totalPages, pageItems } = usePagination(filtered, 25);

  const exportCsv = () => {
    const header = ["timestamp", "actor_id", "actor_name", "roles", "tier", "action", "entity_type", "entity_id", "target_user_id"];
    const lines = [header.join(",")];
    filtered.forEach((r) => {
      const a = r.actor_id ? actors.get(r.actor_id) : undefined;
      const cells = [
        r.created_at,
        r.actor_id || "",
        a?.display_name || "",
        (a?.roles || []).join("|"),
        a?.tier || "",
        r.action,
        r.entity_type,
        r.entity_id || "",
        r.target_user_id || "",
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `moderation-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminPage
      title="Moderation Audit"
      subtitle="Every moderation action with the actor's roles and active tier."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search action, actor, entity id..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="admin">Super Admin</SelectItem>
            <SelectItem value="moderator">Moderator</SelectItem>
            <SelectItem value="provider">Provider</SelectItem>
            <SelectItem value="employer">Employer</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actionOptions.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <LoadingState title="Loading audit trail…" />
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-muted-foreground">
          No moderation actions recorded for these filters.
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((r) => {
                  const a = r.actor_id ? actors.get(r.actor_id) : undefined;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-fs-sm text-muted-foreground">
                        {formatDistanceToNowStrict(new Date(r.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <div className="font-medium truncate">{a?.display_name || "Unknown"}</div>
                        <div className="text-fs-xs text-muted-foreground truncate">{r.actor_id || "—"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(a?.roles || []).length === 0 ? (
                            <Badge variant="outline" className="text-fs-xs">no role</Badge>
                          ) : (
                            a!.roles.map((role) => (
                              <Badge key={role} variant="outline" className={`text-fs-xs ${ROLE_TONE[role] || ""}`}>
                                {role}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {a?.tier ? (
                          <Badge variant="secondary" className="text-fs-xs">{a.tier}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-fs-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-fs-xs bg-muted px-1.5 py-0.5 rounded">{r.action}</code>
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <div className="text-fs-sm">{r.entity_type}</div>
                        {r.entity_id && (
                          <div className="text-fs-xs text-muted-foreground truncate">{r.entity_id}</div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4">
            <NumberedPagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filtered.length}
              pageSize={pageSize}
            />
          </div>
        </>
      )}
    </AdminPage>
  );
}
