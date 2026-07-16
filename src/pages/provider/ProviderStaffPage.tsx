import { useEffect, useState } from"react";
import { format } from"date-fns";
import {
 Users,
 UserPlus,
 Trash2,
 Copy,
 Check,
 Crown,
 Loader2,
 Mail,
 ShieldAlert,
} from"lucide-react";
import { toast } from"sonner";

import DashboardLayout from"@/components/DashboardLayout";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Badge } from"@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from"@/components/ui/avatar";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import {
 Tooltip,
 TooltipContent,
 TooltipProvider,
 TooltipTrigger,
} from"@/components/ui/tooltip";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import { supabase } from"@/integrations/supabase/client";
import { useAuth } from"@/contexts/AuthContext";
import { cn } from"@/lib/utils";
import { usePagination } from"@/hooks/usePagination";
import NumberedPagination from"@/components/common/NumberedPagination";
import { Heading } from "@/components/ui/app";

type StaffInviteRole ="staff" |"manager" |"provider_admin";

const ROLE_OPTIONS: { value: StaffInviteRole; label: string; description: string }[] = [
 { value:"staff", label:"Staff", description:"Receives assigned bookings only." },
 { value:"manager", label:"Manager", description:"Can manage staff and services." },
 { value:"provider_admin", label:"Team admin", description:"Full access to the provider workspace." },
];

const ROLE_BADGE: Record<StaffInviteRole, { label: string; tone: string }> = {
 staff: { label:"Staff", tone:"bg-muted text-muted-foreground" },
 manager: { label:"Manager", tone:"bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" },
 provider_admin: { label:"Team admin", tone:"bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" },
};

type Plan ="free" |"pro" |"elite";

const PLAN_LIMITS: Record<Plan, number> = { free: 1, pro: 5, elite: 999 };
const PLAN_LABEL: Record<Plan, string> = {
 free:"Free",
 pro:"Pro",
 elite:"Elite",
};

interface StaffMember {
 id: string;
 staff_user_id: string;
 title: string | null;
 role: StaffInviteRole;
 is_active: boolean;
 created_at: string;
 display_name: string;
 avatar_url: string | null;
}

interface PendingInvite {
 id: string;
 email: string;
 title: string | null;
 role: StaffInviteRole;
 token: string;
 expires_at: string;
 created_at: string;
}

const initials = (n: string) =>
 n
 .split("")
 .map((p) => p[0])
 .filter(Boolean)
 .slice(0, 2)
 .join("")
 .toUpperCase() ||"?";

