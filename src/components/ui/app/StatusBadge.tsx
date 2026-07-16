import * as React from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Circle,
  PauseCircle,
  AlarmClockOff,
  CreditCard,
  Receipt,
  Ban,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusKind =
  | "pending"
  | "approved"
  | "rejected"
  | "verified"
  | "active"
  | "inactive"
  | "expired"
  | "paid"
  | "unpaid"
  | "cancelled";

interface StatusConfig {
  label: string;
  icon: LucideIcon;
  className: string;
}

const STATUS_MAP: Record<StatusKind, StatusConfig> = {
  pending:   { label: "Pending",   icon: Clock,          className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30" },
  approved:  { label: "Approved",  icon: CheckCircle2,   className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30" },
  rejected:  { label: "Rejected",  icon: XCircle,        className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30" },
  verified:  { label: "Verified",  icon: ShieldCheck,    className: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30" },
  active:    { label: "Active",    icon: Circle,         className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30" },
  inactive:  { label: "Inactive",  icon: PauseCircle,    className: "bg-muted text-muted-foreground border-border" },
  expired:   { label: "Expired",   icon: AlarmClockOff,  className: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30" },
  paid:      { label: "Paid",      icon: CreditCard,     className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30" },
  unpaid:    { label: "Unpaid",    icon: Receipt,        className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30" },
  cancelled: { label: "Cancelled", icon: Ban,            className: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-500/15 dark:text-zinc-300 dark:border-zinc-500/30" },
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusKind | string;
  /** Override the displayed label. */
  label?: string;
  /** Hide the leading icon. */
  hideIcon?: boolean;
  /** Compact size for dense tables. */
  size?: "sm" | "md";
}

/** Unified pill badge for entity status across the app. */
export function StatusBadge({
  status,
  label,
  hideIcon,
  size = "md",
  className,
  ...rest
}: StatusBadgeProps) {
  const key = String(status).toLowerCase() as StatusKind;
  const cfg = STATUS_MAP[key] ?? {
    label: String(status),
    icon: Circle,
    className: "bg-muted text-muted-foreground border-border",
  };
  const Icon = cfg.icon;
  return (
    <span
      {...rest}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-fs-xs" : "px-2.5 py-1 text-fs-sm",
        cfg.className,
        className,
      )}
    >
      {!hideIcon && <Icon className={cn(size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5")} />}
      {label ?? cfg.label}
    </span>
  );
}

