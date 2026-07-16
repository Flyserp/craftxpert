import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Wallet, BarChart3 } from "lucide-react";
import { Heading } from "@/components/ui/app";

interface Props {
  totalNet: number;
  commissionType: string;
  commissionValue: number;
  completedCount: number;
  totalGross?: number;
  totalCommission?: number;
}

const EarningsSummaryWidget = ({
  totalNet,
  commissionType,
  commissionValue,
  completedCount,
  totalGross,
  totalCommission,
}: Props) => (
  <section className="bg-gradient-to-br from-primary to-primary/80 rounded-sm p-5 text-primary-foreground animate-reveal-delay-2 relative overflow-hidden">
    <div
      className="absolute inset-0 opacity-10"
      style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
        backgroundSize: "16px 16px",
      }}
    />
    <div className="relative">
      <div className="flex items-center gap-2 mb-3">
        <Wallet className="w-4 h-4" />
        <Heading level={3} >Earnings Summary</Heading>
      </div>
      <p className="text-stat mb-0.5" style={{ fontSize: 'var(--fs-3xl)' }}>${totalNet.toFixed(0)}</p>
      <p className="text-fs-xs opacity-80 mb-1">
        Net earnings ({commissionType === "percentage" ? `${commissionValue}% commission` : `$${commissionValue} flat fee`})
      </p>
      <p className="text-[13px] opacity-60 mb-3">{completedCount} completed jobs</p>

      {(totalGross != null || totalCommission != null) && (
        <dl className="space-y-1 text-[11px] mb-4 pt-3 border-t border-primary-foreground/15">
          {totalGross != null && (
            <div className="flex justify-between opacity-80">
              <dt>Gross billed</dt>
              <dd className="tabular-nums">${totalGross.toFixed(2)}</dd>
            </div>
          )}
          {totalCommission != null && (
            <div className="flex justify-between opacity-80">
              <dt>Platform commission</dt>
              <dd className="tabular-nums">-${totalCommission.toFixed(2)}</dd>
            </div>
          )}
        </dl>
      )}

      <Link to="/provider-earnings">
        <Button
          variant="secondary"
          size="sm"
          className="w-full gap-1.5 bg-primary-foreground/15 hover:bg-primary-foreground/25 text-primary-foreground border-0"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          View Earnings
        </Button>
      </Link>
    </div>
  </section>
);

export default EarningsSummaryWidget;
