import { supabase } from "@/integrations/supabase/client";

/**
 * Find or create a conversation tied to a specific booking.
 * One thread per booking — looks up by (booking_id, participant pair).
 * Falls back to creating a new conversation if none exists.
 *
 * Returns the conversation id, or null on error.
 */
export async function openBookingThread(
  userId: string,
  otherUserId: string,
  bookingId: string,
): Promise<string | null> {
  if (!userId || !otherUserId || !bookingId) return null;

  // Look for an existing booking-scoped conversation between this pair.
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("booking_id", bookingId)
    .or(
      `and(participant_1.eq.${userId},participant_2.eq.${otherUserId}),and(participant_1.eq.${otherUserId},participant_2.eq.${userId})`,
    )
    .limit(1);

  if (existing && existing.length > 0) return existing[0].id;

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      participant_1: userId,
      participant_2: otherUserId,
      booking_id: bookingId,
    })
    .select("id")
    .single();

  if (error || !created) return null;
  return created.id;
}
