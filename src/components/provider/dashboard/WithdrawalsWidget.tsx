import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowDownRight } from "lucide-react";
import { Heading } from "@/components/ui/app";

interface Props {
  balance: number;
}

const WithdrawalsWidget = ({ balance }: Props) => (
  <section className="bg-card rounded-sm border border-border p-5 animate-reveal-delay-2">
    <div className="flex items-center gap-2 mb-3">
      <ArrowDownRight className="w-4 h-4 text-emerald-500" />
      <Heading level={3} >Withdrawals</Heading>
    </div>
    <div className="text-center py-4">
      <p className="text-stat mb-1">${balance.toFixed(0)}</p>
      <p className="text-fs-xs text-muted-foreground mb-3">Available balance</p>
      <Link to="/provider-withdrawals">
        <Button size="sm" variant="outline" className="gap-1.5 text-fs-xs">
          <ArrowDownRight className="w-3 h-3" /> Request Withdrawal
        </Button>
      </Link>
    </div>
  </section>
);

export default WithdrawalsWidget;
