import { supabase } from "@/integrations/supabase/client";
import { evaluateBookingPolicy, type PolicyResult } from "@/lib/bookingPolicy";
import { createNotification } from "@/lib/notifications";

interface BookingForAction {
  id: string;
  customer_id: string;
  vendor_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  total_price: number | null;
  service_id: string;
}

/**
 * Cancel a booking and apply the refund tier to the customer's wallet.
 * Returns the policy result so the UI can show what happened.
 */
export async function cancelBookingWithRefund(
  booking: BookingForAction,
  vendorName?: string,
): Promise<{ policy: PolicyResult; refunded: number }> {
  const paid =
    booking.payment_status === "paid" || booking.payment_status === "deposit_paid"
      ? Number(booking.total_price ?? 0)
      : 0;

  const policy = evaluateBookingPolicy({
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    status: booking.status,
    paidAmount: paid,
  });

  if (!policy.canCancel) {
    throw new Error("This booking can no longer be cancelled.");
  }

  // 1. Mark the booking cancelled.
  const { error: updateErr } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", booking.id);
  if (updateErr) throw new Error(updateErr.message);

  // 2. If a refund is owed, credit the customer's wallet and log an audit row.
  let refundedAmount = 0;
  if (policy.refundAmount > 0) {
    refundedAmount = await creditCustomerWallet({
      customerId: booking.customer_id,
      amount: policy.refundAmount,
      bookingId: booking.id,
    });

    // Auto-create an approved refund_request so admins see this in /admin/refunds.
    const tierPct = Math.round((policy.refundAmount / paid) * 100);
    await supabase.from("refund_requests").insert({
      booking_id: booking.id,
      customer_id: booking.customer_id,
      amount: policy.refundAmount,
      reason: `Customer cancelled booking (${tierPct}% refund tier)`,
      status: "approved",
      admin_notes: `auto: cancellation tier ${tierPct}%`,
      reviewed_at: new Date().toISOString(),
    });
  }

  // 3. Notify both parties.
  await Promise.all([
    createNotification({
      userId: booking.vendor_id,
      type: "booking_cancelled",
      title: "Booking cancelled",
      message: `A booking on ${booking.booking_date} at ${booking.start_time.slice(0, 5)} was cancelled by the customer.`,
      metadata: { booking_id: booking.id },
    }),
    createNotification({
      userId: booking.customer_id,
      type: "booking_cancelled",
      title: refundedAmount > 0 ? "Booking cancelled — refund issued" : "Booking cancelled",
      message:
        refundedAmount > 0
          ? `Your booking with ${vendorName || "your pro"} was cancelled. $${refundedAmount.toFixed(2)} has been credited to your wallet.`
          : `Your booking with ${vendorName || "your pro"} was cancelled.`,
      metadata: { booking_id: booking.id, refund_amount: refundedAmount },
    }),
  ]);

  return { policy, refunded: refundedAmount };
}

/** Reschedule a booking to a new date+time. Caller must validate against vendor availability. */
export async function rescheduleBooking(args: {
  booking: BookingForAction;
  newDate: string; // YYYY-MM-DD
  newStart: string; // HH:MM
  vendorName?: string;
}): Promise<void> {
  const policy = evaluateBookingPolicy({
    bookingDate: args.booking.booking_date,
    startTime: args.booking.start_time,
    status: args.booking.status,
    paidAmount: Number(args.booking.total_price ?? 0),
  });
  if (!policy.canReschedule) {
    throw new Error(policy.rescheduleBlockedReason || "Booking can't be rescheduled.");
  }

  const [h] = args.newStart.split(":").map(Number);
  const newEnd = `${String(h + 1).padStart(2, "0")}:00`;

  const { error } = await supabase
    .from("bookings")
    .update({
      booking_date: args.newDate,
      start_time: args.newStart,
      end_time: newEnd,
      // Keep status the same — provider already accepted, etc.
    })
    .eq("id", args.booking.id);
  if (error) throw new Error(error.message);

  await Promise.all([
    createNotification({
      userId: args.booking.vendor_id,
      type: "booking_rescheduled",
      title: "Booking rescheduled",
      message: `A booking was moved to ${args.newDate} at ${args.newStart}.`,
      metadata: { booking_id: args.booking.id },
    }),
    createNotification({
      userId: args.booking.customer_id,
      type: "booking_rescheduled",
      title: "Booking rescheduled",
      message: `Your booking with ${args.vendorName || "your pro"} is now on ${args.newDate} at ${args.newStart}.`,
      metadata: { booking_id: args.booking.id },
    }),
  ]);
}

/** Credit the customer wallet and log a wallet_transaction. Returns the credited amount. */
async function creditCustomerWallet(args: {
  customerId: string;
  amount: number;
  bookingId: string;
}): Promise<number> {
  // Ensure wallet row exists.
  const { data: walletRow, error: walletErr } = await supabase
    .from("wallets")
    .select("id, balance")
    .eq("user_id", args.customerId)
    .maybeSingle();
  if (walletErr) throw new Error(walletErr.message);

  let walletId = walletRow?.id;
  let balance = Number(walletRow?.balance ?? 0);
  if (!walletId) {
    const { data: created, error: createErr } = await supabase
      .from("wallets")
      .insert({ user_id: args.customerId })
      .select("id, balance")
      .single();
    if (createErr) throw new Error(createErr.message);
    walletId = created.id;
    balance = Number(created.balance ?? 0);
  }

  const newBalance = Math.round((balance + args.amount) * 100) / 100;
  const { error: balErr } = await supabase
    .from("wallets")
    .update({ balance: newBalance })
    .eq("id", walletId);
  if (balErr) throw new Error(balErr.message);

  await supabase.from("wallet_transactions").insert({
    wallet_id: walletId,
    user_id: args.customerId,
    type: "refund",
    amount: args.amount,
    description: `Cancellation refund (booking ${args.bookingId.slice(0, 8)})`,
    reference_id: args.bookingId,
  });

  return args.amount;
}
