
-- Service categories
CREATE TABLE public.service_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service categories are viewable by everyone"
  ON public.service_categories FOR SELECT USING (true);

CREATE POLICY "Admins can manage categories"
  ON public.service_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed default categories
INSERT INTO public.service_categories (name, icon) VALUES
  ('Plumbing', 'Droplet'),
  ('Electrical', 'Zap'),
  ('Painting', 'PaintBucket'),
  ('Carpentry', 'Hammer'),
  ('HVAC', 'Wind'),
  ('Moving', 'Truck'),
  ('Locksmith', 'Lock'),
  ('Landscaping', 'Leaf'),
  ('Cleaning', 'Sparkles'),
  ('Appliance Repair', 'Wrench');

-- Vendor services
CREATE TABLE public.vendor_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price_min NUMERIC(10, 2),
  price_max NUMERIC(10, 2),
  price_type TEXT NOT NULL DEFAULT 'hourly',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Services are viewable by everyone"
  ON public.vendor_services FOR SELECT USING (true);

CREATE POLICY "Vendors can insert their own services"
  ON public.vendor_services FOR INSERT
  WITH CHECK (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'vendor'));

CREATE POLICY "Vendors can update their own services"
  ON public.vendor_services FOR UPDATE
  USING (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'vendor'));

CREATE POLICY "Vendors can delete their own services"
  ON public.vendor_services FOR DELETE
  USING (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'vendor'));

CREATE TRIGGER update_vendor_services_updated_at
  BEFORE UPDATE ON public.vendor_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vendor availability (weekly recurring slots)
CREATE TABLE public.vendor_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, day_of_week, start_time)
);

ALTER TABLE public.vendor_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Availability is viewable by everyone"
  ON public.vendor_availability FOR SELECT USING (true);

CREATE POLICY "Vendors can manage their own availability"
  ON public.vendor_availability FOR ALL
  USING (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'vendor'));

-- Vendor blocked dates (specific dates off)
CREATE TABLE public.vendor_blocked_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, blocked_date)
);

ALTER TABLE public.vendor_blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blocked dates are viewable by everyone"
  ON public.vendor_blocked_dates FOR SELECT USING (true);

CREATE POLICY "Vendors can manage their own blocked dates"
  ON public.vendor_blocked_dates FOR ALL
  USING (auth.uid() = vendor_id AND public.has_role(auth.uid(), 'vendor'));
