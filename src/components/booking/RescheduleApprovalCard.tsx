import { format } from "date-fns";
import { CalendarClock, Check, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  request: {
    id: string;
    proposer_role: "customer" | "provider";
    original_date: string;
    original_start_time: string;
    proposed_date: string;
    proposed_start_time: string;
    message: string | null;
  };
  /** True when the current viewer is the recipient (must approve/decline). */
  isRecipient: boolean;
  proposerName?: string;
  submitting?: boolean;
  onApprove: () => void;
  onDecline: () => void;
  onWithdraw?: () => void;
}

export default function RescheduleApprovalCard({
  request, isRecipient, proposerName, submitting, onApprove, onDecline, onWithdraw,
}: Props) {
  const proposerLabel =
    proposerName || (request.proposer_role === "provider" ? "Your pro" : "Your customer");

  const fmt = (d: string, t: string) =>
    format(new Date(`${d}T${t.length === 5 ? `${t}:00` : t}`), "EEE, MMM d 'at' HH:mm");

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-sm p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
          <CalendarClock className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-fs-sm font-semibold text-heading">
            {isRecipient ? `${proposerLabel} proposed a new time` : "Waiting on customer approval"}
          </p>
          <p className="text-fs-xs text-muted-foreground mt-0.5">
            {isRecipient
              ? "Approve to update the booking, or decline to keep the original time."
              : "Your reschedule request is pending. The customer will get notified."}
          </p>
        </div>
      </div>

      <div className="bg-card/80 dark:bg-background/40 border border-amber-200/60 dark:border-amber-900/40 rounded-lg px-3 py-2.5 text-fs-xs flex items-center gap-2 flex-wrap">
        <span className="text-muted-foreground line-through tabular-nums">
          {fmt(request.original_date, request.original_start_time)}
        </span>
        <ArrowRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span className="font-semibold text-heading tabular-nums">
          {fmt(request.proposed_date, request.proposed_start_time)}
        </span>
      </div>

      {request.message && (
        <p className="text-fs-xs text-body mt-2.5 italic">"{request.message}"</p>
      )}

      <div className="flex gap-2 mt-3">
        {isRecipient ? (
          <>
            <Button size="sm" onClick={onApprove} disabled={submitting} className="gap-1.5">
              <Check className="w-3.5 h-3.5" /> Approve
            </Button>
            <Button size="sm" variant="outline" onClick={onDecline} disabled={submitting} className="gap-1.5">
              <X className="w-3.5 h-3.5" /> Decline
            </Button>
          </>
        ) : (
          onWithdraw && (
            <Button size="sm" variant="outline" onClick={onWithdraw} disabled={submitting} className="gap-1.5">
              <X className="w-3.5 h-3.5" /> Withdraw request
            </Button>
          )
        )}
      </div>
    </div>
  );
}
