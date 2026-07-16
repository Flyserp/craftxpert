import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  ShieldCheck,
  CreditCard,
  Info,
  Loader2,
  type LucideIcon,
} from "lucide-react";

export type AppModalVariant =
  | "default"
  | "confirm"
  | "delete"
  | "verify"
  | "payment"
  | "image"
  | "success"
  | "warning"
  | "error";

export type AppModalSize = "sm" | "md" | "lg" | "xl" | "full";

export interface AppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  variant?: AppModalVariant;
  size?: AppModalSize;
  /** Image source — used automatically when variant="image". */
  imageSrc?: string;
  imageAlt?: string;
  /** Convenience footer: when onConfirm is provided, default Cancel/Confirm buttons are rendered. */
  onConfirm?: () => void | Promise<void>;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  hideClose?: boolean;
}

const VARIANT_META: Record<AppModalVariant, { icon: LucideIcon | null; iconClass: string }> = {
  default: { icon: null,           iconClass: "" },
  confirm: { icon: Info,           iconClass: "text-sky-600 dark:text-sky-400" },
  delete:  { icon: Trash2,         iconClass: "text-destructive" },
  verify:  { icon: ShieldCheck,    iconClass: "text-sky-600 dark:text-sky-400" },
  payment: { icon: CreditCard,     iconClass: "text-primary" },
  image:   { icon: null,           iconClass: "" },
  success: { icon: CheckCircle2,   iconClass: "text-emerald-600 dark:text-emerald-400" },
  warning: { icon: AlertTriangle,  iconClass: "text-amber-600 dark:text-amber-400" },
  error:   { icon: XCircle,        iconClass: "text-destructive" },
};

const SIZE_CLASS: Record<AppModalSize, string> = {
  sm:   "sm:max-w-sm",
  md:   "sm:max-w-md",
  lg:   "sm:max-w-lg",
  xl:   "sm:max-w-2xl",
  full: "sm:max-w-[95vw]",
};

/** Unified modal: confirmation, delete, verify, payment, image, success/warning/error. */
export function AppModal({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  className,
  variant = "default",
  size = "md",
  imageSrc,
  imageAlt,
  onConfirm,
  confirmLabel,
  cancelLabel = "Cancel",
  loading,
  hideClose,
}: AppModalProps) {
  const meta = VARIANT_META[variant];
  const Icon = meta.icon;

  // Sensible defaults per variant
  const resolvedConfirmLabel =
    confirmLabel ??
    (variant === "delete" ? "Delete" :
      variant === "verify" ? "Verify" :
      variant === "payment" ? "Pay now" :
      "Confirm");

  const handleConfirm = async () => {
    if (!onConfirm) return;
    await onConfirm();
  };

  const showDefaultFooter = !footer && (onConfirm || variant === "success" || variant === "error" || variant === "warning");
  const isDestructive = variant === "delete" || variant === "error";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-4 p-6",
          SIZE_CLASS[size],
          variant === "image" && "p-2 sm:max-w-3xl",
          className,
        )}
        onPointerDownOutside={loading ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={loading ? (e) => e.preventDefault() : undefined}
      >
        {(title || description) && (
          <DialogHeader>
            {title && (
              <DialogTitle className="flex items-center gap-2">
                {Icon && <Icon className={cn("w-5 h-5 shrink-0", meta.iconClass)} />}
                <span>{title}</span>
              </DialogTitle>
            )}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}

        {variant === "image" && imageSrc ? (
          <div className="flex items-center justify-center">
            <img
              src={imageSrc}
              alt={imageAlt ?? ""}
              className="max-h-[80vh] w-auto rounded-sm object-contain"
            />
          </div>
        ) : children}

        {footer && <DialogFooter>{footer}</DialogFooter>}
        {showDefaultFooter && (
          <DialogFooter className="gap-2">
            {onConfirm ? (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                  {cancelLabel}
                </Button>
                <Button
                  variant={isDestructive ? "destructive" : "default"}
                  onClick={handleConfirm}
                  disabled={loading}
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {resolvedConfirmLabel}
                </Button>
              </>
            ) : (
              <Button onClick={() => onOpenChange(false)}>OK</Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

