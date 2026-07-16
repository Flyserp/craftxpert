import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, DollarSign, Percent, TrendingUp, ArrowDownRight, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { getCommissionRate, calcCommission } from "@/lib/commission";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { LoadingState } from "@/components/ui/app";

interface Tx {
  id: string;
  amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  user_id: string;
  booking_id: string | null;
  customer_name?: string;
}

const STATUS_STYLES: Record<string, string> = {
  succeeded: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  failed: "bg-destructive/10 text-destructive",
  refunded: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

export default function ProviderPaymentsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [rate, setRate] = useState(10);
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const r = await getCommissionRate();
      setRate(r);
      let q = supabase
        .from("payment_transactions")
        .select("id, amount, payment_method, status, created_at, user_id, booking_id")
        .order("created_at", { ascending: false })
        .limit(500);
      q = q.eq("vendor_id", user.id);
      const { data } = await q;
      const txs = (data || []) as Tx[];
      const customerIds = Array.from(new Set(txs.map((t) => t.user_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", customerIds.length ? customerIds : ["00000000-0000-0000-0000-000000000000"]);
      const nameMap = new Map((profs || []).map((p: any) => [p.user_id, p.display_name || "—"]));
      setRows(txs.map((t) => ({ ...t, customer_name: nameMap.get(t.user_id) || "—" })));
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (method === "all" || r.payment_method === method) &&
          (status === "all" || r.status === status),
      ),
    [rows, method, status],
  );

  const isRevenue = (s: string) => s === "succeeded" || s === "paid";
  const isReversal = (s: string) => s === "refunded";

  const totals = useMemo(() => {
    let gross = 0, commission = 0, refunded = 0;
    for (const r of filtered) {
      if (isRevenue(r.status)) {
        gross += r.amount;
        commission += calcCommission(r.amount, rate);
      } else if (isReversal(r.status)) {
        refunded += r.amount;
        commission -= calcCommission(r.amount, rate);
      }
    }
    return { gross, commission, net: gross - commission, refunded };
  }, [filtered, rate]);

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(filtered, 15);

  const exportCSV = () => {
    const header = ["Date", "Customer", "Method", "Gross", "Commission", "Net"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      const sign = isReversal(r.status) ? -1 : 1;
      const accountable = isRevenue(r.status) || isReversal(r.status);
      const gross = accountable ? sign * r.amount : 0;
      const comm = accountable ? sign * calcCommission(r.amount, rate) : 0;
      lines.push([
        format(new Date(r.created_at), "yyyy-MM-dd"),
        escapeCsv(r.customer_name || ""),
        r.payment_method,
        gross.toFixed(2),
        comm.toFixed(2),
        (gross - comm).toFixed(2),
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-payments-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout
      title="Payments & Commission"
      subtitle="Your Stripe & PayPal transactions with platform commission breakdown."
      actions={
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      }
    >
      {loading ? (
        <LoadingState variant="section" />
      ) : (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-reveal">
            <Card icon={DollarSign} label="Gross" value={`$${totals.gross.toFixed(2)}`} hint={`${filtered.length} transactions`} />
            <Card icon={Percent} label="Commission" value={`-$${totals.commission.toFixed(2)}`} hint={`${rate}% platform rate`} />
            <Card icon={TrendingUp} label="Net Earnings" value={`$${totals.net.toFixed(2)}`} hint="after commission" accent />
            <Card icon={ArrowDownRight} label="Refunded" value={`$${totals.refunded.toFixed(2)}`} hint="reverses commission" />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 animate-reveal" style={{ animationDelay: "80ms" }}>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="wallet">Wallet</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="succeeded">Succeeded</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-card rounded-sm border border-border overflow-hidden animate-reveal" style={{ animationDelay: "120ms" }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No transactions found.</TableCell></TableRow>
                ) : (
                  pageItems.map((r) => {
                    const accountable = isRevenue(r.status) || isReversal(r.status);
                    const sign = isReversal(r.status) ? -1 : 1;
                    const gross = accountable ? sign * r.amount : 0;
                    const comm = accountable ? sign * calcCommission(r.amount, rate) : 0;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">{format(new Date(r.created_at), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-heading max-w-[180px] truncate">{r.customer_name}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-fs-xs capitalize">
                            <CreditCard className="w-3 h-3" /> {r.payment_method}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-fs-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[r.status] || "bg-muted text-muted-foreground"}`}>{r.status}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-heading">{accountable ? `$${gross.toFixed(2)}` : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">{accountable ? `$${comm.toFixed(2)}` : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-primary font-semibold">{accountable ? `$${(gross - comm).toFixed(2)}` : "—"}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 0 && (
            <NumberedPagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={totalItems}
              pageSize={pageSize}
          onPageSizeChange={setPageSize}
            />
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

function Card({ icon: Icon, label, value, hint, accent }: any) {
  return (
    <div className={`rounded-sm border p-5 ${accent ? "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20" : "bg-card border-border"}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-fs-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-fs-2xl font-bold text-heading tabular-nums">{value}</p>
      <p className="text-fs-xs text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}

function escapeCsv(v: string) {
  if (/[,"\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
