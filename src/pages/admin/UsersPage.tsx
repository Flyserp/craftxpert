import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// Note: role pill styling now comes from shared `ROLE_TONES` (see @/lib/roleTokens)
// to prevent drift with header RoleBadge.
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  ROLE_BADGE_BASE,
  ROLE_TONES,
  resolveRoleTone,
  ADMIN_USER_PLAN_TONES,
  ADMIN_AVATAR_FALLBACK,
  ADMIN_STAT_ACCENTS,
} from "@/lib/roleTokens";
import {
  Search, Users, Shield, Briefcase, User, MoreHorizontal, Plus, X,
  Eye, Ban, CheckCircle2, Trash2, KeyRound, FileCheck2, CreditCard, ListTodo,
} from "lucide-react";
import UserDetailsDialog from "@/components/admin/UserDetailsDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { LoadingState } from "@/components/ui/app";

type Role = "admin" | "provider" | "customer";

type Plan = "free" | "pro" | "elite";
type Status = "active" | "suspended";

interface UserRow {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  roles: Role[];
  plan?: Plan;
  status: Status;
  deleted_at: string | null;
}

const PLANS: Plan[] = ["free", "pro", "elite"];
// Plan chip colors come from shared ADMIN_USER_PLAN_TONES (see @/lib/roleTokens)
// so they stay aligned with the admin status palette.
const planColor: Record<Plan, string> = ADMIN_USER_PLAN_TONES;

const ALL_ROLES: Role[] = ["admin", "provider", "customer"];

/**
 * Per-role icon for the row chip. Color/background come from the shared
 * `ROLE_TONES` map (single source of truth for any role pill in the app).
 */
