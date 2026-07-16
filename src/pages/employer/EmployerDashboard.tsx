import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Users, Star, CreditCard, ShieldCheck, TrendingUp, BarChart3 } from "lucide-react";
import { format, formatDistanceToNow, subDays, startOfDay } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts";

import DashboardLayout from "@/components/DashboardLayout";
import { Heading, AppCard } from "@/components/ui/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface TaskRow { id: string; title: string; status: string; created_at: string; }
interface ProposalRow { id: string; status: string; task_id: string; vendor_id: string; created_at: string; quoted_price: number | null; }
interface PaymentRow { id: string; amount: number; status: string; created_at: string; task_id: string | null; }

const EmployerDashboard = () => {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [shortlisted, setShortlisted] = useState<Array<ProposalRow & { vendor_name: string | null; vendor_avatar: string | null; task_title: string | null }>>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [verification, setVerification] = useState<"pending" | "verified" | "rejected" | "expired" | null>(null);
  const [verificationExpiresAt, setVerificationExpiresAt] = useState<string | null>(null);
  const [warnDays, setWarnDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    if (!user) return;
    (async () => {
      const [tasksRes, propsRes, payRes, empRes, warnRes] = await Promise.all([
        supabase.from("tasks").select("id, title, status, created_at").eq("customer_id", user.id).order("created_at", { ascending: false }),
        supabase.from("task_proposals").select("id, status, task_id, vendor_id, created_at, quoted_price").eq("customer_id", user.id).order("created_at", { ascending: false }),
        supabase.from("task_payments").select("id, amount, status, created_at, task_id").eq("employer_id", user.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("employer_profiles").select("verification_status, verification_expires_at").eq("user_id", user.id).maybeSingle(),
        supabase.from("platform_settings").select("value").eq("key", "verification_warn_days").maybeSingle(),
      ]);
      const tList = (tasksRes.data || []) as TaskRow[];
      const pList = (propsRes.data || []) as ProposalRow[];
      setTasks(tList);
      setProposals(pList);
      setPayments((payRes.data || []) as PaymentRow[]);
      setVerification((empRes.data?.verification_status as any) ?? null);
      setVerificationExpiresAt((empRes.data as { verification_expires_at?: string | null } | null)?.verification_expires_at ?? null);
      const parsed = parseInt(String(warnRes.data?.value ?? "").replace(/[^0-9]/g, ""), 10);
      if (Number.isFinite(parsed) && parsed > 0) setWarnDays(parsed);


      const sl = pList.filter((p) => p.status === "shortlisted").slice(0, 5);
      if (sl.length > 0) {
        const vendorIds = [...new Set(sl.map((p) => p.vendor_id))];
        const taskIds = [...new Set(sl.map((p) => p.task_id))];
        const [vp, tp] = await Promise.all([
          supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", vendorIds),
          supabase.from("tasks").select("id, title").in("id", taskIds),
        ]);
        const vMap = new Map((vp.data || []).map((v) => [v.user_id, v]));
        const tMap = new Map((tp.data || []).map((t) => [t.id, t.title]));
        setShortlisted(sl.map((p) => ({
          ...p,
          vendor_name: vMap.get(p.vendor_id)?.display_name ?? null,
          vendor_avatar: vMap.get(p.vendor_id)?.avatar_url ?? null,
          task_title: tMap.get(p.task_id) ?? null,
        })));
      } else {
        setShortlisted([]);
      }
      setLoading(false);
    })();
  }, [user]);

  const activeJobs = tasks.filter((t) => ["open", "in_progress"].includes(t.status));
  const pendingApps = proposals.filter((p) => p.status === "pending");
  const totalSpend = payments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);

  // 14-day applications trend
  const trend = useMemo(() => {
    const days = Array.from({ length: 14 }).map((_, i) => startOfDay(subDays(new Date(), 13 - i)));
    return days.map((d) => ({
      day: format(d, "MMM d"),
      apps: proposals.filter((p) => startOfDay(new Date(p.created_at)).getTime() === d.getTime()).length,
    }));
  }, [proposals]);

  const stats = [
    { label: "Active jobs", value: activeJobs.length, icon: Briefcase },
    { label: "Applications", value: proposals.length, icon: Users },
    { label: "Shortlisted", value: proposals.filter((p) => p.status === "shortlisted").length, icon: Star },
    { label: "Total spend", value: `$${totalSpend.toFixed(0)}`, icon: TrendingUp },
  ];

  const verifyBadge = verification === "verified"
    ? { label: "Verified", variant: "default" as const }
    : verification === "rejected"
    ? { label: "Rejected", variant: "destructive" as const }
    : { label: "Pending review", variant: "secondary" as const };

  return (
    <DashboardLayout title="Employer dashboard" subtitle={`Welcome back, ${profile?.display_name?.split(" ")[0] || "Employer"}`}>
      <div className="space-y-6">
        {(() => {
          if (!verificationExpiresAt && verification !== "expired") return null;
          const ms = verificationExpiresAt ? new Date(verificationExpiresAt).getTime() : 0;
          const daysLeft = Math.ceil((ms - Date.now()) / 86_400_000);
          const isExpired = verification === "expired" || (ms > 0 && ms <= Date.now());
          const isSoon = !isExpired && daysLeft > 0 && daysLeft <= warnDays;
          if (!isExpired && !isSoon) return null;
          return (
            <div className={`rounded-sm border px-4 py-3 flex items-start gap-3 ${isExpired ? "border-destructive/30 bg-destructive/5" : "border-amber-500/30 bg-amber-500/5"}`}>
              <ShieldCheck className={`w-5 h-5 shrink-0 mt-0.5 ${isExpired ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-fs-sm font-semibold text-foreground">
                  {isExpired ? "Your company verification has expired" : `Verification expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
                </p>
                <p className="text-fs-xs text-muted-foreground">
                  {isExpired
                    ? "Re-verify to restore the Verified badge on your job posts."
                    : "Renew now to keep the Verified badge on your job posts without interruption."}
                </p>
              </div>
              <Link to="/employer-verification">
                <Button size="sm" variant={isExpired ? "destructive" : "default"}>
                  {isExpired ? "Re-verify now" : "Renew"}
                </Button>
              </Link>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {stats.map(({ label, value, icon: Icon }) => (
            <AppCard key={label} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-fs-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="text-fs-2xl font-semibold mt-1 text-heading">{loading ? "—" : value}</p>
                </div>
                <Icon className="w-5 h-5 text-accent-foreground" />
              </div>
            </AppCard>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Active Jobs */}
            <AppCard className="p-5">
              <header className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  <Heading level={2} >Active jobs</Heading>
                </div>
                <Link to="/employer-jobs"><Button size="sm" variant="outline" className="text-fs-xs">Manage</Button></Link>
              </header>
              {activeJobs.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-fs-xs text-muted-foreground mb-3">No active jobs yet.</p>
                  <Link to="/employer-post-job"><Button size="sm">Post a job</Button></Link>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {activeJobs.slice(0, 5).map((t) => {
                    const count = proposals.filter((p) => p.task_id === t.id).length;
                    return (
                      <li key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-fs-sm font-medium text-heading truncate">{t.title}</p>
                          <p className="text-fs-xs text-muted-foreground">
                            Posted {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-fs-2xs shrink-0">{count} apps</Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </AppCard>

            {/* Applications */}
            <AppCard className="p-5">
              <header className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <Heading level={2} >Job applications</Heading>
                </div>
                <Badge variant="secondary" className="text-fs-2xs">{pendingApps.length} pending</Badge>
              </header>
              {proposals.length === 0 ? (
                <p className="text-fs-xs text-muted-foreground py-3 text-center">No applications yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {proposals.slice(0, 5).map((p) => (
                    <li key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-fs-sm font-medium text-heading truncate">
                          {tasks.find((t) => t.id === p.task_id)?.title || "Job"}
                        </p>
                        <p className="text-fs-xs text-muted-foreground">
                          Quote: {p.quoted_price ? `$${p.quoted_price}` : "—"} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge
                        variant={p.status === "accepted" ? "default" : p.status === "shortlisted" ? "secondary" : "outline"}
                        className="text-fs-2xs capitalize shrink-0"
                      >
                        {p.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </AppCard>

            {/* Analytics */}
            <AppCard className="p-5">
              <header className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-primary" />
                <Heading level={2} >Applications · last 14 days</Heading>
              </header>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend}>
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={1} />
                    <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
                    <Bar dataKey="apps" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </AppCard>
          </div>

          <div className="space-y-6">
            {/* Verification Status */}
            <AppCard className="p-5">
              <header className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <Heading level={3} >Verification</Heading>
                </div>
                <Badge variant={verifyBadge.variant} className="text-fs-2xs">{verifyBadge.label}</Badge>
              </header>
              <p className="text-fs-xs text-muted-foreground mb-3">
                {verification === "verified"
                  ? "Your company is verified — applicants see a trust badge on your jobs."
                  : verification === "rejected"
                  ? "Verification was rejected. Please update your documents."
                  : "Submit your company documents to earn the verified badge."}
              </p>
              <Link to={verification === "verified" ? "/employer-profile" : "/employer-verification"}>
                <Button size="sm" variant="outline" className="w-full text-fs-xs">
                  {verification === "verified" ? "View profile" : "Manage verification"}
                </Button>
              </Link>
            </AppCard>

            {/* Shortlisted */}
            <AppCard className="p-5">
              <header className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-amber-500" />
                <Heading level={3} >Shortlisted providers</Heading>
              </header>
              {shortlisted.length === 0 ? (
                <p className="text-fs-xs text-muted-foreground py-3 text-center">No shortlisted providers yet.</p>
              ) : (
                <ul className="space-y-2">
                  {shortlisted.map((s) => (
                    <li key={s.id}>
                      <Link to={`/provider/${s.vendor_id}`} className="flex items-center gap-2 hover:bg-muted/50 rounded-sm p-1.5">
                        {s.vendor_avatar ? (
                          <img src={s.vendor_avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-muted" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-fs-xs font-medium text-heading truncate">{s.vendor_name || "Provider"}</p>
                          <p className="text-fs-2xs text-muted-foreground truncate">{s.task_title}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </AppCard>

            {/* Payment History */}
            <AppCard className="p-5">
              <header className="flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-primary" />
                <Heading level={3} >Payment history</Heading>
              </header>
              {payments.length === 0 ? (
                <p className="text-fs-xs text-muted-foreground py-3 text-center">No payments yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {payments.slice(0, 5).map((p) => (
                    <li key={p.id} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-fs-xs font-medium text-heading">${Number(p.amount).toFixed(2)}</p>
                        <p className="text-fs-2xs text-muted-foreground">
                          {format(new Date(p.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Badge
                        variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "secondary"}
                        className="text-fs-2xs capitalize"
                      >
                        {p.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </AppCard>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EmployerDashboard;