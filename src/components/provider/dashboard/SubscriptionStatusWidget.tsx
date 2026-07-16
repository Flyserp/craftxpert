import { Link } from "react-router-dom";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Heading } from "@/components/ui/app";

interface Props {
  planName?: string | null;
  status?: string | null;
  periodEnd?: string | null;
}

const SubscriptionStatusWidget = ({ planName, status, periodEnd }: Props) => {
  const active = status === "active";
  return (
    <section className="bg-card rounded-sm border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-accent-foreground" />
          <Heading level={3} >Subscription</Heading>
        </div>
        <Badge variant={active ? "default" : "secondary"} className="text-fs-2xs capitalize">
          {status || "inactive"}
        </Badge>
      </div>
      <p className="text-fs-base font-semibold text-heading">{planName || "Free plan"}</p>
      {periodEnd && active && (
        <p className="text-fs-xs text-muted-foreground mt-1">
          Renews {format(new Date(periodEnd), "MMM d, yyyy")}
        </p>
      )}
      <Link to="/provider-subscription" className="block mt-3">
        <Button size="sm" variant="outline" className="w-full text-fs-xs">
          {active ? "Manage plan" : "Upgrade"}
        </Button>
      </Link>
    </section>
  );
};

export default SubscriptionStatusWidget;