const roleIcon: Record<Role, typeof Shield> = {
  admin: Shield,
  provider: Briefcase,
  customer: User,
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [pendingRevoke, setPendingRevoke] = useState<{ userId: string; role: Role; name: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [detailsUser, setDetailsUser] = useState<UserRow | null>(null);
  const [detailsTab, setDetailsTab] = useState<"overview" | "verification" | "subscription" | "jobs">("overview");
  const [pendingDelete, setPendingDelete] = useState<UserRow | null>(null);

  const load = async () => {
    const [profilesRes, rolesRes, plansRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, phone, created_at, status, deleted_at")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("provider_settings").select("user_id, plan"),
    ]);

    const profs = profilesRes.data || [];
    const roles = rolesRes.data || [];
    const plans = plansRes.data || [];
    const roleMap: Record<string, Role[]> = {};
    roles.forEach((r: any) => {
      if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
      roleMap[r.user_id].push(r.role as Role);
    });
    const planMap: Record<string, Plan> = {};
    plans.forEach((p: any) => { planMap[p.user_id] = p.plan as Plan; });

    setRows(profs.map((p: any) => ({
      ...p,
      roles: roleMap[p.user_id] || [],
      plan: planMap[p.user_id],
      status: (p.status as Status) ?? "active",
      deleted_at: p.deleted_at,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const grantRole = async (userId: string, role: Role) => {
    const key = `${userId}:${role}`;
    setBusyKey(key);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    setBusyKey(null);
    if (error) {
      toast.error(error.message.includes("duplicate") ? `Already has ${role} role` : `Failed: ${error.message}`);
      return;
    }
    toast.success(`Granted ${role} role`);
    setRows((prev) => prev.map((u) =>
      u.user_id === userId && !u.roles.includes(role) ? { ...u, roles: [...u.roles, role] } : u
    ));
  };

  const revokeRole = async (userId: string, role: Role) => {
    const key = `${userId}:${role}`;
    setBusyKey(key);
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);
    setBusyKey(null);
    if (error) {
      toast.error(`Failed: ${error.message}`);
      return;
    }
    toast.success(`Revoked ${role} role`);
    setRows((prev) => prev.map((u) =>
      u.user_id === userId ? { ...u, roles: u.roles.filter((r) => r !== role) } : u
    ));
  };

  const setPlan = async (userId: string, plan: Plan) => {
    const key = `${userId}:plan`;
    setBusyKey(key);
    const { error } = await supabase
      .from("provider_settings")
      .upsert({ user_id: userId, plan }, { onConflict: "user_id" });
    setBusyKey(null);
    if (error) {
      toast.error(`Failed to set plan: ${error.message}`);
      return;
    }
    toast.success(`Plan set to ${plan}`);
    setRows((prev) => prev.map((u) => (u.user_id === userId ? { ...u, plan } : u)));
  };

  const toggleSuspend = async (u: UserRow) => {
    const next: Status = u.status === "active" ? "suspended" : "active";
    setBusyKey(`${u.user_id}:status`);
    const { error } = await supabase.from("profiles").update({ status: next }).eq("user_id", u.user_id);
    setBusyKey(null);
    if (error) { toast.error(error.message); return; }
    toast.success(next === "suspended" ? "User suspended" : "User reactivated");
    setRows((p) => p.map((r) => r.user_id === u.user_id ? { ...r, status: next } : r));
  };

  const softDelete = async (u: UserRow) => {
    setBusyKey(`${u.user_id}:delete`);
    const { error } = await supabase
      .from("profiles")
      .update({ deleted_at: new Date().toISOString(), status: "suspended" })
      .eq("user_id", u.user_id);
    setBusyKey(null);
    if (error) { toast.error(error.message); return; }
    toast.success("User deleted");
    setRows((p) => p.filter((r) => r.user_id !== u.user_id));
  };

  const resetPassword = async (u: UserRow) => {
    const email = window.prompt(`Send password reset email for ${u.display_name ?? "user"}.\nEnter their email address:`);
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth?reset=1`,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Password reset link sent to ${email}`);
  };

  const openDetails = (u: UserRow, tab: typeof detailsTab = "overview") => {
    setDetailsUser(u);
    setDetailsTab(tab);
  };

  const filtered = useMemo(() => {
    return rows.filter((u) => {
      if (filter !== "all" && !u.roles.includes(filter as Role)) return false;
      if (filter === "active" && u.status !== "active") return false;
      if (filter === "suspended" && u.status !== "suspended") return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${u.display_name ?? ""} ${u.phone ?? ""} ${u.user_id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, search]);

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(filtered, 25);

  const stats = useMemo(() => ({
    total: rows.length,
    admins: rows.filter((u) => u.roles.includes("admin")).length,
    providers: rows.filter((u) => u.roles.includes("provider")).length,
    clients: rows.filter((u) => u.roles.includes("customer")).length,
  }), [rows]);

  if (loading) {
    return (
      <AdminPage title="Users">
        <LoadingState variant="page" />
      </AdminPage>
    );
  }

  return (
    <AdminPage title="Users" subtitle="Browse all platform users and manage their roles.">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Users", value: stats.total,     icon: Users,     ...ADMIN_STAT_ACCENTS.primary },
            { label: "Admins",      value: stats.admins,    icon: Shield,    ...ADMIN_STAT_ACCENTS.danger },
            { label: "Providers",   value: stats.providers, icon: Briefcase, ...ADMIN_STAT_ACCENTS.info },
            { label: "Clients",     value: stats.clients,   icon: User,      ...ADMIN_STAT_ACCENTS.success },
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
            <Input placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="provider">Providers</SelectItem>
              <SelectItem value="customer">Clients</SelectItem>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="suspended">Suspended only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-card rounded-sm border border-border p-12 text-center">
            <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-description-sm">No users match your filters</p>
          </div>
        ) : (
          <div className="bg-card rounded-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-fs-sm">
                <thead>
                  <tr className="border-b border-border text-fs-xs text-muted-foreground">
                    <th className="text-left py-3 px-5 font-medium">User</th>
                    <th className="text-left py-3 px-5 font-medium">Phone</th>
                    <th className="text-left py-3 px-5 font-medium">Roles</th>
                    <th className="text-left py-3 px-5 font-medium">Plan</th>
                    <th className="text-left py-3 px-5 font-medium">Status</th>
                    <th className="text-left py-3 px-5 font-medium">Joined</th>
                    <th className="text-right py-3 px-5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((u) => {
                    const isSelf = currentUser?.id === u.user_id;
                    const missingRoles = ALL_ROLES.filter((r) => !u.roles.includes(r));
                    return (
                      <tr key={u.user_id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={u.avatar_url || undefined} />
                              <AvatarFallback className={cn("text-fs-xs", ADMIN_AVATAR_FALLBACK)}>
                                {(u.display_name || "?")[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-heading font-medium truncate">
                                {u.display_name || "Unnamed"}
                                {isSelf && <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">(you)</span>}
                              </p>
                              <p className="text-[13px] text-muted-foreground font-mono">{u.user_id.slice(0, 8)}…</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-5 text-body text-fs-xs">{u.phone || "—"}</td>
                        <td className="py-3 px-5">
                          <div className="flex flex-wrap gap-1">
                            {u.roles.length === 0 ? (
                              <span className="text-fs-xs text-muted-foreground">—</span>
                            ) : (
                              u.roles.map((r) => {
                                const Icon = roleIcon[r];
                                const tone = ROLE_TONES[resolveRoleTone(r)];
                                const key = `${u.user_id}:${r}`;
                                const canRevoke = !(isSelf && r === "admin");
                                return (
                                  <span
                                    key={r}
                                    className={cn(ROLE_BADGE_BASE, tone, "gap-1 capitalize")}
                                    aria-label={`Role: ${r}`}
                                  >
                                    <Icon className="w-3 h-3" aria-hidden="true" /> {r}
                                    {canRevoke && (
                                      <button
                                        type="button"
                                        disabled={busyKey === key}
                                        onClick={() => setPendingRevoke({ userId: u.user_id, role: r, name: u.display_name || "this user" })}
                                        className="ml-0.5 opacity-60 hover:opacity-100 disabled:opacity-30"
                                        aria-label={`Revoke ${r}`}
                                      >
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    )}
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-5">
                          {u.roles.includes("provider") ? (
                            <Select
                              value={u.plan ?? "free"}
                              onValueChange={(v) => setPlan(u.user_id, v as Plan)}
                              disabled={busyKey === `${u.user_id}:plan`}
                            >
                              <SelectTrigger className={cn("h-7 w-[100px] text-fs-xs capitalize border-0 px-2", planColor[u.plan ?? "free"])}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PLANS.map((p) => (
                                  <SelectItem key={p} value={p} className="capitalize text-fs-xs">
                                    {p}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-fs-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-5">
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-fs-xs font-medium",
                            u.status === "active"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          )}>
                            {u.status === "active" ? <CheckCircle2 className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                            {u.status}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-fs-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="py-3 px-5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="User actions">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuLabel className="text-fs-xs">Manage</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openDetails(u, "overview")} className="text-fs-sm gap-2">
                                <Eye className="w-3.5 h-3.5" /> View details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openDetails(u, "verification")} className="text-fs-sm gap-2">
                                <FileCheck2 className="w-3.5 h-3.5" /> View verification
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openDetails(u, "subscription")} className="text-fs-sm gap-2">
                                <CreditCard className="w-3.5 h-3.5" /> View subscription
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openDetails(u, "jobs")} className="text-fs-sm gap-2">
                                <ListTodo className="w-3.5 h-3.5" /> View jobs
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => toggleSuspend(u)}
                                disabled={isSelf || busyKey === `${u.user_id}:status`}
                                className="text-fs-sm gap-2"
                              >
                                {u.status === "active"
                                  ? <><Ban className="w-3.5 h-3.5" /> Suspend</>
                                  : <><CheckCircle2 className="w-3.5 h-3.5" /> Activate</>}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => resetPassword(u)} className="text-fs-sm gap-2">
                                <KeyRound className="w-3.5 h-3.5" /> Reset password
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setPendingDelete(u)}
                                disabled={isSelf}
                                className="text-fs-sm gap-2 text-destructive focus:text-destructive"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-fs-xs">Grant role</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {missingRoles.length === 0 ? (
                                <DropdownMenuItem disabled className="text-fs-xs">Has all roles</DropdownMenuItem>
                              ) : (
                                missingRoles.map((r) => {
                                  const Icon = roleIcon[r];
                                  return (
                                    <DropdownMenuItem
                                      key={r}
                                      onClick={() => grantRole(u.user_id, r)}
                                      className="capitalize text-fs-sm gap-2"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <Icon className="w-3.5 h-3.5" />
                                      {r}
                                    </DropdownMenuItem>
                                  );
                                })
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      <AlertDialog open={!!pendingRevoke} onOpenChange={(o) => !o && setPendingRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {pendingRevoke?.role} role?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the <span className="font-medium capitalize">{pendingRevoke?.role}</span> role from{" "}
              <span className="font-medium">{pendingRevoke?.name}</span>. They will lose access to features
              that require this role. You can re-grant it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRevoke) revokeRole(pendingRevoke.userId, pendingRevoke.role);
                setPendingRevoke(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This soft-deletes <span className="font-medium">{pendingDelete?.display_name ?? "this user"}</span>:
              their profile is marked deleted and the account is suspended. They will no longer appear in the list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (pendingDelete) softDelete(pendingDelete); setPendingDelete(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UserDetailsDialog
        user={detailsUser ? {
          user_id: detailsUser.user_id,
          display_name: detailsUser.display_name,
          avatar_url: detailsUser.avatar_url,
          phone: detailsUser.phone,
          created_at: detailsUser.created_at,
          roles: detailsUser.roles,
          plan: detailsUser.plan,
          status: detailsUser.status,
        } : null}
        initialTab={detailsTab}
        onClose={() => setDetailsUser(null)}
      />
    </AdminPage>
  );
}
