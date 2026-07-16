
ALTER TABLE public.vendor_verifications
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_renewed_at timestamptz;

CREATE OR REPLACE FUNCTION public.notify_verification_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' THEN
    -- Set / extend a 1-year expiry on approval if not already set in the future.
    IF NEW.expires_at IS NULL OR NEW.expires_at < now() THEN
      NEW.expires_at := now() + interval '1 year';
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.vendor_id,
      'You''re verified!',
      'Your verification was approved. A "Verified" badge now appears on your profile.',
      'success',
      jsonb_build_object('verification_id', NEW.id, 'status', 'approved', 'expires_at', NEW.expires_at)
    );

    IF auth.uid() IS NOT NULL THEN
      INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
      VALUES (
        auth.uid(),
        'verification.approved',
        'vendor_verification',
        NEW.id::text,
        NEW.vendor_id,
        jsonb_build_object('business_name', NEW.business_name, 'expires_at', NEW.expires_at)
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
$function$;

-- Ensure trigger fires BEFORE update so the expires_at write persists.
DROP TRIGGER IF EXISTS trg_notify_verification_status_change ON public.vendor_verifications;
CREATE TRIGGER trg_notify_verification_status_change
  BEFORE INSERT OR UPDATE ON public.vendor_verifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_verification_status_change();
