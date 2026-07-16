
-- Allow users to read their own activity
CREATE POLICY "Users can view their own activity"
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid() OR target_user_id = auth.uid());

-- Job applications
CREATE OR REPLACE FUNCTION public.log_task_proposal_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
    VALUES (
      COALESCE(auth.uid(), NEW.provider_id),
      'job.applied',
      'task_proposal',
      NEW.id::text,
      NEW.provider_id,
      jsonb_build_object('task_id', NEW.task_id, 'amount', NEW.amount, 'status', NEW.status)
    );
  ELSIF TG_OP = 'UPDATE' AND COALESCE(OLD.status,'') <> COALESCE(NEW.status,'') THEN
    INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
    VALUES (
      COALESCE(auth.uid(), NEW.provider_id),
      'job.application_' || NEW.status,
      'task_proposal',
      NEW.id::text,
      NEW.provider_id,
      jsonb_build_object('task_id', NEW.task_id, 'previous_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_task_proposal ON public.task_proposals;
CREATE TRIGGER trg_log_task_proposal
AFTER INSERT OR UPDATE ON public.task_proposals
FOR EACH ROW EXECUTE FUNCTION public.log_task_proposal_event();

-- Bookings
CREATE OR REPLACE FUNCTION public.log_booking_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
    VALUES (
      COALESCE(auth.uid(), NEW.customer_id),
      'booking.created',
      'booking',
      NEW.id::text,
      NEW.customer_id,
      jsonb_build_object('vendor_id', NEW.vendor_id, 'status', NEW.status)
    );
  ELSIF TG_OP = 'UPDATE' AND COALESCE(OLD.status,'') <> COALESCE(NEW.status,'') THEN
    INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
    VALUES (
      COALESCE(auth.uid(), NEW.customer_id),
      'booking.' || NEW.status,
      'booking',
      NEW.id::text,
      NEW.customer_id,
      jsonb_build_object('vendor_id', NEW.vendor_id, 'previous_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_booking ON public.bookings;
CREATE TRIGGER trg_log_booking
AFTER INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.log_booking_event();

-- Verification submissions
CREATE OR REPLACE FUNCTION public.log_verification_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
  VALUES (
    COALESCE(auth.uid(), NEW.vendor_id),
    'verification.submitted',
    'vendor_verification',
    NEW.id::text,
    NEW.vendor_id,
    jsonb_build_object('business_name', NEW.business_name, 'status', NEW.status)
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_verification_submission ON public.vendor_verifications;
CREATE TRIGGER trg_log_verification_submission
AFTER INSERT ON public.vendor_verifications
FOR EACH ROW EXECUTE FUNCTION public.log_verification_submission();
