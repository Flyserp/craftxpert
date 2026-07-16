import * as React from "react";
import { Mail, Phone } from "lucide-react";
import { AppCard } from "../AppCard";
import { AppBadge } from "../AppBadge";
import { cn } from "@/lib/utils";
import { Heading } from "@/components/ui/app";

export interface CustomerCardProps {
  name: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
  status?: "active" | "inactive" | "pending";
  totalBookings?: number;
  totalSpent?: string;
  onClick?: () => void;
  footer?: React.ReactNode;
  className?: string;
}

const statusVariant = {
  active: "default",
  inactive: "secondary",
  pending: "outline",
} as const;

export function CustomerCard({
  name,
  avatarUrl,
  email,
  phone,
  status,
  totalBookings,
  totalSpent,
  onClick,
  footer,
  className,
}: CustomerCardProps) {
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
          <div className="flex items-center justify-between gap-2">
            <Heading level={3}  className="truncate">{name}</Heading>
            {status && <AppBadge variant={statusVariant[status]}>{status}</AppBadge>}
          </div>
          <div className="mt-1 space-y-0.5 text-fs-xs text-muted-foreground">
            {email && (
              <p className="inline-flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5" />
                {email}
              </p>
            )}
            {phone && (
              <p className="inline-flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                {phone}
              </p>
            )}
          </div>
        </div>
      </div>
      {(totalBookings != null || totalSpent) && (
        <div className="mt-3 grid grid-cols-2 gap-3 pt-3 border-t border-border/60">
          {totalBookings != null && (
            <div>
              <p className="text-fs-xs text-muted-foreground">Bookings</p>
              <p className="text-fs-sm font-semibold text-heading tabular-nums">{totalBookings}</p>
            </div>
          )}
          {totalSpent && (
            <div>
              <p className="text-fs-xs text-muted-foreground">Total spent</p>
              <p className="text-fs-sm font-semibold text-heading tabular-nums">{totalSpent}</p>
            </div>
          )}
        </div>
      )}
    </AppCard>
  );
}

