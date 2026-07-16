import { type LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Heading } from "@/components/ui/app";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  secondaryActionLabel,
  onSecondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in", className)}>
      <div className="w-16 h-16 rounded-sm bg-muted flex items-center justify-center mb-5">
        <Icon className="w-7 h-7 text-muted-foreground/60" />
      </div>
      <Heading level={3}  className="mb-1.5">{title}</Heading>
      {description && <p className="text-fs-sm text-muted-foreground max-w-sm">{description}</p>}
      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {actionLabel && (onAction || actionHref) && (
            <Button onClick={onAction} {...(actionHref ? { asChild: true } : {})}>
              {actionHref ? <a href={actionHref}>{actionLabel}</a> : actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="outline" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