export default function ProviderStaffPage() {
 const { user } = useAuth();
 const [plan, setPlan] = useState<Plan>("free");
 const [staff, setStaff] = useState<StaffMember[]>([]);
 const [invites, setInvites] = useState<PendingInvite[]>([]);
 const [loading, setLoading] = useState(true);
 const [inviteOpen, setInviteOpen] = useState(false);
 const [email, setEmail] = useState("");
 const [title, setTitle] = useState("");
 const [role, setRole] = useState<StaffInviteRole>("staff");
 const [sending, setSending] = useState(false);
 const [lastUrl, setLastUrl] = useState<string | null>(null);
 const [copied, setCopied] = useState(false);

 const limit = PLAN_LIMITS[plan];
 const activeSeats = staff.filter((s) => s.is_active).length;
 const pendingSeats = invites.length;
 const seatsUsed = activeSeats + pendingSeats;
 const seatsLeft = Math.max(0, limit - seatsUsed);
 const isFree = plan ==="free";
 const limitLabel = limit === 999 ?"∞" : limit;
 const { page: staffPage, setPage: setStaffPage, totalPages: staffTotalPages, totalItems: staffTotalItems, pageItems: paginatedStaff, pageSize: staffPageSize, setPageSize: setStaffPageSize } = usePagination(staff, 10);
 const { page: invitePage, setPage: setInvitePage, totalPages: inviteTotalPages, totalItems: inviteTotalItems, pageItems: paginatedInvites, pageSize: invitePageSize, setPageSize: setInvitePageSize } = usePagination(invites, 10);

 const refresh = async () => {
 if (!user) return;
 setLoading(true);

 const [{ data: settings }, { data: staffRows }, { data: inviteRows }] =
 await Promise.all([
 supabase
 .from("provider_settings")
 .select("plan")
 .eq("user_id", user.id)
 .maybeSingle(),
 supabase
 .from("provider_staff")
 .select("id, staff_user_id, title, is_active, created_at, role")
 .eq("provider_id", user.id)
 .order("created_at", { ascending: true }),
 supabase
 .from("staff_invitations")
 .select("id, email, title, token, expires_at, created_at, role")
 .eq("provider_id", user.id)
 .eq("status","pending")
 .order("created_at", { ascending: false }),
 ]);

 setPlan(((settings?.plan as Plan) ??"free"));

 // Hydrate staff with profile names
 const ids = (staffRows ?? []).map((s) => s.staff_user_id);
 let profilesMap = new Map<string, { display_name: string; avatar_url: string | null }>();
 if (ids.length > 0) {
 const { data: profs } = await supabase
 .from("profiles")
 .select("user_id, display_name, avatar_url")
 .in("user_id", ids);
 profilesMap = new Map(
 (profs ?? []).map((p) => [
 p.user_id,
 {
 display_name: p.display_name?.trim() ||"Staff member",
 avatar_url: p.avatar_url,
 },
 ])
 );
 }

 setStaff(
 (staffRows ?? []).map((s: any) => ({
 ...s,
 role: (s.role as StaffInviteRole) ??"staff",
 display_name: profilesMap.get(s.staff_user_id)?.display_name ??"Staff member",
 avatar_url: profilesMap.get(s.staff_user_id)?.avatar_url ?? null,
 }))
 );
 setInvites(
 (inviteRows ?? []).map((i: any) => ({
 ...i,
 role: (i.role as StaffInviteRole) ??"staff",
 }))
 );
 setLoading(false);
 };

 useEffect(() => {
 refresh();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [user]);

 const handleInvite = async () => {
 if (!email.trim()) {
 toast.error("Enter an email address.");
 return;
 }
 setSending(true);
 setLastUrl(null);
 const { data, error } = await supabase.functions.invoke("invite-staff", {
 body: { email: email.trim(), title: title.trim() || undefined, role },
 });
 setSending(false);

 if (error) {
 toast.error(error.message);
 return;
 }
 if (data?.error) {
 toast.error(typeof data.error ==="string" ? data.error :"Could not send invite.");
 return;
 }

 setLastUrl(data.accept_url);
 setEmail("");
 setTitle("");
 setRole("staff");
 toast.success("Invitation created — share the link below.");
 refresh();
 };

 const copyInviteUrl = async (url: string) => {
 try {
 await navigator.clipboard.writeText(url);
 setCopied(true);
 toast.success("Link copied.");
 setTimeout(() => setCopied(false), 2000);
 } catch {
 toast.error("Couldn't copy. Long-press to copy manually.");
 }
 };

 const revokeInvite = async (id: string) => {
 const { error } = await supabase
 .from("staff_invitations")
 .update({ status:"revoked" })
 .eq("id", id);
 if (error) return toast.error(error.message);
 setInvites((prev) => prev.filter((i) => i.id !== id));
 toast.success("Invitation revoked.");
 };

 const removeStaff = async (id: string) => {
 if (!confirm("Remove this staff member? They will lose access to your bookings.")) return;
 const { error } = await supabase.from("provider_staff").delete().eq("id", id);
 if (error) return toast.error(error.message);
 setStaff((prev) => prev.filter((s) => s.id !== id));
 toast.success("Staff member removed.");
 };

 const buildUrl = (token: string) =>`${window.location.origin}/accept-invite/${token}`;

 return (
 <DashboardLayout
 title="Staff"
 subtitle="Invite team members and assign them to bookings."
 >
 {/* Plan banner */}
 <div className="rounded-sm border border-border bg-card p-4 mb-5 flex items-center gap-3">
 <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
 <Crown className="h-5 w-5" />
 </span>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <p className="text-fs-sm font-semibold text-foreground">
 {PLAN_LABEL[plan]} plan
 </p>
 <TooltipProvider delayDuration={150}>
 <Tooltip>
 <TooltipTrigger asChild>
 <Badge variant="secondary" className="text-[10px] h-5 cursor-help">
 {seatsUsed}/{limitLabel} seats
 </Badge>
 </TooltipTrigger>
 <TooltipContent side="bottom" className="text-fs-xs">
 {activeSeats} active + {pendingSeats} pending = {seatsUsed}/{limitLabel}
 </TooltipContent>
 </Tooltip>
 </TooltipProvider>
 {pendingSeats > 0 && (
 <button
 type="button"
 onClick={() =>
 document
 .getElementById("pending-invitations")
 ?.scrollIntoView({ behavior:"smooth", block:"start" })
 }
 aria-label={`Jump to ${pendingSeats} pending invitation${pendingSeats === 1 ?"" :"s"}`}
 className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
 >
 <Badge
 variant="outline"
 className="text-[10px] h-5 border-primary/30 text-primary cursor-pointer hover:bg-primary/10 transition-colors"
 >
 {pendingSeats} pending
 </Badge>
 </button>
 )}
 </div>
 <p className="text-fs-xs text-muted-foreground mt-0.5">
 {isFree
 ?"Upgrade to Pro for up to 5 staff, or Elite for unlimited."
 : plan ==="pro"
 ?"You can invite up to 5 staff. Upgrade to Elite for unlimited seats."
 :"Unlimited staff seats included."}
 </p>
 </div>
 {isFree && (
 <Button
 size="sm"
 variant="outline"
 onClick={() => (window.location.href ="/provider-lead-credits")}
 >
 Upgrade
 </Button>
 )}
 </div>

 <div className="flex items-center justify-between mb-3">
 <p className="text-description-sm">
 {staff.length} active · {invites.length} pending
 </p>
 <Button
 onClick={() => {
 setLastUrl(null);
 setInviteOpen(true);
 }}
 size="sm"
 disabled={seatsLeft === 0}
 className="gap-1.5"
 >
 <UserPlus className="h-4 w-4" />
 Invite staff
 </Button>
 </div>

 {/* Active staff */}
 <div className="rounded-sm border border-border bg-card mb-4">
 {loading ? (
 <div className="p-8 flex items-center justify-center text-muted-foreground">
 <Loader2 className="h-5 w-5 animate-spin mr-2" />
 Loading…
 </div>
 ) : staff.length === 0 ? (
 <div className="p-8 text-center">
 <Users className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
 <p className="text-description-sm">
 No staff yet. Invite a teammate to share the workload.
 </p>
 </div>
 ) : (
 <>
 <ul className="divide-y divide-border">
 {paginatedStaff.map((s) => (
 <li key={s.id} className="flex items-center gap-3 p-4">
 <Avatar className="h-10 w-10 shrink-0">
 {s.avatar_url && <AvatarImage src={s.avatar_url} alt={s.display_name} />}
 <AvatarFallback className="bg-primary/10 text-primary text-fs-xs font-semibold">
 {initials(s.display_name)}
 </AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <p className="text-fs-sm font-semibold text-foreground truncate">
 {s.display_name}
 </p>
 <Badge variant="secondary" className={cn("text-[10px]", ROLE_BADGE[s.role].tone)}>
 {ROLE_BADGE[s.role].label}
 </Badge>
 </div>
 <p className="text-fs-xs text-muted-foreground truncate">
 {s.title ||"Staff member"} · joined {format(new Date(s.created_at),"MMM d, yyyy")}
 </p>
 </div>
 <Button
 size="icon"
 variant="ghost"
 onClick={() => removeStaff(s.id)}
 aria-label="Remove"
 >
 <Trash2 className="h-4 w-4 text-destructive" />
 </Button>
 </li>
 ))}
 </ul>
 <NumberedPagination
 currentPage={staffPage}
 totalPages={staffTotalPages}
 totalItems={staffTotalItems}
 pageSize={staffPageSize}
 onPageChange={setStaffPage}
 className="px-4 pb-4"
 onPageSizeChange={setStaffPageSize}
 />
 </>
 )}
 </div>

 {/* Pending invites */}
 {invites.length > 0 && (
 <div id="pending-invitations" className="rounded-sm border border-border bg-card scroll-mt-24">
 <div className="px-4 py-3 border-b border-border">
 <Heading level={3}  className="uppercase text-muted-foreground">
 Pending invitations
 </Heading>
 </div>
 <ul className="divide-y divide-border">
 {paginatedInvites.map((i) => {
 const url = buildUrl(i.token);
 return (
 <li key={i.id} className="p-4">
 <div className="flex items-center gap-3">
 <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
 <Mail className="h-4 w-4" />
 </span>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <p className="text-fs-sm font-medium text-foreground truncate">
 {i.email}
 </p>
 <Badge variant="secondary" className={cn("text-[10px]", ROLE_BADGE[i.role].tone)}>
 {ROLE_BADGE[i.role].label}
 </Badge>
 </div>
 <p className="text-fs-xs text-muted-foreground">
 {i.title ||"Staff"} · expires {format(new Date(i.expires_at),"MMM d")}
 </p>
 </div>
 <Button
 size="sm"
 variant="outline"
 onClick={() => copyInviteUrl(url)}
 className="gap-1.5"
 >
 <Copy className="h-3.5 w-3.5" />
 Copy link
 </Button>
 <Button
 size="icon"
 variant="ghost"
 onClick={() => revokeInvite(i.id)}
 aria-label="Revoke"
 >
 <Trash2 className="h-4 w-4 text-destructive" />
 </Button>
 </div>
 </li>
 );
 })}
 </ul>
 <NumberedPagination
 currentPage={invitePage}
 totalPages={inviteTotalPages}
 totalItems={inviteTotalItems}
 pageSize={invitePageSize}
 onPageChange={setInvitePage}
 className="px-4 pb-4"
 onPageSizeChange={setInvitePageSize}
 />
 </div>
 )}

 {/* Invite dialog */}
 <Dialog
 open={inviteOpen}
 onOpenChange={(open) => {
 setInviteOpen(open);
 // When dialog closes, re-pull invites/staff so the seat counter
 // reflects any invitation just created (or revoked) inside it.
 if (!open) {
 setLastUrl(null);
 void refresh();
 }
 }}
 >
 <DialogContent className="max-w-md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <UserPlus className="h-4 w-4 text-primary" />
 Invite a staff member
 </DialogTitle>
 </DialogHeader>

 {seatsLeft === 0 ? (
 <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 flex items-start gap-3">
 <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
 <div className="text-fs-sm">
 <p className="font-semibold text-destructive">No seats left</p>
 <p className="text-muted-foreground mt-1">
 Your {PLAN_LABEL[plan]} plan allows {limit} staff
 {limit === 1 ?" seat" :" seats"}. Upgrade to invite more.
 </p>
 </div>
 </div>
 ) : (
 <div className="space-y-4">
 <div className="space-y-1.5">
 <Label className="text-fs-xs">Email address</Label>
 <Input
 type="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 placeholder="teammate@example.com"
 maxLength={255}
 />
 </div>
 <div className="space-y-1.5">
 <Label className="text-fs-xs">Job title (optional)</Label>
 <Input
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 placeholder="e.g. Senior Plumber"
 maxLength={100}
 />
 </div>
 <div className="space-y-1.5">
 <Label className="text-fs-xs">Role</Label>
 <Select
 value={role}
 onValueChange={(v) => setRole(v as StaffInviteRole)}
 disabled={sending || !!lastUrl}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select a role" />
 </SelectTrigger>
 <SelectContent>
 {ROLE_OPTIONS.map((opt) => (
 <SelectItem key={opt.value} value={opt.value}>
 <div className="flex flex-col items-start">
 <span className="text-fs-sm font-medium">{opt.label}</span>
 <span className="text-[13px] text-muted-foreground">
 {opt.description}
 </span>
 </div>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {lastUrl && (
 <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
 <p className="text-fs-xs font-semibold text-foreground">
 Share this link with your teammate
 </p>
 <div className="flex items-center gap-2">
 <code className="flex-1 text-[13px] bg-background border border-border rounded px-2 py-1.5 truncate font-mono">
 {lastUrl}
 </code>
 <Button
 size="sm"
 variant="outline"
 onClick={() => copyInviteUrl(lastUrl)}
 className="gap-1.5 shrink-0"
 >
 {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
 {copied ?"Copied" :"Copy"}
 </Button>
 </div>
 <p className="text-[13px] text-muted-foreground">
 They'll need to sign up (or sign in) and click the link to join your team.
 </p>
 </div>
 )}

 <div className="flex justify-end gap-2 pt-2">
 <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={sending}>
 {lastUrl ?"Done" :"Cancel"}
 </Button>
 {!lastUrl && (
 <Button onClick={handleInvite} disabled={sending}>
 {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
 Create invite
 </Button>
 )}
 </div>
 </div>
 )}
 </DialogContent>
 </Dialog>
 </DashboardLayout>
 );
}
