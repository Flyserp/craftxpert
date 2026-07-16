
-- Audit triggers: payment events, profile/user updates, job status changes, login events

-- Payment events (insert + status change)
CREATE OR REPLACE FUNCTION public.log_payment_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
    VALUES (
      COALESCE(auth.uid(), NEW.user_id),
      'payment.created',
      'payment_transaction',
      NEW.id::text,
      NEW.user_id,
      jsonb_build_object(
        'amount', NEW.amount,
        'method', NEW.payment_method,
        'type', NEW.payment_type,
        'status', NEW.status,
        'vendor_id', NEW.vendor_id,
        'booking_id', NEW.booking_id
      )
    );
  ELSIF TG_OP = 'UPDATE' AND COALESCE(OLD.status,'') <> COALESCE(NEW.status,'') THEN
    INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
    VALUES (
      COALESCE(auth.uid(), NEW.user_id),
      'payment.' || NEW.status,
      'payment_transaction',
      NEW.id::text,
      NEW.user_id,
      jsonb_build_object(
        'amount', NEW.amount,
        'method', NEW.payment_method,
        'type', NEW.payment_type,
        'previous_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_payment_event ON public.payment_transactions;
CREATE TRIGGER trg_log_payment_event
AFTER INSERT OR UPDATE ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.log_payment_event();

-- Profile updates (key fields only, skip noise)
CREATE OR REPLACE FUNCTION public.log_profile_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  changed jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF COALESCE(OLD.display_name,'') <> COALESCE(NEW.display_name,'') THEN
    changed := changed || jsonb_build_object('display_name', jsonb_build_object('old', OLD.display_name, 'new', NEW.display_name));
  END IF;
  IF COALESCE(OLD.phone,'') <> COALESCE(NEW.phone,'') THEN
    changed := changed || jsonb_build_object('phone', jsonb_build_object('old', OLD.phone, 'new', NEW.phone));
  END IF;
  IF COALESCE(OLD.address,'') <> COALESCE(NEW.address,'') THEN
    changed := changed || jsonb_build_object('address', jsonb_build_object('old', OLD.address, 'new', NEW.address));
  END IF;
  IF COALESCE(OLD.business_name,'') <> COALESCE(NEW.business_name,'') THEN
    changed := changed || jsonb_build_object('business_name', jsonb_build_object('old', OLD.business_name, 'new', NEW.business_name));
  END IF;
  IF COALESCE(OLD.status,'') <> COALESCE(NEW.status,'') THEN
    changed := changed || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
  END IF;
  IF changed = '{}'::jsonb THEN RETURN NEW; END IF;

  INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
  VALUES (
    COALESCE(auth.uid(), NEW.user_id),
    CASE WHEN auth.uid() IS NOT NULL AND auth.uid() <> NEW.user_id
         THEN 'user.updated_by_admin' ELSE 'user.updated' END,
    'profile',
    NEW.user_id::text,
    NEW.user_id,
    jsonb_build_object('changes', changed)
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_profile_update ON public.profiles;
CREATE TRIGGER trg_log_profile_update
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_profile_update();

-- Job (task) status changes
CREATE OR REPLACE FUNCTION public.log_task_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
    VALUES (
      COALESCE(auth.uid(), NEW.customer_id),
      'job.created',
      'task',
      NEW.id::text,
      NEW.customer_id,
      jsonb_build_object('title', NEW.title, 'status', NEW.status, 'budget_max', NEW.budget_max)
    );
  ELSIF TG_OP = 'UPDATE' AND COALESCE(OLD.status,'') <> COALESCE(NEW.status,'') THEN
    INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
    VALUES (
      COALESCE(auth.uid(), NEW.customer_id),
      'job.status_changed',
      'task',
      NEW.id::text,
      NEW.customer_id,
      jsonb_build_object('title', NEW.title, 'previous_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_task_status_change ON public.tasks;
CREATE TRIGGER trg_log_task_status_change
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.log_task_status_change();

-- Login events: callable from client after successful sign-in
CREATE OR REPLACE FUNCTION public.log_login_event(_user_agent text DEFAULT NULL, _provider text DEFAULT 'password')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
  VALUES (
    auth.uid(),
    'auth.login',
    'session',
    NULL,
    auth.uid(),
    jsonb_build_object('user_agent', _user_agent, 'provider', _provider, 'occurred_at', now())
  );
END $$;

GRANT EXECUTE ON FUNCTION public.log_login_event(text, text) TO authenticated;
