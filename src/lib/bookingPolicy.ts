/**
 * Cancellation + reschedule policy for customer-initiated booking changes.
 *
 * Refund tiers (deposit or full):
 *   - >= 48h before start  → 100% refund to wallet
 *   - 24-48h before start  → 50% refund to wallet
 *   - < 24h before start   → 0% (forfeit, customer can still file a dispute)
 *
 * Reschedule:
 *   - Allowed only when >= 24h before start AND status is pending/accepted/confirmed.
 */

export type RefundTier = "full" | "partial" | "none";
export type CancelOutcome = "free_full_refund" | "wallet_refund" | "forfeit";

export interface PolicyInput {
  /** ISO date "YYYY-MM-DD" */
  bookingDate: string;
  /** "HH:MM" or "HH:MM:SS" */
  startTime: string;
  /** "pending" | "accepted" | "confirmed" | etc. */
  status: string;
  /** Total paid by customer so far (deposit or full). */
  paidAmount: number;
  /** Has the booking been accepted by the provider? */
}

export interface PolicyResult {
  hoursUntilStart: number;
  isPast: boolean;
  /* cancel */
  canCancel: boolean;
  cancelTier: RefundTier;
  refundPercent: 0 | 50 | 100;
  refundAmount: number;
  cancelOutcome: CancelOutcome;
  cancelExplanation: string;
  /* reschedule */
  canReschedule: boolean;
  rescheduleBlockedReason: string | null;
}

const TERMINAL = ["completed", "cancelled", "in_progress"];

export function evaluateBookingPolicy(input: PolicyInput): PolicyResult {
  const start = combineDateTime(input.bookingDate, input.startTime);
  const now = new Date();
  const ms = start.getTime() - now.getTime();
  const hours = ms / (1000 * 60 * 60);
  const isPast = ms <= 0;

  const isTerminal = TERMINAL.includes(input.status);
  const isPending = input.status === "pending";

  // ── Refund tier ────────────────────────────────────────────────
  let refundPercent: 0 | 50 | 100 = 0;
  let cancelTier: RefundTier = "none";
  if (hours >= 48) {
    refundPercent = 100;
    cancelTier = "full";
  } else if (hours >= 24) {
    refundPercent = 50;
    cancelTier = "partial";
  }
  // Pending bookings haven't been accepted → always full refund.
  if (isPending) {
    refundPercent = 100;
    cancelTier = "full";
  }

  const paid = Math.max(0, Number(input.paidAmount) || 0);
  const refundAmount = Math.round(((paid * refundPercent) / 100) * 100) / 100;

  let cancelOutcome: CancelOutcome;
  if (paid === 0) cancelOutcome = "free_full_refund";
  else if (refundPercent === 100) cancelOutcome = paid > 0 ? "wallet_refund" : "free_full_refund";
  else if (refundPercent === 50) cancelOutcome = "wallet_refund";
  else cancelOutcome = "forfeit";

  const canCancel = !isTerminal && !isPast;
  const cancelExplanation = buildCancelExplanation({
    paid, refundAmount, refundPercent, isPending, hours,
  });

  // ── Reschedule ────────────────────────────────────────────────
  let canReschedule = !isTerminal && !isPast && hours >= 24;
  let rescheduleBlockedReason: string | null = null;
  if (isTerminal) rescheduleBlockedReason = `This booking is ${input.status} and can't be rescheduled.`;
  else if (isPast) rescheduleBlockedReason = "The start time has already passed.";
  else if (hours < 24) rescheduleBlockedReason = "Reschedule must be requested at least 24 hours before the start time. Please contact your pro directly.";

  return {
    hoursUntilStart: Math.max(0, hours),
    isPast,
    canCancel,
    cancelTier,
    refundPercent,
    refundAmount,
    cancelOutcome,
    cancelExplanation,
    canReschedule,
    rescheduleBlockedReason,
  };
}

function combineDateTime(date: string, time: string): Date {
  const t = time.length === 5 ? `${time}:00` : time;
  // Treat as local time
  return new Date(`${date}T${t}`);
}

function buildCancelExplanation(args: {
  paid: number; refundAmount: number; refundPercent: number; isPending: boolean; hours: number;
}): string {
  if (args.paid === 0) {
    return "No payment has been made yet — cancelling is free.";
  }
  if (args.isPending) {
    return `Your pro hasn't accepted yet, so you'll receive a full refund of $${args.refundAmount.toFixed(2)} to your wallet.`;
  }
  if (args.refundPercent === 100) {
    return `More than 48 hours before the start — you'll receive a full refund of $${args.refundAmount.toFixed(2)} to your wallet.`;
  }
  if (args.refundPercent === 50) {
    return `Within 48 hours of the start — you'll receive a 50% refund of $${args.refundAmount.toFixed(2)} to your wallet.`;
  }
  return `Less than 24 hours before the start — your $${args.paid.toFixed(2)} payment is non-refundable per the cancellation policy. You can still file a dispute if something went wrong.`;
}

/** Compact human-readable countdown like "in 3 days 4h" or "in 5h" */
export function formatTimeUntil(hours: number): string {
  if (hours <= 0) return "now";
  if (hours < 1) return `in ${Math.round(hours * 60)} min`;
  if (hours < 24) return `in ${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const h = Math.round(hours - days * 24);
  return h > 0 ? `in ${days}d ${h}h` : `in ${days}d`;
}
