import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "@/lib/notifications";

interface BookingForReschedule {
  id: string;
  customer_id: string;
  vendor_id: string;
  booking_date: string;
  start_time: string;
  status: string;
}

interface ProposeArgs {
  booking: BookingForReschedule;
  proposerId: string;
  proposerRole: "customer" | "provider";
  newDate: string; // YYYY-MM-DD
  newStart: string; // HH:MM
  message?: string;
  proposerName?: string;
}

/**
 * Provider (or customer) proposes a reschedule. Creates a pending request,
 * flips booking.status to 'reschedule_requested', and notifies the recipient.
 */
export async function proposeReschedule(args: ProposeArgs): Promise<{ requestId: string }> {
  const recipientId =
    args.proposerRole === "provider" ? args.booking.customer_id : args.booking.vendor_id;

  const [h, m] = args.newStart.split(":").map(Number);
  const endTime = `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  // Cancel any other pending request for this booking (only one in flight).
  await supabase
    .from("booking_reschedule_requests")
    .update({ status: "cancelled", responded_at: new Date().toISOString() })
    .eq("booking_id", args.booking.id)
    .eq("status", "pending");

  const { data, error } = await supabase
    .from("booking_reschedule_requests")
    .insert({
      booking_id: args.booking.id,
      proposer_id: args.proposerId,
      proposer_role: args.proposerRole,
      recipient_id: recipientId,
      original_date: args.booking.booking_date,
      original_start_time: args.booking.start_time,
      proposed_date: args.newDate,
      proposed_start_time: args.newStart,
      proposed_end_time: endTime,
      message: args.message ?? null,
      previous_booking_status: args.booking.status,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message || "Could not create reschedule request");

  // Flip booking status so both sides see the pending state.
  await supabase
    .from("bookings")
    .update({ status: "reschedule_requested" })
    .eq("id", args.booking.id);

  await createNotification({
    userId: recipientId,
    type: "booking_rescheduled",
    title: "Reschedule requested",
    message: `${args.proposerName || (args.proposerRole === "provider" ? "Your pro" : "Your customer")} proposed a new time: ${args.newDate} at ${args.newStart}. Please approve or decline.`,
    metadata: { booking_id: args.booking.id, request_id: data.id, kind: "reschedule_requested" },
  });

  return { requestId: data.id };
}

interface RespondArgs {
  requestId: string;
  bookingId: string;
  proposerId: string;
  recipientId: string;
  proposedDate: string;
  proposedStart: string;
  proposedEnd: string;
  previousStatus: string;
  responderRole: "customer" | "provider";
  responderName?: string;
  note?: string;
}

/** Recipient approves: updates booking date/time, restores prior status, notifies proposer. */
export async function approveReschedule(args: RespondArgs): Promise<void> {
  // 1. Apply the new time on the booking and restore the prior status.
  const restoredStatus =
    args.previousStatus === "reschedule_requested" ? "confirmed" : args.previousStatus;
  const { error: bErr } = await supabase
    .from("bookings")
    .update({
      booking_date: args.proposedDate,
      start_time: args.proposedStart,
      end_time: args.proposedEnd,
      status: restoredStatus,
    })
    .eq("id", args.bookingId);
  if (bErr) throw new Error(bErr.message);

  // 2. Mark the request approved.
  await supabase
    .from("booking_reschedule_requests")
    .update({
      status: "approved",
      responded_at: new Date().toISOString(),
      response_note: args.note ?? null,
    })
    .eq("id", args.requestId);

  // 3. Notify the proposer.
  await createNotification({
    userId: args.proposerId,
    type: "booking_rescheduled",
    title: "Reschedule approved",
    message: `${args.responderName || "The other party"} approved your new time. The booking is now on ${args.proposedDate} at ${args.proposedStart}.`,
    metadata: { booking_id: args.bookingId, request_id: args.requestId, kind: "reschedule_approved" },
  });
}

/** Recipient declines: keep original date/time, restore prior status, notify proposer. */
export async function declineReschedule(args: RespondArgs): Promise<void> {
  const restoredStatus =
    args.previousStatus === "reschedule_requested" ? "confirmed" : args.previousStatus;
  await supabase
    .from("bookings")
    .update({ status: restoredStatus })
    .eq("id", args.bookingId);

  await supabase
    .from("booking_reschedule_requests")
    .update({
      status: "declined",
      responded_at: new Date().toISOString(),
      response_note: args.note ?? null,
    })
    .eq("id", args.requestId);

  await createNotification({
    userId: args.proposerId,
    type: "booking_rescheduled",
    title: "Reschedule declined",
    message: `${args.responderName || "The other party"} declined your reschedule request. The original time is kept.`,
    metadata: { booking_id: args.bookingId, request_id: args.requestId, kind: "reschedule_declined" },
  });
}

/** Proposer cancels their own pending request. Restores booking status. */
export async function cancelRescheduleRequest(args: {
  requestId: string;
  bookingId: string;
  recipientId: string;
  previousStatus: string;
}): Promise<void> {
  const restoredStatus =
    args.previousStatus === "reschedule_requested" ? "confirmed" : args.previousStatus;
  await supabase
    .from("bookings")
    .update({ status: restoredStatus })
    .eq("id", args.bookingId);

  await supabase
    .from("booking_reschedule_requests")
    .update({ status: "cancelled", responded_at: new Date().toISOString() })
    .eq("id", args.requestId);

  await createNotification({
    userId: args.recipientId,
    type: "booking_rescheduled",
    title: "Reschedule withdrawn",
    message: "The reschedule request was withdrawn. Your original time is kept.",
    metadata: { booking_id: args.bookingId, request_id: args.requestId, kind: "reschedule_cancelled" },
  });
}

/** Fetch the active (pending) reschedule request for a booking, if any. */
export async function getPendingRescheduleRequest(bookingId: string) {
  const { data } = await supabase
    .from("booking_reschedule_requests")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
