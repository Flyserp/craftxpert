
-- Drop the strict unique constraint on (participant_1, participant_2)
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_participant_1_participant_2_key;

-- One conversation per booking
CREATE UNIQUE INDEX IF NOT EXISTS conversations_booking_unique
  ON public.conversations (booking_id) WHERE booking_id IS NOT NULL;

-- One general (no-booking) conversation per ordered pair
CREATE UNIQUE INDEX IF NOT EXISTS conversations_pair_no_booking_unique
  ON public.conversations (participant_1, participant_2) WHERE booking_id IS NULL;
