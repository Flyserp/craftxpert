
ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS is_sponsored boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sponsored_until timestamptz,
  ADD COLUMN IF NOT EXISTS sponsored_started_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_vendor_services_sponsored
  ON public.vendor_services (is_sponsored, sponsored_until);

CREATE OR REPLACE FUNCTION public.sponsor_vendor_service(_service_id uuid, _days int DEFAULT 30)
RETURNS public.vendor_services
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service public.vendor_services;
BEGIN
  SELECT * INTO v_service FROM public.vendor_services WHERE id = _service_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service not found'; END IF;
  IF v_service.vendor_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE public.vendor_services
     SET is_sponsored = true,
         sponsored_started_at = COALESCE(sponsored_started_at, now()),
         sponsored_until = GREATEST(COALESCE(sponsored_until, now()), now()) + (_days || ' days')::interval
   WHERE id = _service_id
   RETURNING * INTO v_service;

  RETURN v_service;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sponsor_vendor_service(uuid, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.expire_sponsored_services()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.vendor_services
     SET is_sponsored = false
   WHERE is_sponsored = true
     AND sponsored_until IS NOT NULL
     AND sponsored_until < now();
$$;
