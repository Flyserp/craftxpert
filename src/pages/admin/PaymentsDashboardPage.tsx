import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Download, DollarSign, Percent, TrendingUp, CreditCard, ArrowDownRight, X,
  Repeat, Briefcase, ShieldCheck, Undo2,
} from "lucide-react";
import { format } from "date-fns";
import { getCommissionRate, calcCommission } from "@/lib/commission";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import DownloadReceiptButton from "@/components/booking/DownloadReceiptButton";
import { Heading, LoadingState } from "@/components/ui/app";

interface TxRow {
  id: string;
  amount: number;
  payment_method: string;
  status: string;
  payment_type: string;
  created_at: string;
  user_id: string;
  vendor_id: string;
  booking_id: string | null;
  customer_name?: string;
  vendor_name?: string;
}

const STATUS_STYLES: Record<string, string> = {
  succeeded: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  failed: "bg-destructive/10 text-destructive",
  refunded: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

const METHODS = ["all", "stripe", "paypal", "wallet"];
const STATUSES = ["all", "succeeded", "pending", "failed", "refunded"];

export default function PaymentsDashboardPage() {
  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rate, setRate] = useState<number>(10);
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [vendorQuery, setVendorQuery] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [subs, setSubs] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [verifs, setVerifs] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const r = await getCommissionRate();
      setRate(r);
      const { data: tx } = await supabase
        .from("payment_transactions")
        .select("id, amount, payment_method, status, payment_type, created_at, user_id, vendor_id, booking_id")
        .order("created_at", { ascending: false })
        .limit(500);

      const txs = (tx || []) as TxRow[];
      const [{ data: subRows }, { data: jobRows }, { data: verifRows }, { data: refRows }] = await Promise.all([
        supabase.from("provider_subscriptions")
          .select("id, provider_id, status, started_at, current_period_end, last_renewed_at, plan:subscription_plans(name, price, currency, interval)")
          .order("created_at", { ascending: false }).limit(500),
        supabase.from("task_payments")
          .select("id, employer_id, task_id, amount, currency, payment_method, status, created_at")
          .order("created_at", { ascending: false }).limit(500),
        supabase.from("vendor_verifications")
          .select("id, vendor_id, status, business_name, submitted_at, reviewed_at")
          .order("submitted_at", { ascending: false, nullsFirst: false }).limit(500),
        supabase.from("refund_requests")
          .select("id, customer_id, booking_id, amount, reason, status, created_at, reviewed_at")
          .order("created_at", { ascending: false }).limit(500),
      ]);

      const userIds = Array.from(new Set([
        ...txs.flatMap((t) => [t.user_id, t.vendor_id]),
        ...((subRows as any[]) || []).map((s) => s.provider_id),
        ...((jobRows as any[]) || []).map((j) => j.employer_id),
        ...((verifRows as any[]) || []).map((v) => v.vendor_id),
        ...((refRows as any[]) || []).map((r) => r.customer_id),
      ].filter(Boolean)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
      const nameMap = new Map((profs || []).map((p: any) => [p.user_id, p.display_name || "—"]));
      setRows(
        txs.map((t) => ({
          ...t,
          customer_name: nameMap.get(t.user_id) || "—",
          vendor_name: nameMap.get(t.vendor_id) || "—",
        })),
      );
      setSubs(((subRows as any[]) || []).map((s) => ({ ...s, provider_name: nameMap.get(s.provider_id) || "—" })));
      setJobs(((jobRows as any[]) || []).map((j) => ({ ...j, employer_name: nameMap.get(j.employer_id) || "—" })));
      setVerifs(((verifRows as any[]) || []).map((v) => ({ ...v, vendor_name: nameMap.get(v.vendor_id) || "—" })));
      setRefunds(((refRows as any[]) || []).map((r) => ({ ...r, customer_name: nameMap.get(r.customer_id) || "—" })));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const toTs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
    const vq = vendorQuery.trim().toLowerCase();
    const bq = bookingId.trim().toLowerCase();
    return rows.filter((r) => {
      if (method !== "all" && r.payment_method !== method) return false;
      if (status !== "all" && r.status !== status) return false;
      const ts = new Date(r.created_at).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      if (vq && !(r.vendor_name || "").toLowerCase().includes(vq)) return false;
      if (bq && !(r.booking_id || "").toLowerCase().includes(bq)) return false;
      return true;
    });
  }, [rows, method, status, dateFrom, dateTo, vendorQuery, bookingId]);

  const hasActiveFilters =
    method !== "all" || status !== "all" || dateFrom || dateTo || vendorQuery || bookingId;

  const clearFilters = () => {
    setMethod("all");
    setStatus("all");
    setDateFrom("");
    setDateTo("");
    setVendorQuery("");
    setBookingId("");
  };

  const isRevenue = (s: string) => s === "succeeded" || s === "paid";
  const isReversal = (s: string) => s === "refunded";

  const totals = useMemo(() => {
    let gross = 0;
    let commission = 0;
    let refunded = 0;
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
    const header = ["Date", "Customer", "Vendor", "Method", "Gross", "Commission", "Net"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      const sign = isReversal(r.status) ? -1 : 1;
      const accountable = isRevenue(r.status) || isReversal(r.status);
      const gross = accountable ? sign * r.amount : 0;
      const comm = accountable ? sign * calcCommission(r.amount, rate) : 0;
      const net = gross - comm;
      lines.push(
        [
          format(new Date(r.created_at), "yyyy-MM-dd"),
          escapeCsv(r.customer_name || ""),
          escapeCsv(r.vendor_name || ""),
          r.payment_method,
          gross.toFixed(2),
          comm.toFixed(2),
          net.toFixed(2),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminPage
      title="Payments & Commission"
      subtitle="Stripe & PayPal transactions with auto-calculated platform commission."
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
            <StatCard icon={DollarSign} label="Gross Revenue" value={`$${totals.gross.toFixed(2)}`} hint={`${filtered.length} transactions`} />
            <StatCard icon={Percent} label="Commission Earned" value={`$${totals.commission.toFixed(2)}`} hint={`${rate}% platform rate`} accent />
            <StatCard icon={Repeat} label="Active Subscriptions" value={String(subs.filter((s) => s.status === "active").length)} hint={`${subs.length} total`} />
            <StatCard icon={Briefcase} label="Job Payments" value={`$${jobs.filter((j) => j.status === "paid" || j.status === "succeeded").reduce((s, j) => s + Number(j.amount || 0), 0).toFixed(2)}`} hint={`${jobs.length} payments`} />
            <StatCard icon={ShieldCheck} label="Verifications" value={String(verifs.filter((v) => v.status === "approved").length)} hint={`${verifs.filter((v) => v.status === "pending" || v.status === "submitted").length} pending`} />
            <StatCard icon={Undo2} label="Refund Requests" value={String(refunds.filter((r) => r.status === "pending").length)} hint={`$${refunds.filter((r) => r.status === "approved").reduce((s, r) => s + Number(r.amount || 0), 0).toFixed(2)} refunded`} />
            <StatCard icon={TrendingUp} label="Net to Vendors" value={`$${totals.net.toFixed(2)}`} hint="after commission" />
            <StatCard icon={ArrowDownRight} label="Refunded (tx)" value={`$${totals.refunded.toFixed(2)}`} hint="reverses commission" />
          </div>

          <Tabs defaultValue="transactions" className="space-y-4">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="transactions">Revenue & Status</TabsTrigger>
              <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
              <TabsTrigger value="jobs">Job Payments</TabsTrigger>
              <TabsTrigger value="verifications">Verifications</TabsTrigger>
              <TabsTrigger value="refunds">Refunds</TabsTrigger>
            </TabsList>

            <TabsContent value="transactions" className="space-y-6 mt-0">
          <div className="bg-card border border-border rounded-sm p-4 space-y-3 animate-reveal" style={{ animationDelay: "80ms" }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              <div className="space-y-1">
                <label className="text-fs-xs text-muted-foreground font-medium">From</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-fs-xs text-muted-foreground font-medium">To</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-fs-xs text-muted-foreground font-medium">Vendor</label>
                <Input placeholder="Search vendor name…" value={vendorQuery} onChange={(e) => setVendorQuery(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-fs-xs text-muted-foreground font-medium">Booking ID</label>
                <Input placeholder="Booking UUID…" value={bookingId} onChange={(e) => setBookingId(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-fs-xs text-muted-foreground font-medium">Method</label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m} value={m} className="capitalize">{m === "all" ? "All methods" : m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-fs-xs text-muted-foreground font-medium">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s === "all" ? "All statuses" : s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
                  <X className="w-3.5 h-3.5" /> Clear filters
                </Button>
              </div>
            )}
          </div>

          <div className="bg-card rounded-sm border border-border overflow-hidden animate-reveal" style={{ animationDelay: "120ms" }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                      No transactions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageItems.map((r) => {
                    const accountable = isRevenue(r.status) || isReversal(r.status);
                    const sign = isReversal(r.status) ? -1 : 1;
                    const gross = accountable ? sign * r.amount : 0;
                    const comm = accountable ? sign * calcCommission(r.amount, rate) : 0;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-body whitespace-nowrap">
                          {format(new Date(r.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-heading max-w-[160px] truncate">{r.customer_name}</TableCell>
                        <TableCell className="text-heading max-w-[160px] truncate">{r.vendor_name}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-fs-xs text-body capitalize">
                            <CreditCard className="w-3 h-3" /> {r.payment_method}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-fs-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[r.status] || "bg-muted text-muted-foreground"}`}>
                            {r.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-heading">
                          {accountable ? `$${gross.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">
                          {accountable ? `$${comm.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-primary font-semibold">
                          {accountable ? `$${(gross - comm).toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.booking_id ? (
                            <DownloadReceiptButton bookingId={r.booking_id} iconOnly className="h-8 w-8 p-0" />
                          ) : (
                            <span className="text-fs-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
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
            </TabsContent>

            <TabsContent value="subscriptions" className="mt-0">
              <SectionTable
                title="Provider Subscriptions"
                filename="subscriptions"
                columns={["Provider", "Plan", "Interval", "Price", "Status", "Renews", "Started"]}
                rows={subs.map((s) => [
                  s.provider_name,
                  s.plan?.name || "—",
                  s.plan?.interval || "—",
                  s.plan ? `$${Number(s.plan.price).toFixed(2)}` : "—",
                  s.status,
                  s.current_period_end ? format(new Date(s.current_period_end), "MMM d, yyyy") : "—",
                  s.started_at ? format(new Date(s.started_at), "MMM d, yyyy") : "—",
                ])}
              />
            </TabsContent>

            <TabsContent value="jobs" className="mt-0">
              <SectionTable
                title="Job Posting Payments"
                filename="job-payments"
                columns={["Date", "Employer", "Amount", "Method", "Status", "Task"]}
                rows={jobs.map((j) => [
                  format(new Date(j.created_at), "MMM d, yyyy"),
                  j.employer_name,
                  `${j.currency || "USD"} ${Number(j.amount).toFixed(2)}`,
                  j.payment_method,
                  j.status,
                  j.task_id ? j.task_id.slice(0, 8) : "—",
                ])}
              />
            </TabsContent>

            <TabsContent value="verifications" className="mt-0">
              <SectionTable
                title="Verification Requests"
                filename="verifications"
                columns={["Vendor", "Business", "Status", "Submitted", "Reviewed"]}
                rows={verifs.map((v) => [
                  v.vendor_name,
                  v.business_name || "—",
                  v.status,
                  v.submitted_at ? format(new Date(v.submitted_at), "MMM d, yyyy") : "—",
                  v.reviewed_at ? format(new Date(v.reviewed_at), "MMM d, yyyy") : "—",
                ])}
                note="Verification is free on this platform — no fees are charged for document review."
              />
            </TabsContent>

            <TabsContent value="refunds" className="mt-0">
              <SectionTable
                title="Refund Requests"
                filename="refunds"
                columns={["Date", "Customer", "Amount", "Reason", "Status", "Reviewed"]}
                rows={refunds.map((r) => [
                  format(new Date(r.created_at), "MMM d, yyyy"),
                  r.customer_name,
                  `$${Number(r.amount).toFixed(2)}`,
                  r.reason,
                  r.status,
                  r.reviewed_at ? format(new Date(r.reviewed_at), "MMM d, yyyy") : "—",
                ])}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </AdminPage>
  );
}

function SectionTable({
  title, filename, columns, rows, note,
}: { title: string; filename: string; columns: string[]; rows: (string | number)[][]; note?: string }) {
  const exportCSV = () => {
    const lines = [columns.join(",")];
    for (const r of rows) {
      lines.push(r.map((c) => {
        const v = String(c ?? "");
        return /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="bg-card rounded-sm border border-border overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <Heading level={3} >{title}</Heading>
          {note && <p className="text-fs-xs text-muted-foreground mt-1">{note}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5" disabled={rows.length === 0}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => <TableHead key={c}>{c}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-12 text-center text-muted-foreground">
                No records found.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r, i) => (
              <TableRow key={i}>
                {r.map((c, j) => {
                  const isStatus = columns[j].toLowerCase() === "status";
                  return (
                    <TableCell key={j} className="text-body">
                      {isStatus ? (
                        <span className={`text-fs-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[String(c)] || "bg-muted text-muted-foreground"}`}>
                          {String(c)}
                        </span>
                      ) : String(c)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, hint, accent,
}: { icon: any; label: string; value: string; hint: string; accent?: boolean }) {
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
