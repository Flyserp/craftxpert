import * as React from "react";
import { Building2, MapPin, Users } from "lucide-react";
import { AppCard } from "../AppCard";
import { AppBadge } from "../AppBadge";
import { cn } from "@/lib/utils";
import { Heading } from "@/components/ui/app";

export interface EmployerCardProps {
  companyName: string;
  logoUrl?: string;
  industry?: string;
  location?: string;
  employees?: string | number;
  openJobs?: number;
  verified?: boolean;
  onClick?: () => void;
  footer?: React.ReactNode;
  className?: string;
}

export function EmployerCard({
  companyName,
  logoUrl,
  industry,
  location,
  employees,
  openJobs,
  verified,
  onClick,
  footer,
  className,
}: EmployerCardProps) {
  return (
    <AppCard
      onClick={onClick}
      className={cn(onClick && "cursor-pointer hover:border-primary/40 transition-colors", className)}
      footer={footer}
    >
      <div className="flex items-start gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt={companyName} className="w-12 h-12 rounded-sm object-cover bg-muted" />
        ) : (
          <div className="w-12 h-12 rounded-sm bg-muted flex items-center justify-center">
            <Building2 className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Heading level={3}  className="truncate">{companyName}</Heading>
            {verified && <AppBadge variant="secondary">Verified</AppBadge>}
          </div>
          {industry && <p className="text-fs-xs text-muted-foreground truncate">{industry}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-fs-xs text-muted-foreground">
            {location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {location}
              </span>
            )}
            {employees && (
              <span className="inline-flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {employees}
              </span>
            )}
          </div>
        </div>
        {openJobs != null && (
          <div className="text-right shrink-0">
            <p className="text-fs-lg font-semibold text-heading tabular-nums">{openJobs}</p>
            <p className="text-fs-xs text-muted-foreground">open jobs</p>
          </div>
        )}
      </div>
    </AppCard>
  );
}

