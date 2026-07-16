import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/ui/app";
import { Download, Printer } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";

type MonthlyRow = { month: string; users: number; revenue: number; subs: number; jobs: number; apps: number; verifs: number };
type CountRow = { name: string; value: number };

const CHART = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

function csv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const body = rows
    .map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))
    .join("\n");
  const blob = new Blob([headers.join(",") + "\n" + body], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [categories, setCategories] = useState<CountRow[]>([]);
  const [locations, setLocations] = useState<CountRow[]>([]);
  const [totals, setTotals] = useState({
    users: 0, revenue: 0, subs: 0, jobs: 0, apps: 0, verifs: 0,
  });

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const since = startOfMonth(subMonths(new Date(), 11)).toISOString();

    const [users, pays, subs, jobs, props, verifs, cats] = await Promise.all([
      supabase.from("profiles").select("created_at, address, category_id").gte("created_at", since),
      supabase.from("payment_transactions").select("amount, status, created_at").gte("created_at", since),
      supabase.from("provider_subscriptions").select("created_at, status").gte("created_at", since),
      supabase.from("tasks").select("created_at, category_id, address").gte("created_at", since),
      supabase.from("task_proposals").select("created_at").gte("created_at", since),
      supabase.from("vendor_verifications").select("created_at, status").gte("created_at", since),
      supabase.from("service_categories").select("id, name"),
    ]);

    const catMap = new Map<string, string>((cats.data || []).map((c: any) => [c.id, c.name]));

    // 12-month buckets
    const buckets: MonthlyRow[] = Array.from({ length: 12 }).map((_, i) => {
      const d = startOfMonth(subMonths(new Date(), 11 - i));
      return { month: format(d, "MMM"), users: 0, revenue: 0, subs: 0, jobs: 0, apps: 0, verifs: 0 };
    });
    const bucketIdx = (iso: string) => {
      const d = new Date(iso);
      const diff = (new Date().getFullYear() - d.getFullYear()) * 12 + (new Date().getMonth() - d.getMonth());
      return 11 - diff;
    };
    const push = (iso: string, key: keyof Omit<MonthlyRow, "month">, amount = 1) => {
      const i = bucketIdx(iso);
      if (i >= 0 && i < 12) buckets[i][key] = (buckets[i][key] as number) + amount;
    };

    (users.data || []).forEach((u: any) => push(u.created_at, "users"));
    (pays.data || []).forEach((p: any) => {
      if (p.status === "succeeded" || p.status === "completed" || p.status === "paid")
        push(p.created_at, "revenue", Number(p.amount) || 0);
    });
    (subs.data || []).forEach((s: any) => push(s.created_at, "subs"));
    (jobs.data || []).forEach((j: any) => push(j.created_at, "jobs"));
    (props.data || []).forEach((p: any) => push(p.created_at, "apps"));
    (verifs.data || []).forEach((v: any) => push(v.created_at, "verifs"));

    // Categories from jobs
    const catCounts = new Map<string, number>();
    (jobs.data || []).forEach((j: any) => {
      if (!j.category_id) return;
      const name = catMap.get(j.category_id) || "Unknown";
      catCounts.set(name, (catCounts.get(name) || 0) + 1);
    });

    // Locations from jobs (extract city = first comma segment)
    const locCounts = new Map<string, number>();
    (jobs.data || []).forEach((j: any) => {
      const a = (j.address || "").trim();
      if (!a) return;
      const city = a.split(",")[0].trim();
      locCounts.set(city, (locCounts.get(city) || 0) + 1);
    });

    setMonthly(buckets);
    setCategories(
      Array.from(catCounts.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    );
    setLocations(
      Array.from(locCounts.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    );
    setTotals({
      users: buckets.reduce((s, b) => s + b.users, 0),
      revenue: buckets.reduce((s, b) => s + b.revenue, 0),
      subs: buckets.reduce((s, b) => s + b.subs, 0),
      jobs: buckets.reduce((s, b) => s + b.jobs, 0),
      apps: buckets.reduce((s, b) => s + b.apps, 0),
      verifs: buckets.reduce((s, b) => s + b.verifs, 0),
    });
    setLoading(false);
  }

  const growth = useMemo(() => {
    return monthly.map((m, i) => {
      const prev = i === 0 ? 0 : monthly[i - 1].users;
      const pct = prev === 0 ? 0 : ((m.users - prev) / prev) * 100;
      return { month: m.month, growth: Math.round(pct) };
    });
  }, [monthly]);

  if (loading) return <AdminPage title="Analytics"><LoadingState /></AdminPage>;

  return (
    <AdminPage
      title="Analytics Dashboard"
      subtitle="Last 12 months — platform performance overview"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => csv(monthly, "monthly-overview.csv")}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> PDF
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard label="New Users" value={totals.users} />
        <StatCard label="Revenue" value={`$${totals.revenue.toFixed(0)}`} />
        <StatCard label="Subscriptions" value={totals.subs} />
        <StatCard label="Job Posts" value={totals.jobs} />
        <StatCard label="Applications" value={totals.apps} />
        <StatCard label="Verifications" value={totals.verifs} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Users Growth" csvName="users.csv" data={monthly}>
          <LineChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="month" /><YAxis />
            <Tooltip /><Legend />
            <Line type="monotone" dataKey="users" stroke={CHART[0]} strokeWidth={2} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Revenue" csvName="revenue.csv" data={monthly}>
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="month" /><YAxis />
            <Tooltip /><Legend />
            <Bar dataKey="revenue" fill={CHART[1]} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Subscriptions" csvName="subscriptions.csv" data={monthly}>
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="month" /><YAxis />
            <Tooltip /><Legend />
            <Bar dataKey="subs" fill={CHART[2]} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Job Posts" csvName="jobs.csv" data={monthly}>
          <LineChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="month" /><YAxis />
            <Tooltip /><Legend />
            <Line type="monotone" dataKey="jobs" stroke={CHART[3]} strokeWidth={2} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Applications" csvName="applications.csv" data={monthly}>
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="month" /><YAxis />
            <Tooltip /><Legend />
            <Bar dataKey="apps" fill={CHART[4]} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Verification Requests" csvName="verifications.csv" data={monthly}>
          <LineChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="month" /><YAxis />
            <Tooltip /><Legend />
            <Line type="monotone" dataKey="verifs" stroke={CHART[0]} strokeWidth={2} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Top Categories" csvName="top-categories.csv" data={categories}>
          <PieChart>
            <Tooltip />
            <Pie data={categories} dataKey="value" nameKey="name" outerRadius={100} label>
              {categories.map((_, i) => (
                <Cell key={i} fill={CHART[i % CHART.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartCard>

        <ChartCard title="Top Locations" csvName="top-locations.csv" data={locations}>
          <BarChart data={locations} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis type="number" /><YAxis type="category" dataKey="name" width={100} />
            <Tooltip />
            <Bar dataKey="value" fill={CHART[2]} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ChartCard>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-fs-md">Monthly Growth (Users %)</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => csv(growth, "monthly-growth.csv")}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growth}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" /><YAxis unit="%" />
                <Tooltip />
                <Bar dataKey="growth" fill={CHART[1]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </AdminPage>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-fs-xs text-muted-foreground">{label}</div>
        <div className="text-fs-xl font-semibold text-heading mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title, children, csvName, data,
}: { title: string; children: React.ReactElement; csvName: string; data: Record<string, unknown>[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-fs-md">{title}</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => csv(data, csvName)}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </CardHeader>
      <CardContent style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </CardContent>
    </Card>
  );
}