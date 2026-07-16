
-- Helper: notify all admins
CREATE OR REPLACE FUNCTION public.notify_admins(_title text, _message text, _type text, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin'::public.app_role LOOP
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (r.user_id, _title, _message, _type, COALESCE(_metadata, '{}'::jsonb));
  END LOOP;
END;
$$;

-- 1) New registration
CREATE OR REPLACE FUNCTION public.admin_notify_new_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_admins(
    'New registration',
    COALESCE(NEW.display_name, 'A new user') || ' just signed up.',
    'info',
    jsonb_build_object('event', 'user.registered', 'user_id', NEW.user_id)
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_admin_notify_new_registration ON public.profiles;
CREATE TRIGGER trg_admin_notify_new_registration
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.admin_notify_new_registration();

-- 2) New job post
CREATE OR REPLACE FUNCTION public.admin_notify_new_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_admins(
    'New job posted',
    'Job "' || COALESCE(NEW.title, 'Untitled') || '" was posted.',
    'info',
    jsonb_build_object('event', 'job.created', 'task_id', NEW.id, 'customer_id', NEW.customer_id)
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_admin_notify_new_job ON public.tasks;
CREATE TRIGGER trg_admin_notify_new_job
AFTER INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.admin_notify_new_job();

-- 3) Verification requests
CREATE OR REPLACE FUNCTION public.admin_notify_verification_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND COALESCE(OLD.status,'') <> NEW.status AND NEW.status = 'pending') THEN
    PERFORM public.notify_admins(
      'Verification request',
      'A provider submitted a verification request' ||
        CASE WHEN NEW.business_name IS NOT NULL THEN ' for ' || NEW.business_name ELSE '' END || '.',
      'warning',
      jsonb_build_object('event', 'verification.submitted', 'verification_id', NEW.id, 'vendor_id', NEW.vendor_id)
    );
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_admin_notify_verification_request ON public.vendor_verifications;
CREATE TRIGGER trg_admin_notify_verification_request
AFTER INSERT OR UPDATE ON public.vendor_verifications
FOR EACH ROW EXECUTE FUNCTION public.admin_notify_verification_request();

-- 4) New subscription
CREATE OR REPLACE FUNCTION public.admin_notify_new_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND COALESCE(OLD.status,'') <> NEW.status AND NEW.status = 'active') THEN
    PERFORM public.notify_admins(
      'New subscription',
      'A provider activated a subscription.',
      'success',
      jsonb_build_object('event', 'subscription.activated', 'subscription_id', NEW.id, 'provider_id', NEW.provider_id)
    );
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_admin_notify_new_subscription ON public.provider_subscriptions;
CREATE TRIGGER trg_admin_notify_new_subscription
AFTER INSERT OR UPDATE ON public.provider_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.admin_notify_new_subscription();

-- 5) Sponsored service purchase
CREATE OR REPLACE FUNCTION public.admin_notify_sponsorship()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_admins(
    'Sponsorship purchased',
    'A provider sponsored a service for ' || NEW.days || ' days ($' || to_char(NEW.amount,'FM999990.00') || ').',
    'success',
    jsonb_build_object('event', 'sponsorship.purchased', 'order_id', NEW.id, 'vendor_id', NEW.vendor_id, 'service_id', NEW.service_id)
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_admin_notify_sponsorship ON public.sponsorship_orders;
CREATE TRIGGER trg_admin_notify_sponsorship
AFTER INSERT ON public.sponsorship_orders
FOR EACH ROW EXECUTE FUNCTION public.admin_notify_sponsorship();

-- 6) Reported content
CREATE OR REPLACE FUNCTION public.admin_notify_content_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_admins(
    'Content reported',
    'A new content report was submitted for review.',
    'warning',
    jsonb_build_object('event', 'content.reported', 'report_id', NEW.id)
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_admin_notify_content_report ON public.content_reports;
CREATE TRIGGER trg_admin_notify_content_report
AFTER INSERT ON public.content_reports
FOR EACH ROW EXECUTE FUNCTION public.admin_notify_content_report();

-- 7) Disputes
CREATE OR REPLACE FUNCTION public.admin_notify_dispute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_admins(
    'New dispute opened',
    'Dispute: ' || COALESCE(NEW.subject, 'No subject'),
    'error',
    jsonb_build_object('event', 'dispute.opened', 'dispute_id', NEW.id, 'priority', NEW.priority)
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_admin_notify_dispute ON public.disputes;
CREATE TRIGGER trg_admin_notify_dispute
AFTER INSERT ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.admin_notify_dispute();
