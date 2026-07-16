CREATE OR REPLACE FUNCTION public.bulk_moderation_action(
  _items jsonb,
  _action text,
  _note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_kind text;
  v_id uuid;
  v_ok int := 0;
  v_fail int := 0;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only moderators can run bulk actions';
  END IF;
  IF _action NOT IN ('approve','reject','dismiss','request_info','resolve') THEN
    RAISE EXCEPTION 'Invalid action: %', _action;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    BEGIN
      v_kind := v_item->>'kind';
      v_id   := (v_item->>'entity_id')::uuid;

      IF v_kind = 'verification' THEN
        IF _action = 'approve' THEN
          UPDATE public.vendor_verifications
             SET status = 'approved', reviewed_by = v_uid, reviewed_at = now(),
                 admin_notes = COALESCE(_note, admin_notes), updated_at = now()
           WHERE id = v_id;
        ELSIF _action = 'reject' THEN
          UPDATE public.vendor_verifications
             SET status = 'rejected', reviewed_by = v_uid, reviewed_at = now(),
                 rejection_note = COALESCE(_note, rejection_note), updated_at = now()
           WHERE id = v_id;
        ELSIF _action = 'request_info' THEN
          UPDATE public.vendor_verifications
             SET status = 'info_requested', reviewed_by = v_uid, reviewed_at = now(),
                 info_request_note = COALESCE(_note, info_request_note), updated_at = now()
           WHERE id = v_id;
        ELSIF _action = 'resolve' THEN
          -- Treat resolve on verification as approve (closes the queue item)
          UPDATE public.vendor_verifications
             SET status = 'approved', reviewed_by = v_uid, reviewed_at = now(),
                 admin_notes = COALESCE(_note, admin_notes), updated_at = now()
           WHERE id = v_id;
        ELSE
          RAISE EXCEPTION 'dismiss is not valid for verifications';
        END IF;

      ELSIF v_kind = 'report' THEN
        UPDATE public.content_reports
           SET status = CASE _action
                          WHEN 'approve' THEN 'actioned'
                          WHEN 'reject'  THEN 'dismissed'
                          WHEN 'dismiss' THEN 'dismissed'
                          WHEN 'resolve' THEN 'resolved'
                          WHEN 'request_info' THEN 'info_requested'
                        END,
               reviewed_by = v_uid, reviewed_at = now(),
               admin_notes = COALESCE(_note, admin_notes), updated_at = now()
         WHERE id = v_id;

      ELSIF v_kind = 'dispute' THEN
        UPDATE public.disputes
           SET status = CASE _action
                          WHEN 'approve' THEN 'resolved'
                          WHEN 'reject'  THEN 'closed'
                          WHEN 'dismiss' THEN 'closed'
                          WHEN 'resolve' THEN 'resolved'
                          WHEN 'request_info' THEN 'info_requested'
                        END,
               resolved_by = CASE WHEN _action IN ('approve','reject','dismiss','resolve') THEN v_uid ELSE resolved_by END,
               resolved_at = CASE WHEN _action IN ('approve','reject','dismiss','resolve') THEN now() ELSE resolved_at END,
               admin_notes = COALESCE(_note, admin_notes), updated_at = now()
         WHERE id = v_id;

      ELSIF v_kind = 'refund' THEN
        UPDATE public.refund_requests
           SET status = CASE _action
                          WHEN 'approve' THEN 'approved'
                          WHEN 'reject'  THEN 'rejected'
                          WHEN 'dismiss' THEN 'rejected'
                          WHEN 'resolve' THEN 'resolved'
                          WHEN 'request_info' THEN 'info_requested'
                        END,
               reviewed_by = v_uid, reviewed_at = now(),
               admin_notes = COALESCE(_note, admin_notes), updated_at = now()
         WHERE id = v_id;

      ELSE
        RAISE EXCEPTION 'Unknown kind: %', v_kind;
      END IF;

      -- Mark assignment complete if one exists
      UPDATE public.moderation_assignments
         SET status = 'completed', notes = COALESCE(_note, notes), updated_at = now()
       WHERE kind = v_kind AND entity_id = v_id;

      INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
      VALUES (v_uid,
              'moderation.bulk.' || _action,
              v_kind,
              v_id::text,
              jsonb_build_object('note', _note));

      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      v_errors := v_errors || jsonb_build_object(
        'kind', v_kind, 'entity_id', v_id, 'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', v_ok, 'failed', v_fail, 'errors', v_errors);
END $$;