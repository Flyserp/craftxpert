
CREATE TABLE public.countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.countries TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.countries TO authenticated;
GRANT ALL ON public.countries TO service_role;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Countries readable by all" ON public.countries FOR SELECT USING (true);
CREATE POLICY "Admins manage countries" ON public.countries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_countries_updated BEFORE UPDATE ON public.countries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.provinces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_id, name)
);
CREATE INDEX idx_provinces_country ON public.provinces(country_id);
GRANT SELECT ON public.provinces TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.provinces TO authenticated;
GRANT ALL ON public.provinces TO service_role;
ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Provinces readable by all" ON public.provinces FOR SELECT USING (true);
CREATE POLICY "Admins manage provinces" ON public.provinces FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_provinces_updated BEFORE UPDATE ON public.provinces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id uuid NOT NULL REFERENCES public.provinces(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (province_id, name)
);
CREATE INDEX idx_cities_province ON public.cities(province_id);
GRANT SELECT ON public.cities TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cities TO authenticated;
GRANT ALL ON public.cities TO service_role;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cities readable by all" ON public.cities FOR SELECT USING (true);
CREATE POLICY "Admins manage cities" ON public.cities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_cities_updated BEFORE UPDATE ON public.cities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
