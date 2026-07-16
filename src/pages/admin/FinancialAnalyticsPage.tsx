import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/app";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend,
} from "recharts";
import { Download, DollarSign, Repeat, ShieldCheck, Briefcase, TrendingUp, Users } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";

type Row = { month: string; subscription: number; verification: number; job: number; total: number };
type Customer = { user_id: string; name: string; total: number };

const MONEY = (n: number) => `$${(n || 0).toFixed(2)}`;
const SUCCESS_PT = ["succeeded", "paid", "completed"];
const ACTIVE_SUB = ["active", "trialing", "past_due"];

function monthKey(d: string | Date) {
  return format(startOfMonth(new Date(d)), "yyyy-MM");
}

export default function FinancialAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [verifs, setVerifs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = subMonths(startOfMonth(new Date()), 11).toISOString();

      const [subsRes, jobsRes, verifsRes] = await Promise.all([
        supabase
          .from("provider_subscriptions")
          .select("id, created_at, status, plan_id, subscription_plans(price, name, interval)")
          .gte("created_at", since),
        supabase
          .from("task_payments")
          .select("id, created_at, status, amount, employer_id")
          .gte("created_at", since),
        supabase
          .from("payment_transactions")
          .select("id, created_at, status, amount, user_id, payment_type")
          .eq("payment_type", "verification")
          .gte("created_at", since),
      ]);

      const subRows = (subsRes.data ?? []).filter((r: any) => ACTIVE_SUB.includes(r.status));
      const jobRows = (jobsRes.data ?? []).filter((r: any) => SUCCESS_PT.includes(r.status));
      const verifRows = (verifsRes.data ?? []).filter((r: any) => SUCCESS_PT.includes(r.status));
      setSubs(subRows);
      setJobs(jobRows);
      setVerifs(verifRows);

      // Top customers: combine job payments (employer_id) + verification payments (user_id)
      const totals = new Map<string, number>();
      jobRows.forEach((r: any) =>
        totals.set(r.employer_id, (totals.get(r.employer_id) || 0) + Number(r.amount || 0)),
      );
      verifRows.forEach((r: any) =>
        totals.set(r.user_id, (totals.get(r.user_id) || 0) + Number(r.amount || 0)),
      );
      const ids = Array.from(totals.keys()).filter(Boolean);
      let nameMap: Record<string, string> = {};
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", ids);
        nameMap = Object.fromEntries(
          (profiles ?? []).map((p: any) => [p.user_id, p.display_name || "Unknown"]),
        );
      }
      const top: Customer[] = ids
        .map((id) => ({ user_id: id, name: nameMap[id] || id.slice(0, 8), total: totals.get(id)! }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
      setCustomers(top);

      setLoading(false);
    })();
  }, []);

  const monthly: Row[] = useMemo(() => {
    const map = new Map<string, Row>();
    for (let i = 11; i >= 0; i--) {
      const k = format(subMonths(startOfMonth(new Date()), i), "yyyy-MM");
      map.set(k, { month: k, subscription: 0, verification: 0, job: 0, total: 0 });
    }
    subs.forEach((s: any) => {
      const row = map.get(monthKey(s.created_at));
      const price = Number(s.subscription_plans?.price || 0);
      if (row) {
        row.subscription += price;
        row.total += price;
      }
    });
    jobs.forEach((j: any) => {
      const row = map.get(monthKey(j.created_at));
      const amt = Number(j.amount || 0);
      if (row) {
        row.job += amt;
        row.total += amt;
      }
    });
    verifs.forEach((v: any) => {
      const row = map.get(monthKey(v.created_at));
      const amt = Number(v.amount || 0);
      if (row) {
        row.verification += amt;
        row.total += amt;
      }
    });
    return Array.from(map.values());
  }, [subs, jobs, verifs]);

  const totals = useMemo(() => {
    const subscription = subs.reduce(
      (a, s: any) => a + Number(s.subscription_plans?.price || 0),
      0,
    );
    const job = jobs.reduce((a, j: any) => a + Number(j.amount || 0), 0);
    const verification = verifs.reduce((a, v: any) => a + Number(v.amount || 0), 0);
    const total = subscription + job + verification;
    const currentMonth = monthly[monthly.length - 1]?.total ?? 0;
    return { subscription, job, verification, total, currentMonth };
  }, [subs, jobs, verifs, monthly]);

  function exportCsv() {
    const header = ["month", "subscription", "verification", "job_posting", "total"];
    const lines = [header.join(",")].concat(
      monthly.map((r) =>
        [r.month, r.subscription, r.verification, r.job, r.total].join(","),
      ),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financial-analytics-${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <AdminPage title="Financial Analytics">
        <LoadingState />
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="Financial Analytics"
      subtitle="Revenue across subscriptions, verifications, and job postings"
      actions={
        <Button variant="outline" onClick={exportCsv}>
          <Download className="size-4 mr-2" /> Export CSV
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat icon={DollarSign} label="Total revenue (12mo)" value={MONEY(totals.total)} />
        <Stat icon={Repeat} label="Subscriptions" value={MONEY(totals.subscription)} />
        <Stat icon={ShieldCheck} label="Verifications" value={MONEY(totals.verification)} />
        <Stat icon={Briefcase} label="Job postings" value={MONEY(totals.job)} />
        <Stat icon={TrendingUp} label="This month" value={MONEY(totals.currentMonth)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue trend</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="total" stroke="hsl(var(--chart-1))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly revenue by source</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
              />
              <Legend />
              <Bar dataKey="subscription" stackId="a" fill="hsl(var(--chart-1))" />
              <Bar dataKey="verification" stackId="a" fill="hsl(var(--chart-2))" />
              <Bar dataKey="job" stackId="a" fill="hsl(var(--chart-3))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" /> Top paying customers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No paying customers yet.</p>
          ) : (
            <ul className="divide-y">
              {customers.map((c, i) => (
                <li key={c.user_id} className="flex items-center justify-between py-3">
                  <span className="text-sm">
                    <span className="text-muted-foreground mr-2">#{i + 1}</span>
                    {c.name}
                  </span>
                  <span className="font-medium">{MONEY(c.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AdminPage>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Icon className="size-4" />
          {label}
        </div>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}