import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, subMonths } from "date-fns";
import {
  DollarSign, Users, CalendarCheck, TrendingUp, BarChart3,
  ShieldCheck, Percent, Layers, Settings, Briefcase, Building2, UserCheck, FileCheck,
  Activity, UserPlus, CreditCard, Star, Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { Heading, LoadingState } from "@/components/ui/app";

const COMMISSION_RATE = 10;

const AdminDashboard = () => {
  const [stats, setStats] = useState<any>(null);
  const [bookingsByMonth, setBookingsByMonth] = useState<any[]>([]);
  const [revenueByMonth, setRevenueByMonth] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

    const [
      providersRes, clientsRes, bookingsRes,
      monthlyBookingsRes, recentRes, categoriesRes, subcatsRes,
      employersRes, activeJobsRes, pendingVerifsRes,
      usersThisMonthRes, usersPrevMonthRes,
      sponsorshipsRes,
    ] = await Promise.all([
      supabase.from("user_roles").select("id").eq("role", "provider"),
      supabase.from("user_roles").select("id").eq("role", "customer"),
      supabase.from("bookings").select("id, created_at, total_price, status"),
      supabase.from("bookings").select("id").gte("created_at", monthStart),
      supabase.from("bookings").select("id, booking_date, start_time, total_price, status, payment_status").order("created_at", { ascending: false }).limit(8),
      supabase.from("service_categories").select("id, name, icon"),
      supabase.from("service_subcategories").select("id, category_id"),
      supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "employer" as any),
      supabase.from("tasks").select("id", { count: "exact", head: true }).in("status", ["published", "open", "applied", "shortlisted", "accepted", "in_progress"] as any),
      supabase.from("vendor_verifications").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("profiles").select("user_id", { count: "exact", head: true }).gte("created_at", monthStart),
      supabase.from("profiles").select("user_id", { count: "exact", head: true }).gte("created_at", prevMonthStart).lt("created_at", monthStart),
      supabase.from("sponsorship_orders").select("id, status, amount, ends_at"),
    ]);

    const allBookings = bookingsRes.data || [];
    const completedBookings = allBookings.filter((b: any) => b.status === "completed");
    const totalBookingRevenue = completedBookings.reduce((s: number, b: any) => s + (b.total_price || 0), 0);
    const commissionRevenue = totalBookingRevenue * (COMMISSION_RATE / 100);

    const totalEmployers = employersRes.count ?? 0;
    const activeJobs = activeJobsRes.count ?? 0;
    const pendingVerifs = pendingVerifsRes.count ?? 0;
    const usersThisMonth = usersThisMonthRes.count ?? 0;
    const usersPrevMonth = usersPrevMonthRes.count ?? 0;
    const monthlyGrowth = usersPrevMonth > 0
      ? ((usersThisMonth - usersPrevMonth) / usersPrevMonth) * 100
      : usersThisMonth > 0 ? 100 : 0;

    const sponsorshipRows = (sponsorshipsRes.data || []) as any[];
    const sponsorshipPending = sponsorshipRows.filter((s) => s.status === "pending").length;
    const sponsorshipActive = sponsorshipRows.filter((s) => s.status === "active" && new Date(s.ends_at) > new Date()).length;
    const sponsorshipRevenue = sponsorshipRows
      .filter((s) => s.status !== "rejected" && s.status !== "cancelled")
      .reduce((sum, s) => sum + Number(s.amount || 0), 0);

    setStats({
      totalProviders: providersRes.data?.length || 0,
      totalClients: clientsRes.data?.length || 0,
      totalBookings: allBookings.length,
      monthlyBookings: monthlyBookingsRes.data?.length || 0,
      completedBookings: completedBookings.length,
      totalRevenue: totalBookingRevenue,
      commissionRevenue,
      totalEmployers,
      activeJobs,
      pendingVerifs,
      usersThisMonth,
      usersPrevMonth,
      monthlyGrowth,
      sponsorshipPending,
      sponsorshipActive,
      sponsorshipRevenue,
    });

    const months: any[] = [];
    const revMonths: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const label = format(d, "MMM");
      const monthStr = format(d, "yyyy-MM");
      const monthBookings = allBookings.filter((b: any) => b.created_at.startsWith(monthStr));
      const revenue = monthBookings.filter((b: any) => b.status === "completed").reduce((s: number, b: any) => s + (b.total_price || 0), 0);
      months.push({ month: label, bookings: monthBookings.length });
      revMonths.push({ month: label, revenue: revenue * (COMMISSION_RATE / 100) });
    }
    setBookingsByMonth(months);
    setRevenueByMonth(revMonths);
    setRecentBookings(recentRes.data || []);

    // Recent activity feed
    const [newUsersRes, newJobsRes, newPaymentsRes, newVerifsRes, newReviewsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, created_at").order("created_at", { ascending: false }).limit(8),
      supabase.from("tasks").select("id, title, created_at").order("created_at", { ascending: false }).limit(8),
      supabase.from("payment_transactions").select("id, amount, payment_type, status, created_at").order("created_at", { ascending: false }).limit(8),
      supabase.from("vendor_verifications").select("id, business_name, reviewed_at").eq("status", "approved").not("reviewed_at", "is", null).order("reviewed_at", { ascending: false }).limit(8),
      supabase.from("reviews").select("id, rating, comment, created_at").order("created_at", { ascending: false }).limit(8),
    ]);
    const feed = [
      ...(newUsersRes.data || []).map((u: any) => ({ type: "register", at: u.created_at, title: "New registration", desc: u.display_name || "New user", icon: UserPlus, accent: "text-indigo-500", bg: "bg-indigo-500/10" })),
      ...(newJobsRes.data || []).map((j: any) => ({ type: "job", at: j.created_at, title: "New job posted", desc: j.title, icon: Briefcase, accent: "text-amber-500", bg: "bg-amber-500/10" })),
      ...(newPaymentsRes.data || []).map((p: any) => ({ type: "payment", at: p.created_at, title: "New payment", desc: `$${Number(p.amount || 0).toLocaleString()} · ${p.payment_type} · ${p.status}`, icon: CreditCard, accent: "text-emerald-500", bg: "bg-emerald-500/10" })),
      ...(newVerifsRes.data || []).map((v: any) => ({ type: "verif", at: v.reviewed_at, title: "Verification approved", desc: v.business_name || "Provider verified", icon: ShieldCheck, accent: "text-violet-500", bg: "bg-violet-500/10" })),
      ...(newReviewsRes.data || []).map((r: any) => ({ type: "review", at: r.created_at, title: `New review · ${r.rating}★`, desc: r.comment || "No comment", icon: Star, accent: "text-yellow-500", bg: "bg-yellow-500/10" })),
    ]
      .filter((e) => e.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 15);
    setActivity(feed);

    const subcats = subcatsRes.data || [];
    const cats = (categoriesRes.data || []).map((c: any) => ({
      ...c,
      subcategoryCount: subcats.filter((s: any) => s.category_id === c.id).length,
    }));
    setCategories(cats);

    setLoading(false);
  };

  const statusColor: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    accepted: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
    confirmed: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
    in_progress: "bg-primary/10 text-primary",
    completed: "bg-secondary text-secondary-foreground",
    cancelled: "bg-destructive/10 text-destructive",
  };

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(recentBookings, 8);

  if (loading) {
    return (
      <LoadingState variant="page" />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Heading level={1} >Overview</Heading>
          <p className="text-fs-sm text-muted-foreground mt-1">
            Platform-wide performance and management overview.
          </p>
        </div>
        <Link to="/admin/earnings">
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
            <Settings className="w-4 h-4" /> Manage
          </Button>
        </Link>
      </header>
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Users, label: "Total Users", value: (stats.totalProviders + stats.totalClients + stats.totalEmployers).toLocaleString(), sub: `${stats.totalProviders} pros · ${stats.totalClients} clients · ${stats.totalEmployers} employers`, accent: "text-indigo-500", accentBg: "bg-indigo-500/10" },
            { icon: UserCheck, label: "Active Providers", value: stats.totalProviders.toLocaleString(), sub: "service providers", accent: "text-emerald-500", accentBg: "bg-emerald-500/10" },
            { icon: Building2, label: "Active Employers", value: stats.totalEmployers.toLocaleString(), sub: "hiring accounts", accent: "text-sky-500", accentBg: "bg-sky-500/10" },
            { icon: Users, label: "Customers", value: stats.totalClients.toLocaleString(), sub: "active clients", accent: "text-blue-500", accentBg: "bg-blue-500/10" },
            { icon: Briefcase, label: "Active Jobs", value: stats.activeJobs.toLocaleString(), sub: "currently open", accent: "text-amber-500", accentBg: "bg-amber-500/10" },
            { icon: FileCheck, label: "Pending Verifications", value: stats.pendingVerifs.toLocaleString(), sub: "awaiting review", accent: "text-violet-500", accentBg: "bg-violet-500/10" },
            { icon: DollarSign, label: "Revenue", value: `$${stats.commissionRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: `$${stats.totalRevenue.toLocaleString()} GMV · ${COMMISSION_RATE}% commission`, accent: "text-rose-500", accentBg: "bg-rose-500/10" },
            { icon: TrendingUp, label: "Monthly Growth", value: `${stats.monthlyGrowth >= 0 ? "+" : ""}${stats.monthlyGrowth.toFixed(1)}%`, sub: `${stats.usersThisMonth} new vs ${stats.usersPrevMonth} last month`, accent: stats.monthlyGrowth >= 0 ? "text-emerald-500" : "text-rose-500", accentBg: stats.monthlyGrowth >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10" },
            { icon: Sparkles, label: "Sponsorships", value: stats.sponsorshipActive.toLocaleString(), sub: `${stats.sponsorshipPending} pending · $${stats.sponsorshipRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} revenue`, accent: "text-fuchsia-500", accentBg: "bg-fuchsia-500/10" },
          ].map((s, i) => (
            <div key={s.label} className="bg-card rounded-sm border border-border p-5 animate-reveal" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-fs-xs text-muted-foreground font-medium">{s.label}</span>
                <div className={cn("w-9 h-9 rounded-sm flex items-center justify-center", s.accentBg)}>
                  <s.icon className={cn("w-4 h-4", s.accent)} />
                </div>
              </div>
              <p className="text-fs-2xl font-bold text-heading tabular-nums mb-0.5">{s.value}</p>
              <p className="text-[13px] text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Layers, label: "Categories", value: categories.length, sub: `${categories.reduce((s: number, c: any) => s + c.subcategoryCount, 0)} subcategories`, accent: "text-violet-500", accentBg: "bg-violet-500/10" },
            { icon: ShieldCheck, label: "Platform Health", value: "Active", sub: "all systems normal", accent: "text-emerald-500", accentBg: "bg-emerald-500/10" },
          ].map((s, i) => (
            <div key={s.label} className="bg-card rounded-sm border border-border p-5 animate-reveal" style={{ animationDelay: `${(i + 4) * 60}ms` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-fs-xs text-muted-foreground font-medium">{s.label}</span>
                <div className={cn("w-9 h-9 rounded-sm flex items-center justify-center", s.accentBg)}>
                  <s.icon className={cn("w-4 h-4", s.accent)} />
                </div>
              </div>
              <p className="text-fs-2xl font-bold text-heading tabular-nums mb-0.5">{s.value}</p>
              <p className="text-[13px] text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-sm border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <Heading level={3}  className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Commission Revenue (6 months)
              </Heading>
              <Link to="/admin/earnings" className="text-fs-xs text-primary font-medium hover:underline">Details</Link>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenueByMonth}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Commission"]} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card rounded-sm border border-border p-6">
            <Heading level={3}  className="mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              Bookings (6 months)
            </Heading>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={bookingsByMonth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip />
                <Bar dataKey="bookings" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <section className="bg-card rounded-sm border border-border overflow-hidden">
          <div className="p-5 border-b border-border/40 flex items-center justify-between">
            <Heading level={3}  className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-blue-500" /> Recent Bookings
            </Heading>
          </div>
          {recentBookings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-fs-sm">
                <thead>
                  <tr className="border-b border-border text-fs-xs text-muted-foreground">
                    <th className="text-left py-3 px-5 font-medium">Date</th>
                    <th className="text-left py-3 px-5 font-medium">Time</th>
                    <th className="text-left py-3 px-5 font-medium">Status</th>
                    <th className="text-left py-3 px-5 font-medium">Payment</th>
                    <th className="text-right py-3 px-5 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((b) => (
                    <tr key={b.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-5 text-heading font-medium">{b.booking_date}</td>
                      <td className="py-3 px-5 text-body">{b.start_time?.slice(0, 5)}</td>
                      <td className="py-3 px-5">
                        <span className={cn("text-fs-xs font-medium px-2 py-0.5 rounded-full capitalize", statusColor[b.status] || "bg-muted text-muted-foreground")}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-body capitalize">{b.payment_status}</td>
                      <td className="py-3 px-5 text-right font-medium text-heading tabular-nums">${(b.total_price || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <NumberedPagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
                className="px-5 pb-5"
          onPageSizeChange={setPageSize}
              />
            </div>
          ) : (
            <p className="text-fs-sm text-muted-foreground p-8 text-center">No bookings yet</p>
          )}
        </section>

        <section className="bg-card rounded-sm border border-border overflow-hidden">
          <div className="p-5 border-b border-border/40 flex items-center justify-between">
            <Heading level={3}  className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Recent Activity
            </Heading>
            <span className="text-fs-xs text-muted-foreground">{activity.length} events</span>
          </div>
          {activity.length > 0 ? (
            <ul className="divide-y divide-border/50">
              {activity.map((e, i) => (
                <li key={i} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className={cn("w-8 h-8 rounded-sm flex items-center justify-center shrink-0", e.bg)}>
                    <e.icon className={cn("w-4 h-4", e.accent)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-fs-sm font-medium text-heading">{e.title}</p>
                    <p className="text-fs-xs text-muted-foreground truncate">{e.desc}</p>
                  </div>
                  <span className="text-fs-xs text-muted-foreground shrink-0 tabular-nums">
                    {formatDistanceToNow(new Date(e.at), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fs-sm text-muted-foreground p-8 text-center">No recent activity</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;
