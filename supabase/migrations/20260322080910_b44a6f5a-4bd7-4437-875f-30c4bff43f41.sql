
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews are viewable by everyone"
  ON public.reviews FOR SELECT USING (true);

CREATE POLICY "Customers can create reviews for their bookings"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = customer_id
    AND public.has_role(auth.uid(), 'customer')
  );

CREATE POLICY "Customers can update their own reviews"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id);
