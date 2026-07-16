CREATE TABLE public.subcategory_overrides (
  subcategory_id uuid PRIMARY KEY REFERENCES public.service_subcategories(id) ON DELETE CASCADE,
  is_hidden boolean NOT NULL DEFAULT false,
  sort_order integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.subcategory_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.subcategory_overrides TO authenticated;
GRANT ALL ON public.subcategory_overrides TO service_role;

ALTER TABLE public.subcategory_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Overrides readable by everyone"
  ON public.subcategory_overrides FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert overrides"
  ON public.subcategory_overrides FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update overrides"
  ON public.subcategory_overrides FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete overrides"
  ON public.subcategory_overrides FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.touch_subcategory_override()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_touch_subcategory_override
  BEFORE INSERT OR UPDATE ON public.subcategory_overrides
  FOR EACH ROW EXECUTE FUNCTION public.touch_subcategory_override();

CREATE INDEX idx_subcategory_overrides_hidden
  ON public.subcategory_overrides (is_hidden)
  WHERE is_hidden = true;