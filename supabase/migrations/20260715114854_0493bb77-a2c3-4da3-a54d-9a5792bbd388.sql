-- Track every verification status transition (submit, admin decision, resubmit)
CREATE TABLE public.verification_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  verification_id UUID NOT NULL REFERENCES public.vendor_verifications(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL,
  from_status public.verification_status,
  to_status public.verification_status NOT NULL,
  event TEXT NOT NULL,
  note TEXT,
  reasons TEXT[],
  actor_id UUID,
  actor_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.verification_status_history TO authenticated;
GRANT ALL ON public.verification_status_history TO service_role;

ALTER TABLE public.verification_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors view own history"
  ON public.verification_status_history FOR SELECT
  TO authenticated
  USING (auth.uid() = vendor_id);

CREATE POLICY "Admins view all history"
  ON public.verification_status_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE INDEX idx_vsh_verification ON public.verification_status_history(verification_id, created_at DESC);

-- Trigger: log any status change + first submission/resubmission
CREATE OR REPLACE FUNCTION public.log_verification_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event TEXT;
  v_actor UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.verification_status_history(
      verification_id, vendor_id, from_status, to_status, event, actor_id, actor_role
    ) VALUES (
      NEW.id, NEW.vendor_id, NULL, NEW.status, 'created', v_actor, 'vendor'
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'pending' AND OLD.status IN ('rejected','info_requested') THEN
      v_event := 'resubmitted';
      v_role := 'vendor';
    ELSIF NEW.status = 'pending' AND OLD.status = 'draft' THEN
      v_event := 'submitted';
      v_role := 'vendor';
    ELSIF NEW.status = 'approved' THEN
      v_event := 'approved';
      v_role := 'admin';
    ELSIF NEW.status = 'rejected' THEN
      v_event := 'rejected';
      v_role := 'admin';
    ELSIF NEW.status = 'info_requested' THEN
      v_event := 'info_requested';
      v_role := 'admin';
    ELSIF NEW.status = 'expired' THEN
      v_event := 'expired';
      v_role := 'system';
    ELSE
      v_event := 'status_change';
      v_role := 'system';
    END IF;

    INSERT INTO public.verification_status_history(
      verification_id, vendor_id, from_status, to_status, event, note, reasons, actor_id, actor_role
    ) VALUES (
      NEW.id, NEW.vendor_id, OLD.status, NEW.status, v_event,
      COALESCE(NEW.rejection_note, NEW.info_request_note),
      NEW.rejection_reasons,
      v_actor, v_role
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_verification_status ON public.vendor_verifications;
CREATE TRIGGER trg_log_verification_status
AFTER INSERT OR UPDATE OF status ON public.vendor_verifications
FOR EACH ROW EXECUTE FUNCTION public.log_verification_status_change();

-- Backfill: seed one history row per existing verification so timelines aren't empty
INSERT INTO public.verification_status_history(
  verification_id, vendor_id, from_status, to_status, event, note, reasons, actor_role, created_at
)
SELECT id, vendor_id, NULL, status,
  CASE status
    WHEN 'approved' THEN 'approved'
    WHEN 'rejected' THEN 'rejected'
    WHEN 'info_requested' THEN 'info_requested'
    WHEN 'pending' THEN 'submitted'
    ELSE 'created'
  END,
  COALESCE(rejection_note, info_request_note),
  rejection_reasons,
  'system',
  COALESCE(reviewed_at, submitted_at, created_at)
FROM public.vendor_verifications v
WHERE NOT EXISTS (
  SELECT 1 FROM public.verification_status_history h WHERE h.verification_id = v.id
);