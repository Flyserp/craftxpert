-- Allow new booking status
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled','reschedule_requested'));

-- Reschedule requests table
CREATE TABLE public.booking_reschedule_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  proposer_id uuid NOT NULL,
  proposer_role text NOT NULL CHECK (proposer_role IN ('customer','provider')),
  recipient_id uuid NOT NULL,
  original_date date NOT NULL,
  original_start_time time NOT NULL,
  proposed_date date NOT NULL,
  proposed_start_time time NOT NULL,
  proposed_end_time time NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','cancelled')),
  previous_booking_status text NOT NULL,
  responded_at timestamptz,
  response_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_brr_booking ON public.booking_reschedule_requests(booking_id);
CREATE INDEX idx_brr_recipient_pending ON public.booking_reschedule_requests(recipient_id) WHERE status='pending';

ALTER TABLE public.booking_reschedule_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties can view reschedule requests"
  ON public.booking_reschedule_requests FOR SELECT TO authenticated
  USING (auth.uid() = proposer_id OR auth.uid() = recipient_id);

CREATE POLICY "Parties can create reschedule requests"
  ON public.booking_reschedule_requests FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = proposer_id
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND (b.customer_id = auth.uid() OR b.vendor_id = auth.uid())
    )
  );

CREATE POLICY "Recipient or proposer can update"
  ON public.booking_reschedule_requests FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id OR auth.uid() = proposer_id);

CREATE TRIGGER trg_brr_updated
  BEFORE UPDATE ON public.booking_reschedule_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();