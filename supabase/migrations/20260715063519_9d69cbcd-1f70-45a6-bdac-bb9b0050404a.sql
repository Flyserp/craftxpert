ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_booking_id_fkey;
ALTER TABLE public.conversations ALTER COLUMN booking_id DROP NOT NULL;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
  ON DELETE SET NULL ON UPDATE CASCADE;