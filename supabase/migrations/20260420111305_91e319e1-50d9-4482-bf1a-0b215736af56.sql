-- Create public 'branding' storage bucket for PWA icons & related branding assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Public read on branding assets
DROP POLICY IF EXISTS "Branding assets are publicly accessible" ON storage.objects;
CREATE POLICY "Branding assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding');

-- Only admins can upload / replace / delete branding assets
DROP POLICY IF EXISTS "Admins can upload branding" ON storage.objects;
CREATE POLICY "Admins can upload branding"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update branding" ON storage.objects;
CREATE POLICY "Admins can update branding"
ON storage.objects FOR UPDATE
USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete branding" ON storage.objects;
CREATE POLICY "Admins can delete branding"
ON storage.objects FOR DELETE
USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Seed PWA-related platform settings (admins manage; everyone can read since not secret)
INSERT INTO public.platform_settings (key, value, is_secret) VALUES
  ('pwa_icon_url', NULL, false),
  ('pwa_app_name', 'TaskHive', false),
  ('pwa_short_name', 'TaskHive', false),
  ('pwa_theme_color', '#00272c', false),
  ('pwa_background_color', '#f7f9f7', false)
ON CONFLICT (key) DO NOTHING;
