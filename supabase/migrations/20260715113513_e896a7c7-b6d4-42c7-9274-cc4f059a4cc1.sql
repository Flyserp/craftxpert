
-- Allow employers to submit KYC through the same vendor_verifications pipeline
-- used by providers. Admin review flow, SLA escalation, and audit logs already
-- work on this table, so this keeps the moderation surface unified.

DROP POLICY IF EXISTS "Vendors can insert own verification" ON public.vendor_verifications;
CREATE POLICY "Users can insert own verification"
  ON public.vendor_verifications
  FOR INSERT
  WITH CHECK (
    vendor_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'provider'::public.app_role)
      OR public.has_role(auth.uid(), 'employer'::public.app_role)
    )
  );

-- Keep employer_profiles.verification_status in sync with vendor_verifications.
-- Only writes when the submitter is actually an employer, so provider flows
-- (which have no employer_profiles row) are untouched.
CREATE OR REPLACE FUNCTION public.sync_employer_verification_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_employer boolean;
  v_target text;
BEGIN
  SELECT public.has_role(NEW.vendor_id, 'employer'::public.app_role) INTO v_is_employer;
  IF NOT v_is_employer THEN
    RETURN NEW;
  END IF;

  v_target := CASE NEW.status::text
    WHEN 'approved'        THEN 'verified'
    WHEN 'pending'         THEN 'pending'
    WHEN 'info_requested'  THEN 'pending'
    WHEN 'rejected'        THEN 'rejected'
    ELSE 'unverified'
  END;

  INSERT INTO public.employer_profiles (user_id, verification_status)
  VALUES (NEW.vendor_id, v_target)
  ON CONFLICT (user_id) DO UPDATE
    SET verification_status = EXCLUDED.verification_status,
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_employer_verification ON public.vendor_verifications;
CREATE TRIGGER trg_sync_employer_verification
AFTER INSERT OR UPDATE OF status ON public.vendor_verifications
FOR EACH ROW
EXECUTE FUNCTION public.sync_employer_verification_status();
