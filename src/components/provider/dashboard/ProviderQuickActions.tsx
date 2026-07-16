import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Plus, CalendarDays, Eye, Coins, Shield, Zap } from "lucide-react";
import { Heading } from "@/components/ui/app";

interface Props {
  userId?: string;
}

const ProviderQuickActions = ({ userId }: Props) => {
  const actions = [
    { icon: Plus, label: "Add Service", to: "/provider-services", color: "text-primary", bg: "bg-primary/10" },
    { icon: CalendarDays, label: "Availability", to: "/provider-availability", color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { icon: Eye, label: "My Profile", to: `/provider/${userId}`, color: "text-blue-500", bg: "bg-blue-500/10" },
    { icon: Coins, label: "Lead Credits", to: "/provider-lead-credits", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { icon: Shield, label: "Plans", to: "/provider-plans", color: "text-amber-500", bg: "bg-amber-500/10" },
  ];

  return (
    <section className="bg-card rounded-sm border border-border p-5 animate-reveal-delay-2">
      <Heading level={3}  className="mb-4 flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        Quick Actions
      </Heading>
      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((a) => (
          <Link
            key={a.label}
            to={a.to}
            className="flex flex-col items-center gap-2 p-4 rounded-sm border border-border hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.97]"
          >
            <div className={cn("w-10 h-10 rounded-sm flex items-center justify-center", a.bg)}>
              <a.icon className={cn("w-5 h-5", a.color)} />
            </div>
            <span className="text-fs-xs font-medium text-heading text-center">{a.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default ProviderQuickActions;
