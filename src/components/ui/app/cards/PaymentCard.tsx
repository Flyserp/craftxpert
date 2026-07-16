import * as React from "react";
import { CreditCard } from "lucide-react";
import { AppCard } from "../AppCard";
import { AppBadge } from "../AppBadge";
import { cn } from "@/lib/utils";

export interface PaymentCardProps {
  brand?: string;
  last4: string;
  expiry?: string;
  holderName?: string;
  isDefault?: boolean;
  onClick?: () => void;
  footer?: React.ReactNode;
  className?: string;
}

export function PaymentCard({
  brand = "Card",
  last4,
  expiry,
  holderName,
  isDefault,
  onClick,
  footer,
  className,
}: PaymentCardProps) {
  return (
    <AppCard
      onClick={onClick}
      className={cn(onClick && "cursor-pointer hover:border-primary/40 transition-colors", className)}
      footer={footer}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-sm bg-muted flex items-center justify-center shrink-0">
          <CreditCard className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-fs-sm font-semibold text-heading">
              {brand} •••• {last4}
            </p>
            {isDefault && <AppBadge variant="secondary">Default</AppBadge>}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-fs-xs text-muted-foreground">
            {holderName && <span>{holderName}</span>}
            {expiry && <span>Exp {expiry}</span>}
          </div>
        </div>
      </div>
    </AppCard>
  );
}

