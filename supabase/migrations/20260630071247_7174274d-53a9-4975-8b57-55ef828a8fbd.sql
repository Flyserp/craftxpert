
ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS faqs jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Replace the wide-open public SELECT policy with active-only visibility
DROP POLICY IF EXISTS "Services are viewable by everyone" ON public.vendor_services;

CREATE POLICY "Active services are viewable by everyone"
  ON public.vendor_services FOR SELECT
  USING (is_active = true);

CREATE POLICY "Providers can view their own services"
  ON public.vendor_services FOR SELECT
  USING (auth.uid() = vendor_id);
