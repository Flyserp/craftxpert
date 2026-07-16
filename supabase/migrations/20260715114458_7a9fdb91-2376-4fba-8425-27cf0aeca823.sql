-- Vendor: stamp 1-year expiry on approval
CREATE OR REPLACE FUNCTION public.trg_stamp_vendor_verification_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.expires_at := now() + interval '1 year';
    NEW.last_renewed_at := now();
    IF NEW.reviewed_at IS NULL THEN
      NEW.reviewed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_vendor_verification_expiry ON public.vendor_verifications;
CREATE TRIGGER stamp_vendor_verification_expiry
BEFORE INSERT OR UPDATE ON public.vendor_verifications
FOR EACH ROW EXECUTE FUNCTION public.trg_stamp_vendor_verification_expiry();

-- Employer: stamp 1-year expiry when verification_status flips to 'verified'
CREATE OR REPLACE FUNCTION public.trg_stamp_employer_verification_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verification_status = 'verified'
     AND (TG_OP = 'INSERT' OR OLD.verification_status IS DISTINCT FROM NEW.verification_status) THEN
    NEW.verified_at := COALESCE(NEW.verified_at, now());
    NEW.verification_expires_at := now() + interval '1 year';
    NEW.last_renewed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_employer_verification_expiry ON public.employer_profiles;
CREATE TRIGGER stamp_employer_verification_expiry
BEFORE INSERT OR UPDATE ON public.employer_profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_stamp_employer_verification_expiry();

-- Backfill: stamp expiry on already-approved rows that have none
UPDATE public.vendor_verifications
   SET expires_at = COALESCE(reviewed_at, updated_at, created_at) + interval '1 year',
       last_renewed_at = COALESCE(last_renewed_at, reviewed_at, updated_at, created_at)
 WHERE status = 'approved' AND expires_at IS NULL;

UPDATE public.employer_profiles
   SET verified_at = COALESCE(verified_at, updated_at, created_at),
       verification_expires_at = COALESCE(verified_at, updated_at, created_at) + interval '1 year',
       last_renewed_at = COALESCE(last_renewed_at, updated_at, created_at)
 WHERE verification_status = 'verified' AND verification_expires_at IS NULL;

-- Lock down SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.trg_stamp_vendor_verification_expiry() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_stamp_employer_verification_expiry() FROM PUBLIC;