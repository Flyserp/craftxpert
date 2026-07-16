import { useEffect, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import { supabase } from "@/integrations/supabase/client";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  Download, TrendingUp, CreditCard, Percent,
} from "lucide-react";
import { getCommissionRate } from "@/lib/commission";
import NumberedPagination from "@/components/common/NumberedPagination";
import { usePagination } from "@/hooks/usePagination";
import { LoadingState } from "@/components/ui/app";

interface BookingPayment {
  id: string;
  booking_date: string;
  total_price: number | null;
  payment_status: string;
  payment_method: string | null;
  status: string;
}

export default function EarningsPage() {
  const [bookings, setBookings] = useState<BookingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [commissionRate, setCommissionRate] = useState<number>(10);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const rate = await getCommissionRate();
    setCommissionRate(rate);
    const { data } = await supabase
      .from("bookings")
      .select("id, booking_date, total_price, payment_status, payment_method, status")
      .order("created_at", { ascending: false })
      .limit(200);

    setBookings(
      (data || []).map((b: any) => ({
        id: b.id,
        booking_date: b.booking_date,
        total_price: b.total_price,
        payment_status: b.payment_status || "unpaid",
        payment_method: b.payment_method,
        status: b.status,
      }))
    );

    setLoading(false);
  };

  const calcCommission = (b: BookingPayment) => (b.total_price || 0) * (commissionRate / 100);

  const paidBookings = bookings.filter((b) => b.payment_status === "paid");
  const totalBookingRevenue = paidBookings.reduce((s, b) => s + (b.total_price || 0), 0);
  const totalCommission = paidBookings.reduce((s, b) => s + calcCommission(b), 0);

  const filteredBookings = bookings.filter((b) =>
    statusFilter === "all" ? true : b.payment_status === statusFilter
  );

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(filteredBookings, 20);

  const exportCSV = () => {
    const rows = [
      ["Booking ID", "Date", "Amount", "Commission", "Net to Provider", "Payment Status", "Method", "Status"],
      ...filteredBookings.map((b) => {
        const comm = calcCommission(b);
        const price = b.total_price || 0;
        return [
          b.id.slice(0, 8),
          b.booking_date,
          price.toString(),
          comm.toFixed(2),
          (price - comm).toFixed(2),
          b.payment_status,
          b.payment_method || "",
          b.status,
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

  const paymentStatusStyle: Record<string, string> = {
    paid: "bg-primary/10 text-primary",
    unpaid: "bg-muted text-muted-foreground",
    refunded: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  };

  return (
    <AdminPage title="Earnings" subtitle="Platform commission revenue from bookings.">
      {loading ? (
        <LoadingState variant="section" />
      ) : (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-4 animate-reveal">
            <div className="bg-card rounded-sm border border-border p-5">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <span className="text-fs-xs text-muted-foreground font-medium">Booking Revenue</span>
              </div>
              <p className="text-fs-2xl font-bold text-heading tabular-nums">
                ${totalBookingRevenue.toLocaleString()}
              </p>
              <p className="text-fs-xs text-muted-foreground mt-1">{paidBookings.length} paid bookings</p>
            </div>
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-sm border border-primary/20 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="w-4 h-4 text-primary" />
                <span className="text-fs-xs text-primary font-medium">Commission Earned</span>
              </div>
              <p className="text-fs-2xl font-bold text-heading tabular-nums">
                ${totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-fs-xs text-muted-foreground mt-1">{commissionRate}% per booking</p>
            </div>
            <div className="bg-card rounded-sm border border-border p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-fs-xs text-muted-foreground font-medium">Avg Order Value</span>
              </div>
              <p className="text-fs-2xl font-bold text-heading tabular-nums">
                ${paidBookings.length ? (totalBookingRevenue / paidBookings.length).toFixed(2) : "0.00"}
              </p>
              <p className="text-fs-xs text-muted-foreground mt-1">across paid bookings</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 animate-reveal" style={{ animationDelay: "120ms" }}>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 ml-auto">
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          </div>

          <div className="bg-card rounded-sm border border-border overflow-hidden animate-reveal" style={{ animationDelay: "160ms" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-fs-sm">
                <thead>
                  <tr className="border-b border-border text-fs-xs text-muted-foreground">
                    <th className="text-left py-3 px-5 font-medium">Booking</th>
                    <th className="text-left py-3 px-5 font-medium">Date</th>
                    <th className="text-left py-3 px-5 font-medium">Status</th>
                    <th className="text-left py-3 px-5 font-medium">Payment</th>
                    <th className="text-right py-3 px-5 font-medium">Amount</th>
                    <th className="text-right py-3 px-5 font-medium">Commission</th>
                    <th className="text-right py-3 px-5 font-medium">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        No payment records found.
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((b) => {
                      const comm = calcCommission(b);
                      const price = b.total_price || 0;
                      const net = price - comm;
                      return (
                        <tr key={b.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-5 font-mono text-fs-xs text-heading">#{b.id.slice(0, 8)}</td>
                          <td className="py-3 px-5 text-body">{b.booking_date}</td>
                          <td className="py-3 px-5">
                            <span className="text-fs-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">
                              {b.status}
                            </span>
                          </td>
                          <td className="py-3 px-5">
                            <span className={`text-fs-xs font-medium px-2.5 py-1 rounded-full ${paymentStatusStyle[b.payment_status] || paymentStatusStyle.unpaid}`}>
                              {b.payment_status}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-right font-medium text-heading tabular-nums">${price.toFixed(2)}</td>
                          <td className="py-3 px-5 text-right text-destructive tabular-nums">${comm.toFixed(2)}</td>
                          <td className="py-3 px-5 text-right text-primary font-semibold tabular-nums">${net.toFixed(2)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <NumberedPagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={totalItems}
              pageSize={pageSize}
              className="py-4 border-t border-border/40"
          onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      )}
    </AdminPage>
  );
}
