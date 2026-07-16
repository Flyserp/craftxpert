import { useMemo } from "react";
import { format } from "date-fns";
import { AlertTriangle, Wallet, X, MessageSquareWarning } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { evaluateBookingPolicy, formatTimeUntil } from "@/lib/bookingPolicy";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingDate: string;        // YYYY-MM-DD
  startTime: string;          // HH:MM(:SS)
  status: string;
  paidAmount: number;
  vendorName?: string;
  serviceTitle?: string;
  submitting?: boolean;
  onConfirm: () => void;
  onFileDispute?: () => void;
}

const tierTone: Record<string, string> = {
  full: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/60",
  partial: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/60",
  none: "bg-destructive/10 text-destructive border-destructive/30",
};

export default function CancelBookingModal({
  open, onOpenChange, bookingDate, startTime, status, paidAmount,
  vendorName, serviceTitle, submitting, onConfirm, onFileDispute,
}: Props) {
  const policy = useMemo(
    () => evaluateBookingPolicy({ bookingDate, startTime, status, paidAmount }),
    [bookingDate, startTime, status, paidAmount],
  );

  const startDate = new Date(`${bookingDate}T${startTime.length === 5 ? `${startTime}:00` : startTime}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <X className="w-5 h-5 text-destructive" /> Cancel booking?
          </DialogTitle>
          <DialogDescription>
            {serviceTitle ? `${serviceTitle} ` : ""}with {vendorName || "your pro"} on{" "}
            {format(startDate, "EEE, MMM d")} at {startTime.slice(0, 5)} ({formatTimeUntil(policy.hoursUntilStart)}).
          </DialogDescription>
        </DialogHeader>

        {/* Refund tier banner */}
        <div className={`rounded-lg border p-3 ${tierTone[policy.cancelTier]}`}>
          <div className="flex items-start gap-2">
            {policy.cancelTier === "none" ? (
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <Wallet className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <div className="text-fs-xs leading-relaxed">
              <p className="font-semibold mb-0.5">
                {policy.cancelTier === "full" && `Full refund — $${policy.refundAmount.toFixed(2)}`}
                {policy.cancelTier === "partial" && `50% refund — $${policy.refundAmount.toFixed(2)}`}
                {policy.cancelTier === "none" && (paidAmount > 0 ? "No refund" : "No payment to refund")}
              </p>
              <p className="opacity-90">{policy.cancelExplanation}</p>
            </div>
          </div>
        </div>

        {/* Dispute escalation for non-refundable cancellations */}
        {policy.cancelTier === "none" && paidAmount > 0 && onFileDispute && (
          <button
            type="button"
            onClick={onFileDispute}
            className="w-full text-left rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors p-3 flex items-start gap-2.5 group"
          >
            <MessageSquareWarning className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-fs-xs leading-relaxed">
              <p className="font-semibold text-heading group-hover:underline">
                Something went wrong? File a dispute instead
              </p>
              <p className="text-muted-foreground mt-0.5">
                If your pro is unreachable or the service was misrepresented, our team can review and may issue a refund outside the standard policy.
              </p>
            </div>
          </button>
        )}

        {/* Policy reminder */}
        <details className="text-fs-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground">View cancellation policy</summary>
          <ul className="mt-2 space-y-1 pl-4 list-disc">
            <li>≥ 48 hours before start: 100% refund to wallet</li>
            <li>24–48 hours before start: 50% refund to wallet</li>
            <li>&lt; 24 hours before start: non-refundable</li>
            <li>If your pro hasn't accepted yet, you always get a full refund.</li>
          </ul>
        </details>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Keep booking
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={submitting || !policy.canCancel}
            className="gap-1.5"
          >
            <X className="w-4 h-4" />
            {submitting ? "Cancelling…" : "Confirm cancellation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
