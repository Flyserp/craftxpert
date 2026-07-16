INSERT INTO public.platform_settings (key, value, is_secret)
VALUES ('brand_version', (extract(epoch from now()) * 1000)::bigint::text, false)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.bump_brand_version()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_version text;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  new_version := (extract(epoch from clock_timestamp()) * 1000)::bigint::text;

  INSERT INTO public.platform_settings (key, value, is_secret, updated_by, updated_at)
  VALUES ('brand_version', new_version, false, auth.uid(), now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at;

  RETURN new_version;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_brand_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_brand_version() TO authenticated;

CREATE OR REPLACE FUNCTION public.auto_bump_brand_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.key = 'brand_version' THEN
    RETURN NEW;
  END IF;

  IF NEW.key IN (
    'brand_primary', 'brand_accent',
    'site_logo_url', 'site_logo_light_url', 'site_logo_dark_url',
    'site_favicon_url', 'site_og_image_url', 'site_pwa_logo_url',
    'pwa_icon_url', 'pwa_app_name', 'pwa_short_name',
    'pwa_theme_color', 'pwa_background_color',
    'site_name', 'site_tagline'
  ) THEN
    INSERT INTO public.platform_settings (key, value, is_secret, updated_at)
    VALUES (
      'brand_version',
      (extract(epoch from clock_timestamp()) * 1000)::bigint::text,
      false,
      now()
    )
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = EXCLUDED.updated_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_bump_brand_version ON public.platform_settings;
CREATE TRIGGER trg_auto_bump_brand_version
  AFTER INSERT OR UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.auto_bump_brand_version();