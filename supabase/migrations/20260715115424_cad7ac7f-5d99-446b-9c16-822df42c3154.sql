-- Default settings
INSERT INTO public.platform_settings (key, value) VALUES
  ('vendor_verification_validity_days', '365'),
  ('employer_verification_validity_days', '365'),
  ('verification_reminder_days_csv', '30,7,1'),
  ('verification_warn_days', '30')
ON CONFLICT (key) DO NOTHING;

-- Helper to read an integer setting with a fallback
CREATE OR REPLACE FUNCTION public.get_setting_int(_key text, _default int)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(regexp_replace(value, '[^0-9\-]', '', 'g'), '')::int, _default)
    FROM public.platform_settings WHERE key = _key
  UNION ALL SELECT _default
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_setting_int(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_setting_int(text, int) TO authenticated, service_role;

-- Vendor stamp trigger — read validity from settings
CREATE OR REPLACE FUNCTION public.trg_stamp_vendor_verification_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days int;
BEGIN
  IF NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    v_days := public.get_setting_int('vendor_verification_validity_days', 365);
    NEW.expires_at := now() + make_interval(days => v_days);
    NEW.last_renewed_at := now();
    IF NEW.reviewed_at IS NULL THEN
      NEW.reviewed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Employer stamp trigger — read validity from settings
CREATE OR REPLACE FUNCTION public.trg_stamp_employer_verification_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days int;
BEGIN
  IF NEW.verification_status = 'verified'
     AND (TG_OP = 'INSERT' OR OLD.verification_status IS DISTINCT FROM NEW.verification_status) THEN
    v_days := public.get_setting_int('employer_verification_validity_days', 365);
    NEW.verified_at := COALESCE(NEW.verified_at, now());
    NEW.verification_expires_at := now() + make_interval(days => v_days);
    NEW.last_renewed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_stamp_vendor_verification_expiry() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_stamp_employer_verification_expiry() FROM PUBLIC;