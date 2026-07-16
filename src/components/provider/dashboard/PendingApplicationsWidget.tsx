import { Link } from "react-router-dom";
import { Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/app";

interface Props {
  count: number;
  shortlisted: number;
}

const PendingApplicationsWidget = ({ count, shortlisted }: Props) => (
  <section className="bg-card rounded-sm border border-border p-5">
    <div className="flex items-center gap-2 mb-3">
      <Briefcase className="w-4 h-4 text-primary" />
      <Heading level={3} >Pending Applications</Heading>
    </div>
    <div className="text-center py-2">
      <p className="text-stat mb-1">{count}</p>
      <p className="text-fs-xs text-muted-foreground mb-3">
        {shortlisted} shortlisted
      </p>
      <Link to="/provider-tasks">
        <Button size="sm" variant="outline" className="text-fs-xs">
          Browse jobs
        </Button>
      </Link>
    </div>
  </section>
);

export default PendingApplicationsWidget;