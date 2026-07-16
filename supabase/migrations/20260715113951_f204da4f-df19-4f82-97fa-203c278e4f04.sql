-- 1) Split the fee setting
INSERT INTO public.platform_settings (key, value)
VALUES
  ('vendor_verification_fee', '10'::jsonb),
  ('employer_verification_fee', '10'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2) Employer verification expiry fields
ALTER TABLE public.employer_profiles
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_renewed_at timestamptz;

-- 3) Expiry sweep function
CREATE OR REPLACE FUNCTION public.expire_stale_verifications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vendor_count int := 0;
  employer_count int := 0;
BEGIN
  WITH updated AS (
    UPDATE public.vendor_verifications
    SET status = 'expired', updated_at = now()
    WHERE status = 'approved'
      AND expires_at IS NOT NULL
      AND expires_at < now()
    RETURNING id
  )
  SELECT count(*) INTO vendor_count FROM updated;

  WITH updated AS (
    UPDATE public.employer_profiles
    SET verification_status = 'expired', updated_at = now()
    WHERE verification_status = 'verified'
      AND verification_expires_at IS NOT NULL
      AND verification_expires_at < now()
    RETURNING id
  )
  SELECT count(*) INTO employer_count FROM updated;

  RETURN jsonb_build_object('vendors_expired', vendor_count, 'employers_expired', employer_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_verifications() TO service_role;