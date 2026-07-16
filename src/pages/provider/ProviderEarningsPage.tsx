import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DollarSign, TrendingUp, Percent, Download, ArrowDownRight, Wallet, Clock, ArrowUpRight,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { format, subMonths } from "date-fns";
import { getCommissionRate, getCommissionConfig, computeCommission } from "@/lib/commission";
import NumberedPagination from "@/components/common/NumberedPagination";
import { usePagination } from "@/hooks/usePagination";
import { Heading, LoadingState } from "@/components/ui/app";

export default function ProviderEarningsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<number>(0);
  const [walletTxs, setWalletTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commissionRate, setCommissionRate] = useState<number>(10);
  const [commissionCfg, setCommissionCfg] = useState<Awaited<ReturnType<typeof getCommissionConfig>> | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [rate, cfg] = await Promise.all([getCommissionRate(), getCommissionConfig()]);
      setCommissionRate(rate);
      setCommissionCfg(cfg);
      const [completedRes, pendingRes, walletRes, withdrawRes, txRes] = await Promise.all([
        supabase.from("bookings")
          .select("id, status, total_price, created_at, booking_date, payment_status, service:vendor_services(title, category_id)")
          .eq("vendor_id", user.id).eq("status", "completed")
          .order("created_at", { ascending: false }),
        supabase.from("bookings")
          .select("id, status, total_price, booking_date")
          .eq("vendor_id", user.id)
          .in("status", ["accepted", "in_progress", "confirmed"]),
        supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
        supabase.from("withdrawals").select("amount").eq("vendor_id", user.id).in("status", ["pending", "approved"]),
        supabase.from("wallet_transactions").select("id, type, amount, description, created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);

      setBookings(completedRes.data || []);
      setPendingBookings(pendingRes.data || []);
      setWalletBalance(Number(walletRes.data?.balance || 0));
      setPendingWithdrawals((withdrawRes.data || []).reduce((s, w: any) => s + Number(w.amount || 0), 0));
      setWalletTxs(txRes.data || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const calcCommission = (price: number, categoryId?: string | null) =>
    commissionCfg ? computeCommission(price, commissionCfg, categoryId) : price * (commissionRate / 100);

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(bookings, 20);

  const totalGross = bookings.reduce((s: number, b: any) => s + (b.total_price || 0), 0);
  const totalCommission = bookings.reduce((s: number, b: any) => s + calcCommission(b.total_price || 0, b.service?.category_id), 0);
  const totalNet = totalGross - totalCommission;

  const pendingGross = pendingBookings.reduce((s, b: any) => s + (b.total_price || 0), 0);
  const pendingNet = pendingGross - pendingGross * (commissionRate / 100);
  const withdrawable = Math.max(0, walletBalance - pendingWithdrawals);

  const monthlyData = useMemo(() => {
    const result: { month: string; gross: number; net: number; commission: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const prefix = format(d, "yyyy-MM");
      const label = format(d, "MMM");
      const monthBookings = bookings.filter((b) => b.created_at?.startsWith(prefix));
      const gross = monthBookings.reduce((s: number, b: any) => s + (b.total_price || 0), 0);
      const commission = monthBookings.reduce((s: number, b: any) => s + calcCommission(b.total_price || 0), 0);
      result.push({ month: label, gross, net: gross - commission, commission });
    }
    return result;
  }, [bookings]);

  const exportCSV = () => {
    const rows = [
      ["Date", "Service", "Gross", "Commission", "Net"],
      ...bookings.map((b) => {
        const gross = b.total_price || 0;
        const comm = calcCommission(gross);
        return [
          format(new Date(b.booking_date), "yyyy-MM-dd"),
          (b.service as any)?.title || "Service",
          gross.toFixed(2),
          comm.toFixed(2),
          (gross - comm).toFixed(2),
        ];
      }),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `earnings-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <DashboardLayout title="Earnings">
        <LoadingState variant="section" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Earnings"
      subtitle="Track your earnings and commission deductions."
      actions={
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
          <Download className="w-4 h-4" /> Export
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 animate-reveal">
          {[
            { label: "Gross Earnings", value: `$${totalGross.toLocaleString()}`, icon: DollarSign, color: "text-heading" },
            { label: "Commission Deducted", value: `-$${totalCommission.toLocaleString()}`, icon: ArrowDownRight, color: "text-destructive" },
            { label: "Net Earnings", value: `$${totalNet.toLocaleString()}`, icon: TrendingUp, color: "text-primary" },
            { label: "Pending Earnings", value: `$${pendingNet.toFixed(2)}`, icon: Clock, color: "text-heading" },
            { label: "Withdrawable", value: `$${withdrawable.toFixed(2)}`, icon: Wallet, color: "text-primary" },
          ].map((s, i) => (
            <div key={s.label} className="bg-card rounded-sm border border-border p-5" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-fs-xs text-muted-foreground font-medium">{s.label}</span>
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                  <s.icon className="w-4 h-4 text-primary" />
                </div>
              </div>
              <p className={`text-fs-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-card rounded-sm border border-border p-5 flex items-center justify-between gap-3 flex-wrap animate-reveal">
          <div>
            <p className="text-fs-sm font-semibold text-heading">Wallet</p>
            <p className="text-fs-xs text-muted-foreground">
              Balance ${walletBalance.toFixed(2)} · Pending withdrawals ${pendingWithdrawals.toFixed(2)}
            </p>
          </div>
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/provider-withdrawals"><ArrowUpRight className="w-4 h-4" /> Withdraw funds</Link>
          </Button>
        </div>

        <div className="bg-muted/50 rounded-sm border border-border px-5 py-4 flex items-center gap-3 animate-reveal" style={{ animationDelay: "80ms" }}>
          <Percent className="w-5 h-5 text-primary shrink-0" />
          <p className="text-description-sm">
            Platform commission rate:{" "}
            <strong className="text-heading">{commissionRate}% per booking</strong>
          </p>
        </div>

        <div className="bg-card rounded-sm border border-border p-6 animate-reveal" style={{ animationDelay: "120ms" }}>
          <Heading level={3}  className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            Earnings Trend (6 months)
          </Heading>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: number, name: string) => [`$${v.toLocaleString()}`, name === "net" ? "Net" : name === "gross" ? "Gross" : "Commission"]} />
              <Area type="monotone" dataKey="gross" stroke="hsl(var(--chart-3))" strokeWidth={1.5} fill="none" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="net" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#netGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-sm border border-border overflow-hidden animate-reveal" style={{ animationDelay: "160ms" }}>
          <div className="p-5 border-b border-border/50">
            <Heading level={3} >Completed Jobs</Heading>
          </div>
          {bookings.length === 0 ? (
            <div className="py-12 text-center text-fs-sm text-muted-foreground">
              No completed jobs yet
            </div>
          ) : (
            <>
              <div className="divide-y divide-border/50">
                {pageItems.map((b) => {
                  const gross = b.total_price || 0;
                  const comm = calcCommission(gross);
                  const net = gross - comm;
                  return (
                    <div key={b.id} className="px-5 py-3.5 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-fs-sm font-medium text-heading truncate">
                          {(b.service as any)?.title || "Service"}
                        </p>
                        <p className="text-fs-xs text-muted-foreground">
                          {format(new Date(b.booking_date), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-fs-sm font-semibold text-heading tabular-nums">${net.toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          ${gross.toFixed(2)} − ${comm.toFixed(2)} comm.
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-3 border-t border-border/50">
                <NumberedPagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  pageSize={pageSize}
                  onPageChange={setPage}
          onPageSizeChange={setPageSize}
                />
              </div>
            </>
          )}
        </div>

        <div className="bg-card rounded-sm border border-border overflow-hidden animate-reveal" style={{ animationDelay: "200ms" }}>
          <div className="p-5 border-b border-border/50">
            <Heading level={3} >Recent Wallet Transactions</Heading>
          </div>
          {walletTxs.length === 0 ? (
            <div className="py-10 text-center text-fs-sm text-muted-foreground">No wallet activity yet.</div>
          ) : (
            <div className="divide-y divide-border/50">
              {walletTxs.map((t) => (
                <div key={t.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-fs-sm font-medium text-heading truncate capitalize">{t.description || t.type}</p>
                    <p className="text-fs-xs text-muted-foreground">{format(new Date(t.created_at), "MMM d, yyyy")} · {t.type}</p>
                  </div>
                  <p className={`text-fs-sm font-semibold tabular-nums ${Number(t.amount) < 0 ? "text-destructive" : "text-primary"}`}>
                    {Number(t.amount) < 0 ? "-" : "+"}${Math.abs(Number(t.amount)).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
