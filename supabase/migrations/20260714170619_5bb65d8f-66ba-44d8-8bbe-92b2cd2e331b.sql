
CREATE TABLE IF NOT EXISTS public.moderation_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('verification','report','dispute','refund')),
  entity_id uuid NOT NULL,
  assigned_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  status text NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed','released','completed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, entity_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.moderation_assignments TO authenticated;
GRANT ALL ON public.moderation_assignments TO service_role;

ALTER TABLE public.moderation_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view assignments"
  ON public.moderation_assignments FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage assignments"
  ON public.moderation_assignments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER moderation_assignments_updated_at
BEFORE UPDATE ON public.moderation_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS moderation_assignments_lookup
  ON public.moderation_assignments (kind, entity_id, status);
CREATE INDEX IF NOT EXISTS moderation_assignments_assignee
  ON public.moderation_assignments (assigned_to, status);

-- Claim a case (fails if already claimed by someone else and not expired)
CREATE OR REPLACE FUNCTION public.claim_moderation_case(
  _kind text,
  _entity_id uuid,
  _ttl_minutes integer DEFAULT 30
) RETURNS public.moderation_assignments
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
    WHERE kind = _kind AND entity_id = _entity_id
    FOR UPDATE;

  IF FOUND THEN
    IF v_row.status = 'claimed' AND v_row.assigned_to <> v_uid AND v_row.expires_at > now() THEN
      RAISE EXCEPTION 'Case is already claimed by another moderator until %', v_row.expires_at;
    END IF;
    UPDATE public.moderation_assignments
       SET assigned_to = v_uid,
           status = 'claimed',
           claimed_at = now(),
           expires_at = now() + make_interval(mins => _ttl_minutes),
           updated_at = now()
     WHERE id = v_row.id
     RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.moderation_assignments (kind, entity_id, assigned_to, expires_at)
    VALUES (_kind, _entity_id, v_uid, now() + make_interval(mins => _ttl_minutes))
    RETURNING * INTO v_row;
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'moderation.claimed', 'moderation_assignment', v_row.id::text,
          jsonb_build_object('kind', _kind, 'target_entity_id', _entity_id, 'expires_at', v_row.expires_at));

  RETURN v_row;
END $$;

-- Force takeover (allowed only when current claim expired, or by admin any time)
CREATE OR REPLACE FUNCTION public.takeover_moderation_case(
  _kind text,
  _entity_id uuid,
  _ttl_minutes integer DEFAULT 30
) RETURNS public.moderation_assignments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.moderation_assignments;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only moderators can take over cases';
  END IF;

  SELECT * INTO v_row FROM public.moderation_assignments
    WHERE kind = _kind AND entity_id = _entity_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN public.claim_moderation_case(_kind, _entity_id, _ttl_minutes);
  END IF;

  UPDATE public.moderation_assignments
     SET assigned_to = v_uid,
         status = 'claimed',
         claimed_at = now(),
         expires_at = now() + make_interval(mins => COALESCE(_ttl_minutes,30)),
         updated_at = now()
   WHERE id = v_row.id
   RETURNING * INTO v_row;

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
  VALUES (v_uid, 'moderation.taken_over', 'moderation_assignment', v_row.id::text, v_row.assigned_to,
          jsonb_build_object('kind', _kind, 'target_entity_id', _entity_id));

  RETURN v_row;
END $$;

-- Release own claim
CREATE OR REPLACE FUNCTION public.release_moderation_case(
  _kind text,
  _entity_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.moderation_assignments
     SET status = 'released', updated_at = now()
   WHERE kind = _kind AND entity_id = _entity_id
     AND (assigned_to = v_uid OR public.has_role(v_uid, 'admin'::public.app_role));

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'moderation.released', 'moderation_assignment', _entity_id::text,
          jsonb_build_object('kind', _kind));
END $$;

-- Mark completed
CREATE OR REPLACE FUNCTION public.complete_moderation_case(
  _kind text,
  _entity_id uuid,
  _notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.moderation_assignments
     SET status = 'completed', notes = COALESCE(_notes, notes), updated_at = now()
   WHERE kind = _kind AND entity_id = _entity_id;

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'moderation.completed', 'moderation_assignment', _entity_id::text,
          jsonb_build_object('kind', _kind, 'notes', _notes));
END $$;
