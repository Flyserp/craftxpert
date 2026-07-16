CREATE OR REPLACE FUNCTION public.admin_notify_new_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'active'::subscription_status) THEN
    PERFORM public.notify_admins(
      'New subscription',
      'A provider activated a subscription.',
      'success',
      jsonb_build_object('event', 'subscription.activated', 'subscription_id', NEW.id, 'provider_id', NEW.provider_id)
    );
  END IF;
  RETURN NEW;
END $function$;