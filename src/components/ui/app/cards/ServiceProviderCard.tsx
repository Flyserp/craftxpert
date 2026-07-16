import * as React from "react";
import { Star, MapPin, BadgeCheck } from "lucide-react";
import { AppCard } from "../AppCard";
import { AppBadge } from "../AppBadge";
import { cn } from "@/lib/utils";
import { Heading } from "@/components/ui/app";

export interface ServiceProviderCardProps {
  name: string;
  avatarUrl?: string;
  headline?: string;
  location?: string;
  rating?: number;
  reviewCount?: number;
  verified?: boolean;
  tags?: string[];
  priceLabel?: string;
  onClick?: () => void;
  footer?: React.ReactNode;
  className?: string;
}

/** Marketplace provider card. */
export function ServiceProviderCard({
  name,
  avatarUrl,
  headline,
  location,
  rating,
  reviewCount,
  verified,
  tags,
  priceLabel,
  onClick,
  footer,
  className,
}: ServiceProviderCardProps) {
  return (
    <AppCard
      onClick={onClick}
      className={cn(onClick && "cursor-pointer hover:border-primary/40 transition-colors", className)}
      footer={footer}
    >
      <div className="flex items-start gap-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-fs-sm font-semibold text-muted-foreground">
            {name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Heading level={3}  className="truncate">{name}</Heading>
            {verified && <BadgeCheck className="w-4 h-4 text-primary shrink-0" />}
          </div>
          {headline && <p className="text-fs-xs text-muted-foreground truncate">{headline}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-fs-xs text-muted-foreground">
            {rating != null && (
              <span className="inline-flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="tabular-nums font-medium text-heading">{rating.toFixed(1)}</span>
                {reviewCount != null && <span>({reviewCount})</span>}
              </span>
            )}
            {location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {location}
              </span>
            )}
          </div>
        </div>
        {priceLabel && (
          <div className="text-right shrink-0">
            <p className="text-fs-sm font-semibold text-heading">{priceLabel}</p>
          </div>
        )}
      </div>
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

