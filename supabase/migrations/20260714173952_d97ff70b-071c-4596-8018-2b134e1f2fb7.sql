
-- 1. Track when we've already notified about expiry so cron doesn't spam
ALTER TABLE public.moderation_assignments
  ADD COLUMN IF NOT EXISTS expiry_notified_at timestamptz;

-- 2. Reset expiry_notified_at whenever the claim is (re)placed
CREATE OR REPLACE FUNCTION public.claim_moderation_case(_kind text, _entity_id uuid, _ttl_minutes integer DEFAULT 30)
RETURNS public.moderation_assignments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.moderation_assignments;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only moderators can claim cases';
  END IF;
  IF _ttl_minutes IS NULL OR _ttl_minutes < 1 THEN _ttl_minutes := 30; END IF;

  SELECT * INTO v_row FROM public.moderation_assignments
    WHERE kind = _kind AND entity_id = _entity_id FOR UPDATE;

  IF FOUND THEN
    IF v_row.status = 'claimed' AND v_row.assigned_to <> v_uid AND v_row.expires_at > now() THEN
      RAISE EXCEPTION 'Case is already claimed by another moderator until %', v_row.expires_at;
    END IF;
    UPDATE public.moderation_assignments
       SET assigned_to = v_uid, status = 'claimed', claimed_at = now(),
           expires_at = now() + make_interval(mins => _ttl_minutes),
           expiry_notified_at = NULL, updated_at = now()
     WHERE id = v_row.id RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.moderation_assignments (kind, entity_id, assigned_to, expires_at)
    VALUES (_kind, _entity_id, v_uid, now() + make_interval(mins => _ttl_minutes))
    RETURNING * INTO v_row;
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'moderation.claimed', 'moderation_assignment', v_row.id::text,
          jsonb_build_object('kind', _kind, 'entity_id', _entity_id));

  RETURN v_row;
END $$;

-- 3. Take-over: notify previous owner
CREATE OR REPLACE FUNCTION public.takeover_moderation_case(_kind text, _entity_id uuid, _ttl_minutes integer DEFAULT 30, _reason text DEFAULT NULL)
RETURNS public.moderation_assignments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.moderation_assignments;
  v_uid uuid := auth.uid();
  v_prev_user uuid;
  v_prev_status text;
  v_actor_name text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only moderators can take over cases';
  END IF;

  SELECT * INTO v_row FROM public.moderation_assignments
    WHERE kind = _kind AND entity_id = _entity_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN public.claim_moderation_case(_kind, _entity_id, _ttl_minutes);
  END IF;

  v_prev_user := v_row.assigned_to;
  v_prev_status := v_row.status;

  UPDATE public.moderation_assignments
     SET assigned_to = v_uid, status = 'claimed', claimed_at = now(),
         expires_at = now() + make_interval(mins => COALESCE(_ttl_minutes,30)),
         expiry_notified_at = NULL, updated_at = now()
   WHERE id = v_row.id RETURNING * INTO v_row;

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
  VALUES (v_uid, 'moderation.taken_over', 'moderation_assignment', v_row.id::text, v_prev_user,
          jsonb_build_object('kind', _kind, 'target_entity_id', _entity_id, 'reason', _reason));

  IF v_prev_user IS NOT NULL AND v_prev_user <> v_uid AND v_prev_status = 'claimed' THEN
    SELECT COALESCE(display_name, 'Another moderator') INTO v_actor_name
      FROM public.profiles WHERE user_id = v_uid LIMIT 1;

    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      v_prev_user, 'moderation_taken_over',
      'Your case was taken over',
      COALESCE(v_actor_name, 'A moderator') || ' took over the ' || _kind || ' you were reviewing'
        || CASE WHEN _reason IS NOT NULL AND length(_reason) > 0 THEN '. Reason: ' || _reason ELSE '' END,
      jsonb_build_object('kind', _kind, 'entity_id', _entity_id, 'by', v_uid, 'reason', _reason)
    );
  END IF;

  RETURN v_row;
END $$;

