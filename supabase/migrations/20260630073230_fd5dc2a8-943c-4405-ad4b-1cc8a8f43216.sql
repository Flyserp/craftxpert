
CREATE TABLE public.advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  link_url text,
  placement text NOT NULL DEFAULT 'homepage_top',
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.advertisements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advertisements TO authenticated;
GRANT ALL ON public.advertisements TO service_role;

ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active scheduled ads"
  ON public.advertisements FOR SELECT
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  );

CREATE POLICY "Admins can view all ads"
  ON public.advertisements FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert ads"
  ON public.advertisements FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update ads"
  ON public.advertisements FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete ads"
  ON public.advertisements FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_advertisements_updated_at
  BEFORE UPDATE ON public.advertisements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_advertisements_placement_active
  ON public.advertisements (placement, is_active, sort_order);

CREATE TABLE public.advertisement_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.advertisements(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'click',
  referrer text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.advertisement_clicks TO anon;
GRANT SELECT, INSERT ON public.advertisement_clicks TO authenticated;
GRANT ALL ON public.advertisement_clicks TO service_role;

ALTER TABLE public.advertisement_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record ad events"
  ON public.advertisement_clicks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view ad events"
  ON public.advertisement_clicks FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_advertisement_clicks_ad ON public.advertisement_clicks (ad_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.record_ad_event(_ad_id uuid, _event_type text DEFAULT 'click')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.advertisement_clicks (ad_id, user_id, event_type)
  VALUES (_ad_id, auth.uid(), COALESCE(_event_type, 'click'));

  IF _event_type = 'impression' THEN
    UPDATE public.advertisements SET impressions = impressions + 1 WHERE id = _ad_id;
  ELSE
    UPDATE public.advertisements SET clicks = clicks + 1 WHERE id = _ad_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_ad_event(uuid, text) TO anon, authenticated;
