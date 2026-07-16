
CREATE OR REPLACE FUNCTION public.log_task_proposal_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
    VALUES (
      COALESCE(auth.uid(), NEW.vendor_id),
      'job.applied',
      'task_proposal',
      NEW.id::text,
      NEW.vendor_id,
      jsonb_build_object('task_id', NEW.task_id, 'amount', NEW.quoted_price, 'status', NEW.status)
    );
  ELSIF TG_OP = 'UPDATE' AND COALESCE(OLD.status,'') <> COALESCE(NEW.status,'') THEN
    INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
    VALUES (
      COALESCE(auth.uid(), NEW.vendor_id),
      'job.application_' || NEW.status,
      'task_proposal',
      NEW.id::text,
      NEW.vendor_id,
      jsonb_build_object('task_id', NEW.task_id, 'previous_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END $function$;