-- 4. Assign a case to another moderator (with notification)
CREATE OR REPLACE FUNCTION public.assign_moderation_case(_kind text, _entity_id uuid, _assignee uuid, _ttl_minutes integer DEFAULT 30, _note text DEFAULT NULL)
RETURNS public.moderation_assignments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.moderation_assignments;
  v_uid uuid := auth.uid();
  v_actor_name text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only moderators can assign cases';
  END IF;
  IF NOT public.has_role(_assignee, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Assignee must be a moderator';
  END IF;
  IF _kind NOT IN ('verification','report','dispute','refund') THEN
    RAISE EXCEPTION 'Invalid kind: %', _kind;
  END IF;
  IF _ttl_minutes IS NULL OR _ttl_minutes < 1 THEN _ttl_minutes := 30; END IF;

  SELECT * INTO v_row FROM public.moderation_assignments
    WHERE kind = _kind AND entity_id = _entity_id FOR UPDATE;

  IF FOUND THEN
    UPDATE public.moderation_assignments
       SET assigned_to = _assignee, status = 'claimed', claimed_at = now(),
           expires_at = now() + make_interval(mins => _ttl_minutes),
           expiry_notified_at = NULL, notes = COALESCE(_note, notes), updated_at = now()
     WHERE id = v_row.id RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.moderation_assignments (kind, entity_id, assigned_to, expires_at, notes)
    VALUES (_kind, _entity_id, _assignee, now() + make_interval(mins => _ttl_minutes), _note)
    RETURNING * INTO v_row;
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
  VALUES (v_uid, 'moderation.assigned', 'moderation_assignment', v_row.id::text, _assignee,
          jsonb_build_object('kind', _kind, 'entity_id', _entity_id, 'note', _note));

  IF _assignee <> v_uid THEN
    SELECT COALESCE(display_name, 'A moderator') INTO v_actor_name
      FROM public.profiles WHERE user_id = v_uid LIMIT 1;

    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      _assignee, 'moderation_assigned',
      'New moderation case assigned',
      COALESCE(v_actor_name, 'A moderator') || ' assigned you a ' || _kind || ' to review'
        || CASE WHEN _note IS NOT NULL AND length(_note) > 0 THEN ': ' || _note ELSE '' END,
      jsonb_build_object('kind', _kind, 'entity_id', _entity_id, 'by', v_uid, 'note', _note, 'expires_at', v_row.expires_at)
    );
  END IF;

  RETURN v_row;
END $$;

-- 5. Notify on expired claims (scheduled)
CREATE OR REPLACE FUNCTION public.notify_expired_moderation_claims()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT id, kind, entity_id, assigned_to, expires_at
      FROM public.moderation_assignments
     WHERE status = 'claimed'
       AND expires_at < now()
       AND expiry_notified_at IS NULL
     LIMIT 500
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      r.assigned_to, 'moderation_claim_expired',
      'Your moderation claim expired',
      'Your lock on a ' || r.kind || ' expired. Reclaim it or another moderator may take it over.',
      jsonb_build_object('kind', r.kind, 'entity_id', r.entity_id, 'expired_at', r.expires_at)
    );

    INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
    VALUES (NULL, 'moderation.claim_expired', 'moderation_assignment', r.id::text, r.assigned_to,
            jsonb_build_object('kind', r.kind, 'entity_id', r.entity_id, 'expired_at', r.expires_at));

    UPDATE public.moderation_assignments
       SET expiry_notified_at = now(), status = 'released', updated_at = now()
     WHERE id = r.id;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.assign_moderation_case(text, uuid, uuid, integer, text) FROM public;
GRANT EXECUTE ON FUNCTION public.assign_moderation_case(text, uuid, uuid, integer, text) TO authenticated;
REVOKE ALL ON FUNCTION public.notify_expired_moderation_claims() FROM public;
GRANT EXECUTE ON FUNCTION public.notify_expired_moderation_claims() TO service_role;

-- 6. Cron: run expiry notifier every 5 minutes
DO $$
BEGIN
  PERFORM cron.unschedule('moderation-notify-expired-claims');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'moderation-notify-expired-claims',
  '*/5 * * * *',
  $cron$ SELECT public.notify_expired_moderation_claims(); $cron$
);
