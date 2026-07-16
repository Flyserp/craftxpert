
CREATE TABLE IF NOT EXISTS public.category_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  commission_type text NOT NULL DEFAULT 'percent' CHECK (commission_type IN ('percent','fixed')),
  commission_value numeric NOT NULL DEFAULT 0 CHECK (commission_value >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id)
);

GRANT SELECT ON public.category_commissions TO anon, authenticated;
GRANT ALL ON public.category_commissions TO authenticated, service_role;

ALTER TABLE public.category_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view category commissions"
  ON public.category_commissions FOR SELECT USING (true);

CREATE POLICY "Admins manage category commissions"
  ON public.category_commissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_category_commissions_updated_at
  BEFORE UPDATE ON public.category_commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.platform_settings (key, value, is_secret)
VALUES
  ('platform_commission_type', 'percent', false),
  ('platform_commission_fixed', '0', false)
ON CONFLICT (key) DO NOTHING;
