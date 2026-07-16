
CREATE OR REPLACE FUNCTION public.bulk_moderation_claim_action(
  _items jsonb,
  _action text,
  _ttl_minutes integer DEFAULT 30,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_kind text;
  v_id uuid;
  v_row public.moderation_assignments;
  v_ok int := 0;
  v_skipped int := 0;
  v_failed int := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only moderators can run bulk claim actions';
  END IF;
  IF _action NOT IN ('claim','release','complete') THEN
    RAISE EXCEPTION 'Invalid action: %', _action;
  END IF;
  IF _ttl_minutes IS NULL OR _ttl_minutes < 1 THEN _ttl_minutes := 30; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    BEGIN
      v_kind := v_item->>'kind';
      v_id   := (v_item->>'entity_id')::uuid;
      IF v_kind NOT IN ('verification','report','dispute','refund') THEN
        RAISE EXCEPTION 'Invalid kind: %', v_kind;
      END IF;

      SELECT * INTO v_row FROM public.moderation_assignments
        WHERE kind = v_kind AND entity_id = v_id FOR UPDATE;

      IF _action = 'claim' THEN
        IF FOUND AND v_row.status = 'claimed'
           AND v_row.assigned_to <> v_uid
           AND v_row.expires_at > now() THEN
          v_skipped := v_skipped + 1;
          v_details := v_details || jsonb_build_object('kind', v_kind, 'entity_id', v_id, 'skipped', 'claimed_by_other');
        ELSE
          IF FOUND THEN
            UPDATE public.moderation_assignments
               SET assigned_to = v_uid, status = 'claimed', claimed_at = now(),
                   expires_at = now() + make_interval(mins => _ttl_minutes),
                   expiry_notified_at = NULL, updated_at = now()
             WHERE id = v_row.id;
          ELSE
            INSERT INTO public.moderation_assignments (kind, entity_id, assigned_to, expires_at)
            VALUES (v_kind, v_id, v_uid, now() + make_interval(mins => _ttl_minutes));
          END IF;
          INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
          VALUES (v_uid, 'moderation.bulk.claim', 'moderation_assignment', v_id::text,
                  jsonb_build_object('kind', v_kind));
          v_ok := v_ok + 1;
        END IF;

      ELSIF _action = 'release' THEN
        IF NOT FOUND OR v_row.status <> 'claimed' THEN
          v_skipped := v_skipped + 1;
          v_details := v_details || jsonb_build_object('kind', v_kind, 'entity_id', v_id, 'skipped', 'not_claimed');
        ELSIF v_row.assigned_to <> v_uid THEN
          v_skipped := v_skipped + 1;
          v_details := v_details || jsonb_build_object('kind', v_kind, 'entity_id', v_id, 'skipped', 'not_owner');
        ELSE
          UPDATE public.moderation_assignments
             SET status = 'released', updated_at = now()
           WHERE id = v_row.id;
          INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
          VALUES (v_uid, 'moderation.bulk.release', 'moderation_assignment', v_id::text,
                  jsonb_build_object('kind', v_kind));
          v_ok := v_ok + 1;
        END IF;

      ELSIF _action = 'complete' THEN
        IF NOT FOUND OR v_row.status <> 'claimed' THEN
          v_skipped := v_skipped + 1;
          v_details := v_details || jsonb_build_object('kind', v_kind, 'entity_id', v_id, 'skipped', 'not_claimed');
        ELSIF v_row.assigned_to <> v_uid THEN
          v_skipped := v_skipped + 1;
          v_details := v_details || jsonb_build_object('kind', v_kind, 'entity_id', v_id, 'skipped', 'not_owner');
        ELSE
          UPDATE public.moderation_assignments
             SET status = 'completed', notes = COALESCE(_note, notes), updated_at = now()
           WHERE id = v_row.id;
          INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
          VALUES (v_uid, 'moderation.bulk.complete', 'moderation_assignment', v_id::text,
                  jsonb_build_object('kind', v_kind, 'note', _note));
          v_ok := v_ok + 1;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_details := v_details || jsonb_build_object('kind', v_kind, 'entity_id', v_id, 'error', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', v_ok, 'skipped', v_skipped, 'failed', v_failed, 'details', v_details);
END $$;

REVOKE ALL ON FUNCTION public.bulk_moderation_claim_action(jsonb, text, integer, text) FROM public;
GRANT EXECUTE ON FUNCTION public.bulk_moderation_claim_action(jsonb, text, integer, text) TO authenticated;
