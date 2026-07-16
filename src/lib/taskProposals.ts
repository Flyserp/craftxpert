import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "@/lib/notifications";

interface AcceptArgs {
  proposalId: string;
  taskId: string;
  providerId: string;
  customerId: string;
  serviceId: string | null;
  quotedPrice: number | null;
  etaDate: string | null;
  taskTitle: string;
  preferredTime?: string | null;
}

/**
 * Accept a task proposal:
 * 1. Mark proposal as accepted
 * 2. Auto-create a booking from the task + proposal data
 * 3. Mark task as in_progress
 * 4. Auto-decline other pending proposals on the same task
 * 5. Notify both parties
 */
export async function acceptProposal({
  proposalId,
  taskId,
  providerId,
  customerId,
  serviceId,
  quotedPrice,
  etaDate,
  taskTitle,
  preferredTime,
}: AcceptArgs): Promise<{ error?: string; bookingId?: string }> {
  if (!serviceId) {
    return { error: "This proposal has no associated service. Cannot create a booking." };
  }
  if (!etaDate) {
    return { error: "This proposal has no scheduled date. Cannot create a booking." };
  }

  const startTime = preferredTime || "09:00";
  // naive +1h end time
  const [h, m] = startTime.split(":").map(Number);
  const endTime = `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  // 1. Create booking
  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .insert({
      customer_id: customerId,
      vendor_id: providerId,
      service_id: serviceId,
      booking_date: etaDate,
      start_time: startTime,
      end_time: endTime,
      status: "confirmed",
      total_price: quotedPrice,
      subtotal: quotedPrice,
      notes: `Created from task proposal: ${taskTitle}`,
    })
    .select("id")
    .single();

  if (bookingErr || !booking) {
    return { error: bookingErr?.message || "Failed to create booking" };
  }

  // 2. Mark proposal accepted
  await supabase
    .from("task_proposals")
    .update({ status: "accepted", booking_id: booking.id, responded_at: new Date().toISOString() })
    .eq("id", proposalId);

  // 3. Decline other pending proposals
  await supabase
    .from("task_proposals")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("task_id", taskId)
    .eq("status", "pending")
    .neq("id", proposalId);

  // 4. Mark task in_progress
  await supabase.from("tasks").update({ status: "in_progress" }).eq("id", taskId);

  // 5. Notifications
  await Promise.all([
    createNotification({
      userId: providerId,
      type: "proposal_accepted",
      title: "Proposal accepted!",
      message: `Your proposal for "${taskTitle}" was accepted. A booking has been created.`,
      metadata: { booking_id: booking.id, task_id: taskId },
    }),
    createNotification({
      userId: customerId,
      type: "task_assigned",
      title: "Task assigned",
      message: `A professional has been assigned to "${taskTitle}".`,
      metadata: { booking_id: booking.id, task_id: taskId },
    }),
  ]);

  return { bookingId: booking.id };
}

export async function declineProposal(proposalId: string, notifyUserId: string, taskTitle: string) {
  await supabase
    .from("task_proposals")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", proposalId);
  await createNotification({
    userId: notifyUserId,
    type: "proposal_declined",
    title: "Proposal declined",
    message: `Your proposal for "${taskTitle}" was declined.`,
  });
}

export async function withdrawProposal(proposalId: string) {
  await supabase
    .from("task_proposals")
    .update({ status: "withdrawn", responded_at: new Date().toISOString() })
    .eq("id", proposalId);
}

export async function shortlistProposal(proposalId: string, vendorId: string, taskTitle: string) {
  await supabase
    .from("task_proposals")
    .update({ status: "shortlisted", responded_at: new Date().toISOString() })
    .eq("id", proposalId);
  await createNotification({
    userId: vendorId,
    type: "proposal_shortlisted",
    title: "You've been shortlisted",
    message: `Your proposal for "${taskTitle}" was shortlisted.`,
  });
}
