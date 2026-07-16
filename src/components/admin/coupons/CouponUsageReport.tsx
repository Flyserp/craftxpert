import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TicketCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePagination } from "@/hooks/usePagination";
import NumberedPagination from "@/components/common/NumberedPagination";
import { Heading, LoadingState } from "@/components/ui/app";

interface BookingRow {
  coupon_code: string | null;
  status: string;
  discount_amount: number | null;
  total_price: number | null;
}

interface CouponAgg {
  code: string;
  uses: number;
  totalDiscount: number;
  totalRevenue: number;
  byStatus: Record<string, number>;
}

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  in_progress: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

const fmtMoney = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CouponUsageReport() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select("coupon_code, status, discount_amount, total_price")
        .not("coupon_code", "is", null);
      setRows((data || []) as BookingRow[]);
      setLoading(false);
    })();
  }, []);

  const aggregates = useMemo<CouponAgg[]>(() => {
    const map = new Map<string, CouponAgg>();
    for (const r of rows) {
      const code = (r.coupon_code || "").trim().toUpperCase();
      if (!code) continue;
      const existing = map.get(code) || {
        code,
        uses: 0,
        totalDiscount: 0,
        totalRevenue: 0,
        byStatus: {},
      };
      existing.uses += 1;
      existing.totalDiscount += Number(r.discount_amount ?? 0);
      existing.totalRevenue += Number(r.total_price ?? 0);
      existing.byStatus[r.status] = (existing.byStatus[r.status] || 0) + 1;
      map.set(code, existing);
    }
    return [...map.values()].sort((a, b) => b.uses - a.uses);
  }, [rows]);

  const totals = useMemo(() => {
    return aggregates.reduce(
      (acc, a) => ({
        uses: acc.uses + a.uses,
        discount: acc.discount + a.totalDiscount,
        revenue: acc.revenue + a.totalRevenue,
      }),
      { uses: 0, discount: 0, revenue: 0 }
    );
  }, [aggregates]);

  const { page, setPage, totalPages, totalItems, pageItems, pageSize, setPageSize } = usePagination(aggregates, 10);

  return (
    <div className="bg-card rounded-sm border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <Heading level={3} >Coupon Usage Report</Heading>
        </div>
        <div className="flex items-center gap-3 text-fs-xs text-muted-foreground">
          <span><b className="text-foreground">{totals.uses}</b> uses</span>
          <span><b className="text-foreground">{fmtMoney(totals.discount)}</b> discounted</span>
        </div>
      </div>

      {loading ? (
        <LoadingState variant="inline" />
      ) : aggregates.length === 0 ? (
        <div className="py-10 text-center">
          <TicketCheck className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-description-sm">No coupons have been redeemed on bookings yet.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-fs-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="px-5 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium text-right">Uses</th>
                  <th className="px-3 py-2 font-medium text-right">Discount</th>
                  <th className="px-3 py-2 font-medium text-right">Revenue</th>
                  <th className="px-5 py-2 font-medium">Booking statuses</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((a) => (
                  <tr key={a.code} className="border-b border-border/50 last:border-0">
                    <td className="px-5 py-3 font-mono font-semibold text-heading">{a.code}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{a.uses}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtMoney(a.totalDiscount)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {fmtMoney(a.totalRevenue)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(a.byStatus).map(([status, count]) => (
                          <Badge
                            key={status}
                            variant="secondary"
                            className={cn(
                              "text-[10px] font-medium border-0",
                              STATUS_TONE[status] || "bg-muted text-muted-foreground"
                            )}
                          >
                            {status.replace("_", " ")} · {count}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <NumberedPagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
            className="mt-4"
          onPageSizeChange={setPageSize}
          />
        </>
      )}
    </div>
  );
}
