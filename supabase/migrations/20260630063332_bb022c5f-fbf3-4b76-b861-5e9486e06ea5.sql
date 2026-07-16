
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.expire_overdue_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  applicant_id uuid;
  expired_count integer := 0;
BEGIN
  FOR r IN
    SELECT id, title, customer_id
      FROM public.tasks
     WHERE status IN ('published', 'open', 'applied', 'shortlisted')
       AND preferred_date IS NOT NULL
       AND preferred_date < CURRENT_DATE
  LOOP
    UPDATE public.tasks SET status = 'expired', updated_at = now() WHERE id = r.id;
    expired_count := expired_count + 1;

    -- Notify employer
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      r.customer_id,
      'Job expired',
      'Your job "' || r.title || '" has passed its deadline. Renew it to keep accepting applications.',
      'warning',
      jsonb_build_object('task_id', r.id, 'event', 'job.expired')
    );

    -- Notify each applicant
    FOR applicant_id IN
      SELECT DISTINCT provider_id FROM public.task_proposals WHERE task_id = r.id
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, metadata)
      VALUES (
        applicant_id,
        'Job expired',
        'The job "' || r.title || '" you applied to has expired.',
        'info',
        jsonb_build_object('task_id', r.id, 'event', 'job.expired')
      );
    END LOOP;

    INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
    VALUES (r.customer_id, 'job.expired', 'task', r.id::text, r.customer_id,
            jsonb_build_object('title', r.title));
  END LOOP;

  RETURN expired_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_overdue_tasks() TO service_role, authenticated;

-- Renewal helper: extend deadline and republish
CREATE OR REPLACE FUNCTION public.renew_task(_task_id uuid, _new_deadline date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.tasks%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.tasks WHERE id = _task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found'; END IF;
  IF t.customer_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _new_deadline <= CURRENT_DATE THEN
    RAISE EXCEPTION 'New deadline must be in the future';
  END IF;

  UPDATE public.tasks
     SET status = 'published',
         preferred_date = _new_deadline,
         updated_at = now()
   WHERE id = _task_id;

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (t.customer_id, 'Job renewed',
          'Your job "' || t.title || '" is live again until ' || to_char(_new_deadline, 'YYYY-MM-DD') || '.',
          'success',
          jsonb_build_object('task_id', _task_id, 'event', 'job.renewed'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.renew_task(uuid, date) TO authenticated;

-- Schedule hourly expiration
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-overdue-tasks-hourly') THEN
    PERFORM cron.unschedule('expire-overdue-tasks-hourly');
  END IF;
  PERFORM cron.schedule(
    'expire-overdue-tasks-hourly',
    '0 * * * *',
    $cron$ SELECT public.expire_overdue_tasks(); $cron$
  );
END $$;
