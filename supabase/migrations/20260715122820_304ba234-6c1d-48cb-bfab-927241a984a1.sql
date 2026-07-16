
-- Seed retention setting (defaults to 90 days). Idempotent.
INSERT INTO public.platform_settings (key, value, is_secret)
VALUES ('review_retention_days', '90', false)
ON CONFLICT (key) DO NOTHING;

-- Admin hard delete with mandatory audit trail
CREATE OR REPLACE FUNCTION public.admin_hard_delete_review(
  _review_id uuid,
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.reviews%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can hard-delete reviews';
  END IF;

  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN
    RAISE EXCEPTION 'A reason of at least 5 characters is required';
  END IF;

  SELECT * INTO v_row FROM public.reviews WHERE id = _review_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Review not found'; END IF;

  INSERT INTO public.admin_audit_log
    (actor_id, action, entity_type, entity_id, target_user_id, details)
  VALUES (
    v_uid,
    'review.hard_deleted',
    'review',
    v_row.id::text,
    v_row.reviewer_id,
    jsonb_build_object(
      'reason', btrim(_reason),
      'rating', v_row.rating,
      'comment', v_row.comment,
      'vendor_id', v_row.vendor_id,
      'booking_id', v_row.booking_id,
      'is_hidden', v_row.is_hidden,
      'was_created_at', v_row.created_at
    )
  );

  DELETE FROM public.reviews WHERE id = _review_id;

  RETURN jsonb_build_object('success', true, 'review_id', _review_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_hard_delete_review(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_hard_delete_review(uuid, text) TO authenticated;

-- Retention purge for reviews that have been hidden past the configured window
CREATE OR REPLACE FUNCTION public.purge_expired_hidden_reviews()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_days int;
  v_cutoff timestamptz;
  v_deleted int := 0;
  r record;
BEGIN
  SELECT COALESCE(NULLIF(value,'')::int, 90) INTO v_days
    FROM public.platform_settings
   WHERE key = 'review_retention_days';
  IF v_days IS NULL OR v_days < 1 THEN v_days := 90; END IF;
  v_cutoff := now() - make_interval(days => v_days);

  FOR r IN
    SELECT id, reviewer_id, vendor_id, rating, comment, created_at
      FROM public.reviews
     WHERE is_hidden = true
       AND COALESCE(updated_at, created_at) < v_cutoff
  LOOP
    INSERT INTO public.admin_audit_log
      (actor_id, action, entity_type, entity_id, target_user_id, details)
    VALUES (
      NULL,
      'review.retention_purged',
      'review',
      r.id::text,
      r.reviewer_id,
      jsonb_build_object(
        'reason', 'retention_window_expired',
        'retention_days', v_days,
        'rating', r.rating,
        'comment', r.comment,
        'vendor_id', r.vendor_id,
        'was_created_at', r.created_at
      )
    );

    DELETE FROM public.reviews WHERE id = r.id;
    v_deleted := v_deleted + 1;
  END LOOP;

  RETURN jsonb_build_object('deleted', v_deleted, 'retention_days', v_days);
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_hidden_reviews() FROM public;
GRANT EXECUTE ON FUNCTION public.purge_expired_hidden_reviews() TO authenticated;
