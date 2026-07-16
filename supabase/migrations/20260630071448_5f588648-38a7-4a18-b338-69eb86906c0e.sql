
-- 1) History table
CREATE TABLE IF NOT EXISTS public.sponsorship_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.vendor_services(id) ON DELETE CASCADE,
  days integer NOT NULL CHECK (days > 0),
  amount numeric(10,2) NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sponsorship_orders TO authenticated;
GRANT ALL ON public.sponsorship_orders TO service_role;

ALTER TABLE public.sponsorship_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors view their own sponsorship orders"
  ON public.sponsorship_orders FOR SELECT
  USING (auth.uid() = vendor_id);

CREATE POLICY "Admins view all sponsorship orders"
  ON public.sponsorship_orders FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "System/vendor insert via RPC"
  ON public.sponsorship_orders FOR INSERT
  WITH CHECK (auth.uid() = vendor_id);

CREATE INDEX IF NOT EXISTS idx_sponsorship_orders_vendor ON public.sponsorship_orders (vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sponsorship_orders_service ON public.sponsorship_orders (service_id, created_at DESC);

-- 2) Updated RPC: variable duration, price from settings, write order
CREATE OR REPLACE FUNCTION public.sponsor_vendor_service(_service_id uuid, _days integer DEFAULT 30)
RETURNS public.vendor_services
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_service public.vendor_services;
  v_price_per_day numeric;
  v_amount numeric;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
BEGIN
  IF _days IS NULL OR _days <= 0 THEN
    RAISE EXCEPTION 'Sponsorship days must be greater than zero';
  END IF;

  SELECT * INTO v_service FROM public.vendor_services WHERE id = _service_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service not found'; END IF;
  IF v_service.vendor_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT COALESCE(NULLIF(value, '')::numeric, 0.65)
    INTO v_price_per_day
    FROM public.platform_settings
   WHERE key = 'sponsorship_price_per_day';
  v_price_per_day := COALESCE(v_price_per_day, 0.65);
  v_amount := round(v_price_per_day * _days, 2);

  v_starts_at := GREATEST(COALESCE(v_service.sponsored_until, now()), now());
  v_ends_at   := v_starts_at + (_days || ' days')::interval;

  UPDATE public.vendor_services
     SET is_sponsored = true,
         sponsored_started_at = COALESCE(sponsored_started_at, now()),
         sponsored_until = v_ends_at,
         updated_at = now()
   WHERE id = _service_id
   RETURNING * INTO v_service;

  INSERT INTO public.sponsorship_orders (vendor_id, service_id, days, amount, starts_at, ends_at)
  VALUES (auth.uid(), _service_id, _days, v_amount, v_starts_at, v_ends_at);

  RETURN v_service;
END;
$function$;

-- 3) Default admin-configurable settings
INSERT INTO public.platform_settings (key, value, is_secret)
VALUES
  ('sponsorship_price_per_day', '0.65', false),
  ('sponsorship_durations', '7,14,30,60,90', false)
ON CONFLICT (key) DO NOTHING;
