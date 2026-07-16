import * as React from "react";
import { Check } from "lucide-react";
import { AppCard } from "../AppCard";
import { AppBadge } from "../AppBadge";
import { cn } from "@/lib/utils";
import { Heading } from "@/components/ui/app";

export interface SubscriptionCardProps {
  planName: string;
  price: string;
  interval?: string;
  description?: string;
  features?: string[];
  highlighted?: boolean;
  badge?: string;
  footer?: React.ReactNode;
  className?: string;
}

export function SubscriptionCard({
  planName,
  price,
  interval = "/mo",
  description,
  features,
  highlighted,
  badge,
  footer,
  className,
}: SubscriptionCardProps) {
  return (
    <AppCard
      className={cn(highlighted && "border-primary ring-1 ring-primary/20", className)}
      footer={footer}
    >
      <div className="flex items-center justify-between gap-2">
        <Heading level={3} >{planName}</Heading>
        {badge && <AppBadge>{badge}</AppBadge>}
      </div>
      {description && <p className="mt-1 text-fs-sm text-muted-foreground">{description}</p>}
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-fs-3xl font-bold text-heading">{price}</span>
        <span className="text-fs-sm text-muted-foreground">{interval}</span>
      </div>
      {features && features.length > 0 && (
        <ul className="mt-4 space-y-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-fs-sm text-body">
              <Check className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}
    </AppCard>
  );
}

