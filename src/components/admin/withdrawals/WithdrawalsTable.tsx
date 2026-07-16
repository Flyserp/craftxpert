import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Eye, Banknote } from "lucide-react";
import { WithdrawalRow, statusConfig } from "./types";

interface Props {
  rows: WithdrawalRow[];
  totalRowCount: number;
  profiles: Record<string, string>;
  onReview: (row: WithdrawalRow) => void;
}

export default function WithdrawalsTable({ rows, totalRowCount, profiles, onReview }: Props) {
  if (rows.length === 0) {
    return (
      <div className="bg-card rounded-sm border border-border p-12 text-center">
        <Banknote className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
        <p className="text-description-sm">
          {totalRowCount === 0 ? "No withdrawal requests yet" : "No requests match your filters"}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-sm border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-fs-sm">
          <thead>
            <tr className="border-b border-border text-fs-xs text-muted-foreground">
              <th className="text-left py-3 px-5 font-medium">Provider</th>
              <th className="text-left py-3 px-5 font-medium">Method</th>
              <th className="text-right py-3 px-5 font-medium">Amount</th>
              <th className="text-left py-3 px-5 font-medium">Status</th>
              <th className="text-left py-3 px-5 font-medium">Requested</th>
              <th className="text-right py-3 px-5 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const sc = statusConfig[r.status] || statusConfig.pending;
              return (
                <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-5 text-heading font-medium">{profiles[r.vendor_id] || "Unknown"}</td>
                  <td className="py-3 px-5 text-body capitalize">{r.payment_method.replace("_", " ")}</td>
                  <td className="py-3 px-5 text-right font-medium text-heading tabular-nums">${Number(r.amount).toFixed(2)}</td>
                  <td className="py-3 px-5">
                    <Badge variant="secondary" className={cn("text-[10px] capitalize", sc.color)}>{r.status}</Badge>
                  </td>
                  <td className="py-3 px-5 text-fs-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="py-3 px-5 text-right">
                    <Button variant="ghost" size="sm" className="gap-1 text-fs-xs" onClick={() => onReview(r)}>
                      <Eye className="w-3.5 h-3.5" /> Review
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
