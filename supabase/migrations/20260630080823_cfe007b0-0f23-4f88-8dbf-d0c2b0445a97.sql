-- Admin manual service promotion
ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_until timestamptz,
  ADD COLUMN IF NOT EXISTS featured_started_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_vendor_services_is_featured
  ON public.vendor_services (is_featured) WHERE is_featured = true;

-- Allow admins to update any vendor_services row (for manual promotions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='vendor_services'
       AND policyname='Admins can update any service'
  ) THEN
    CREATE POLICY "Admins can update any service"
      ON public.vendor_services
      FOR UPDATE
      USING (public.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

-- Auto-expire featured flag
CREATE OR REPLACE FUNCTION public.expire_featured_services()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.vendor_services
     SET is_featured = false
   WHERE is_featured = true
     AND featured_until IS NOT NULL
     AND featured_until < now();
$$;

-- Admin promotion RPC
CREATE OR REPLACE FUNCTION public.admin_promote_service(
  _service_id uuid,
  _kind text,           -- 'featured' | 'sponsored'
  _days integer DEFAULT 30,
  _notes text DEFAULT NULL
)
RETURNS public.vendor_services
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_service public.vendor_services;
  v_starts timestamptz := now();
  v_ends   timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can promote services';
  END IF;
  IF _kind NOT IN ('featured','sponsored') THEN
    RAISE EXCEPTION 'Invalid promotion kind: %', _kind;
  END IF;
  IF _days IS NULL OR _days <= 0 THEN
    RAISE EXCEPTION 'Duration days must be greater than zero';
  END IF;

  SELECT * INTO v_service FROM public.vendor_services WHERE id = _service_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service not found'; END IF;

  IF _kind = 'sponsored' THEN
    v_starts := GREATEST(COALESCE(v_service.sponsored_until, now()), now());
    v_ends   := v_starts + (_days || ' days')::interval;
    UPDATE public.vendor_services
       SET is_sponsored = true,
           sponsored_started_at = COALESCE(sponsored_started_at, now()),
           sponsored_until = v_ends,
           updated_at = now()
     WHERE id = _service_id
    RETURNING * INTO v_service;
  ELSE
    v_starts := GREATEST(COALESCE(v_service.featured_until, now()), now());
    v_ends   := v_starts + (_days || ' days')::interval;
    UPDATE public.vendor_services
       SET is_featured = true,
           featured_started_at = COALESCE(featured_started_at, now()),
           featured_until = v_ends,
           updated_at = now()
     WHERE id = _service_id
    RETURNING * INTO v_service;
  END IF;

  INSERT INTO public.admin_audit_log
    (actor_id, action, entity_type, entity_id, target_user_id, details)
  VALUES (
    auth.uid(),
    'service.promoted.' || _kind,
    'vendor_service',
    _service_id::text,
    v_service.vendor_id,
    jsonb_build_object(
      'kind', _kind,
      'days', _days,
      'starts_at', v_starts,
      'ends_at', v_ends,
      'title', v_service.title,
      'notes', _notes
    )
  );

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    v_service.vendor_id,
    'Service promoted by admin',
    'Your service "' || v_service.title || '" was marked as ' || _kind ||
      ' for ' || _days || ' days.',
    'success',
    jsonb_build_object(
      'event', 'service.promoted',
      'kind', _kind,
      'service_id', _service_id,
      'ends_at', v_ends
    )
  );

  RETURN v_service;
END;
$$;

-- Remove promotion
CREATE OR REPLACE FUNCTION public.admin_remove_service_promotion(
  _service_id uuid,
  _kind text,           -- 'featured' | 'sponsored' | 'all'
  _notes text DEFAULT NULL
)
RETURNS public.vendor_services
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_service public.vendor_services;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can modify promotions';
  END IF;
  IF _kind NOT IN ('featured','sponsored','all') THEN
    RAISE EXCEPTION 'Invalid kind: %', _kind;
  END IF;

  SELECT * INTO v_service FROM public.vendor_services WHERE id = _service_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service not found'; END IF;

  UPDATE public.vendor_services
     SET is_sponsored = CASE WHEN _kind IN ('sponsored','all') THEN false ELSE is_sponsored END,
         sponsored_until = CASE WHEN _kind IN ('sponsored','all') THEN NULL ELSE sponsored_until END,
         is_featured = CASE WHEN _kind IN ('featured','all') THEN false ELSE is_featured END,
         featured_until = CASE WHEN _kind IN ('featured','all') THEN NULL ELSE featured_until END,
         updated_at = now()
   WHERE id = _service_id
  RETURNING * INTO v_service;

  INSERT INTO public.admin_audit_log
    (actor_id, action, entity_type, entity_id, target_user_id, details)
  VALUES (
    auth.uid(),
    'service.promotion_removed.' || _kind,
    'vendor_service',
    _service_id::text,
    v_service.vendor_id,
    jsonb_build_object('kind', _kind, 'title', v_service.title, 'notes', _notes)
  );

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    v_service.vendor_id,
    'Service promotion removed',
    'An admin removed the ' || _kind || ' promotion from "' || v_service.title || '".',
    'info',
    jsonb_build_object('event','service.promotion_removed','kind',_kind,'service_id',_service_id)
  );

  RETURN v_service;
END;
$$;