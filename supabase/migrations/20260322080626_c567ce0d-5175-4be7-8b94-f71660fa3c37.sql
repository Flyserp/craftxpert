
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.vendor_services(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  total_price NUMERIC(10, 2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Customers can view their own bookings
CREATE POLICY "Customers can view own bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

-- Vendors can view bookings assigned to them
CREATE POLICY "Vendors can view their bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = vendor_id);

-- Customers can create bookings
CREATE POLICY "Customers can create bookings"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id AND public.has_role(auth.uid(), 'customer'));

-- Vendors can update booking status
CREATE POLICY "Vendors can update their bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'vendor'));

-- Customers can cancel their own bookings
CREATE POLICY "Customers can update own bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id AND public.has_role(auth.uid(), 'customer'));

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
