-- 1. Verification status enum
CREATE TYPE public.verification_status AS ENUM ('draft', 'pending', 'approved', 'rejected');

-- 2. vendor_verifications table
CREATE TABLE public.vendor_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL UNIQUE,
  status public.verification_status NOT NULL DEFAULT 'draft',
  business_name text,
  legal_name text,
  -- Document URLs (paths inside the verification-docs bucket)
  government_id_url text,
  business_registration_url text,
  proof_of_address_url text,
  insurance_url text,
  professional_license_url text,
  -- Submission & review metadata
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_note text,
  rejection_reasons text[] NOT NULL DEFAULT '{}',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vendor_verifications_status ON public.vendor_verifications(status);
CREATE INDEX idx_vendor_verifications_submitted_at ON public.vendor_verifications(submitted_at DESC);

ALTER TABLE public.vendor_verifications ENABLE ROW LEVEL SECURITY;

-- Vendor policies
CREATE POLICY "Vendors can view own verification"
  ON public.vendor_verifications FOR SELECT
  TO authenticated
  USING (vendor_id = auth.uid());

CREATE POLICY "Vendors can insert own verification"
  ON public.vendor_verifications FOR INSERT
  TO authenticated
  WITH CHECK (vendor_id = auth.uid() AND public.has_role(auth.uid(), 'provider'::public.app_role));

-- Vendors can update only while draft or rejected (resubmit). Locked once pending/approved.
CREATE POLICY "Vendors can update own draft or rejected"
  ON public.vendor_verifications FOR UPDATE
  TO authenticated
  USING (vendor_id = auth.uid() AND status IN ('draft', 'rejected'))
  WITH CHECK (vendor_id = auth.uid() AND status IN ('draft', 'pending'));

-- Admin policies
CREATE POLICY "Admins can view all verifications"
  ON public.vendor_verifications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update verifications"
  ON public.vendor_verifications FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Public policy: anyone can see approval status (for the "Verified" badge on profile cards)
CREATE POLICY "Approved status is public"
  ON public.vendor_verifications FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

-- 3. updated_at trigger
CREATE TRIGGER trg_vendor_verifications_updated_at
  BEFORE UPDATE ON public.vendor_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Notify vendor + audit log on status change
CREATE OR REPLACE FUNCTION public.notify_verification_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when status actually transitions to approved/rejected
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.vendor_id,
      'You''re verified!',
      'Your verification was approved. A "Verified" badge now appears on your profile.',
      'success',
      jsonb_build_object('verification_id', NEW.id, 'status', 'approved')
    );

    IF auth.uid() IS NOT NULL THEN
      INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
      VALUES (
        auth.uid(),
        'verification.approved',
        'vendor_verification',
        NEW.id::text,
        NEW.vendor_id,
        jsonb_build_object('business_name', NEW.business_name)
      );
    END IF;

  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.vendor_id,
      'Verification needs changes',
      COALESCE(NULLIF(NEW.rejection_note, ''), 'Please review the requested fixes and resubmit.'),
      'warning',
      jsonb_build_object(
        'verification_id', NEW.id,
        'status', 'rejected',
        'rejection_reasons', NEW.rejection_reasons
      )
    );

    IF auth.uid() IS NOT NULL THEN
      INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
      VALUES (
        auth.uid(),
        'verification.rejected',
        'vendor_verification',
        NEW.id::text,
        NEW.vendor_id,
        jsonb_build_object(
          'rejection_note', NEW.rejection_note,
          'rejection_reasons', NEW.rejection_reasons
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vendor_verifications_notify
  AFTER INSERT OR UPDATE OF status ON public.vendor_verifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_verification_status_change();

-- 5. Storage bucket for documents (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-docs', 'verification-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Vendors can manage their own files (folder = their user id)
CREATE POLICY "Vendors upload own verification docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'verification-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Vendors view own verification docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'verification-docs'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

CREATE POLICY "Vendors delete own verification docs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'verification-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
