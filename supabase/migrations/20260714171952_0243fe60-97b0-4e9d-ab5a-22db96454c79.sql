
CREATE OR REPLACE FUNCTION public.cancel_job(_task_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_task public.tasks%ROWTYPE;
  v_prop public.task_proposals%ROWTYPE;
  v_role text;
  v_accepted_provider uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;

  IF v_task.status IN ('cancelled','completed') THEN
    RAISE EXCEPTION 'Job is already %', v_task.status;
  END IF;

  -- Determine actor role
  IF v_task.customer_id = v_uid THEN
    v_role := 'customer';
  ELSE
    SELECT * INTO v_prop
      FROM public.task_proposals
     WHERE task_id = _task_id AND vendor_id = v_uid AND status = 'accepted'
     LIMIT 1;
    IF FOUND THEN
      v_role := 'provider';
    ELSIF public.has_role(v_uid, 'admin'::public.app_role) THEN
      v_role := 'admin';
    ELSE
      RAISE EXCEPTION 'Not authorized to cancel this job';
    END IF;
  END IF;

  -- Look up the accepted provider (if any) for notifications
  SELECT vendor_id INTO v_accepted_provider
    FROM public.task_proposals
   WHERE task_id = _task_id AND status = 'accepted'
   LIMIT 1;

  IF v_role IN ('customer','admin') THEN
    UPDATE public.tasks
       SET status = 'cancelled', updated_at = now()
     WHERE id = _task_id;

    -- Withdraw any outstanding proposals so providers see the state change
    UPDATE public.task_proposals
       SET status = 'withdrawn',
           responded_at = COALESCE(responded_at, now()),
           updated_at = now()
     WHERE task_id = _task_id AND status IN ('pending','shortlisted','accepted');

    IF v_accepted_provider IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, metadata)
      VALUES (
        v_accepted_provider,
        'Job cancelled by customer',
        'The job "' || v_task.title || '" has been cancelled.' ||
          CASE WHEN _reason IS NOT NULL AND length(btrim(_reason)) > 0
               THEN ' Reason: ' || _reason ELSE '' END,
        'warning',
        jsonb_build_object('task_id', _task_id, 'event','job.cancelled','by','customer','reason',_reason)
      );
    END IF;

  ELSE
    -- Provider backing out: revert job to published pool, withdraw their proposal
    UPDATE public.task_proposals
       SET status = 'withdrawn',
           responded_at = now(),
           updated_at = now()
     WHERE id = v_prop.id;

    UPDATE public.tasks
       SET status = 'published', updated_at = now()
     WHERE id = _task_id;

    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      v_task.customer_id,
      'Provider cancelled your job',
      'The accepted provider withdrew from "' || v_task.title || '". Your job is open again for new applications.' ||
        CASE WHEN _reason IS NOT NULL AND length(btrim(_reason)) > 0
             THEN ' Reason: ' || _reason ELSE '' END,
      'warning',
      jsonb_build_object('task_id', _task_id, 'event','job.cancelled','by','provider','reason',_reason)
    );
  END IF;

  INSERT INTO public.admin_audit_log
    (actor_id, action, entity_type, entity_id, target_user_id, details)
  VALUES (
    v_uid,
    'job.cancelled.' || v_role,
    'task',
    _task_id::text,
    v_task.customer_id,
    jsonb_build_object(
      'title', v_task.title,
      'previous_status', v_task.status,
      'by', v_role,
      'reason', _reason,
      'accepted_provider', v_accepted_provider
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'task_id', _task_id,
    'cancelled_by', v_role,
    'new_status', CASE WHEN v_role IN ('customer','admin') THEN 'cancelled' ELSE 'published' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_job(uuid, text) TO authenticated;
