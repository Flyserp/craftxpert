-- 1) Replace the permissive INSERT policy on reviews with a strict one
DROP POLICY IF EXISTS "Clients can create reviews for their bookings" ON public.reviews;

CREATE POLICY "Clients can create reviews for completed bookings"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = customer_id
  AND public.has_role(auth.uid(), 'client'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = reviews.booking_id
      AND b.customer_id = auth.uid()
      AND b.vendor_id = reviews.vendor_id
      AND b.status = 'completed'
  )
);

-- 2) Enforce one review per booking (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reviews_booking_id_unique'
      AND conrelid = 'public.reviews'::regclass
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_booking_id_unique UNIQUE (booking_id);
  END IF;
END$$;

-- 3) Constrain rating to 1..5 (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reviews_rating_range'
      AND conrelid = 'public.reviews'::regclass
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5);
  END IF;
END$$;