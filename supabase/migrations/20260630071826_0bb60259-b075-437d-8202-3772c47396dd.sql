ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_until timestamptz,
  ADD COLUMN IF NOT EXISTS featured_rank integer;

CREATE INDEX IF NOT EXISTS idx_profiles_is_featured ON public.profiles (is_featured) WHERE is_featured = true;

INSERT INTO public.platform_settings (key, value)
VALUES
  ('homepage_featured_limit', '8'),
  ('homepage_featured_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
