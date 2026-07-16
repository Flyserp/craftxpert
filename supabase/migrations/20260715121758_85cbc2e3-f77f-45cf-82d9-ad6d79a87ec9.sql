CREATE OR REPLACE FUNCTION public.trg_sync_employer_profile_from_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act on status transitions
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' THEN
    -- Mirror approval to the employer profile (if the vendor is also an employer).
    -- Setting verification_status = 'verified' fires
    -- trg_stamp_employer_verification_expiry, which computes
    -- verified_at + verification_expires_at from platform settings.
    UPDATE public.employer_profiles
       SET verification_status = 'verified',
           updated_at = now()
     WHERE user_id = NEW.vendor_id
       AND verification_status IS DISTINCT FROM 'verified';

  ELSIF NEW.status = 'rejected' THEN
    UPDATE public.employer_profiles
       SET verification_status = 'rejected',
           updated_at = now()
     WHERE user_id = NEW.vendor_id
       AND verification_status IS DISTINCT FROM 'rejected';
  END IF;

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.trg_sync_employer_profile_from_verification() FROM PUBLIC;

DROP TRIGGER IF EXISTS sync_employer_profile_from_verification ON public.vendor_verifications;
CREATE TRIGGER sync_employer_profile_from_verification
  AFTER INSERT OR UPDATE OF status ON public.vendor_verifications
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_employer_profile_from_verification();