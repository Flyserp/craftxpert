import * as React from "react";
import { MapPin, Clock, Briefcase } from "lucide-react";
import { AppCard } from "../AppCard";
import { AppBadge } from "../AppBadge";
import { cn } from "@/lib/utils";
import { Heading } from "@/components/ui/app";

export interface JobCardProps {
  title: string;
  company?: string;
  location?: string;
  type?: string;
  postedAt?: string;
  salary?: string;
  tags?: string[];
  description?: string;
  onClick?: () => void;
  footer?: React.ReactNode;
  className?: string;
}

export function JobCard({
  title,
  company,
  location,
  type,
  postedAt,
  salary,
  tags,
  description,
  onClick,
  footer,
  className,
}: JobCardProps) {
  return (
    <AppCard
      onClick={onClick}
      className={cn(onClick && "cursor-pointer hover:border-primary/40 transition-colors", className)}
      footer={footer}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Heading level={3}  className="truncate">{title}</Heading>
          {company && <p className="text-fs-sm text-muted-foreground truncate">{company}</p>}
        </div>
        {salary && (
          <div className="text-right shrink-0">
            <p className="text-fs-sm font-semibold text-heading">{salary}</p>
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-fs-xs text-muted-foreground">
        {location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {location}
          </span>
        )}
        {type && (
          <span className="inline-flex items-center gap-1">
            <Briefcase className="w-3.5 h-3.5" />
            {type}
          </span>
        )}
        {postedAt && (
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {postedAt}
          </span>
        )}
      </div>
      {description && <p className="mt-2 text-fs-sm text-muted-foreground clamp-2">{description}</p>}
      {tags && tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <AppBadge key={t} variant="secondary">{t}</AppBadge>
          ))}
        </div>
      )}
    </AppCard>
  );
}

