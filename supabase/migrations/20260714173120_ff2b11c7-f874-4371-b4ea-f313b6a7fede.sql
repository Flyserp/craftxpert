
CREATE OR REPLACE FUNCTION public.escalate_overdue_moderation_cases()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_escalated int := 0;
  v_row record;
  v_admin uuid;
  v_admins uuid[];
  v_kind text;
  v_title text;
  v_due timestamptz;
  v_overdue interval;
BEGIN
  -- Collect admin user_ids once
  SELECT COALESCE(array_agg(user_id), '{}') INTO v_admins
  FROM public.user_roles WHERE role = 'admin'::public.app_role;

  IF array_length(v_admins, 1) IS NULL THEN
    RETURN jsonb_build_object('escalated', 0, 'reason', 'no admins configured');
  END IF;

  FOR v_row IN
    -- Verifications: 48h SLA
    SELECT 'verification'::text AS kind, id AS entity_id,
           COALESCE(business_name, legal_name, 'Vendor verification') AS title,
           COALESCE(submitted_at, created_at) AS created_at,
           COALESCE(submitted_at, created_at) + interval '48 hours' AS due_at
    FROM public.vendor_verifications
    WHERE status IN ('pending', 'info_requested')
      AND COALESCE(submitted_at, created_at) + interval '48 hours' < now()
    UNION ALL
    -- Reports: 24h SLA
    SELECT 'report', id, entity_type || ' report',
           created_at, created_at + interval '24 hours'
    FROM public.content_reports
    WHERE status = 'pending'
      AND created_at + interval '24 hours' < now()
    UNION ALL
    -- Disputes: 24h SLA
    SELECT 'dispute', id, COALESCE(subject, 'Dispute'),
           created_at, created_at + interval '24 hours'
    FROM public.disputes
    WHERE status IN ('open', 'under_review', 'info_requested')
      AND created_at + interval '24 hours' < now()
    UNION ALL
    -- Refunds: 72h SLA
    SELECT 'refund', id, 'Refund request',
           created_at, created_at + interval '72 hours'
    FROM public.refund_requests
    WHERE status = 'pending'
      AND created_at + interval '72 hours' < now()
  LOOP
    v_kind := v_row.kind;
    v_title := v_row.title;
    v_due := v_row.due_at;
    v_overdue := now() - v_due;

    -- Skip if already escalated (audit log entry exists)
    IF EXISTS (
      SELECT 1 FROM public.admin_audit_log
      WHERE action = 'moderation.escalated'
        AND entity_type = v_kind
        AND entity_id = v_row.entity_id::text
    ) THEN
      CONTINUE;
    END IF;

    -- Audit log entry
    INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
    VALUES (NULL, 'moderation.escalated', v_kind, v_row.entity_id::text,
            jsonb_build_object(
              'title', v_title,
              'due_at', v_due,
              'overdue_seconds', EXTRACT(EPOCH FROM v_overdue)::int,
              'notified_admins', array_length(v_admins, 1)
            ));

    -- Notify every admin
    FOREACH v_admin IN ARRAY v_admins LOOP
      INSERT INTO public.notifications (user_id, type, title, message, metadata)
      VALUES (
        v_admin,
        'moderation_escalation',
        'SLA breached: ' || initcap(v_kind),
        v_title || ' is overdue by ' ||
          CASE
            WHEN v_overdue >= interval '1 hour'
              THEN EXTRACT(EPOCH FROM v_overdue)::int / 3600 || ' hour(s)'
            ELSE EXTRACT(EPOCH FROM v_overdue)::int / 60 || ' minute(s)'
          END || '. Please review the moderation inbox.',
        jsonb_build_object(
          'kind', v_kind,
          'entity_id', v_row.entity_id,
          'due_at', v_due,
          'link', '/admin/moderation-inbox'
        )
      );
    END LOOP;

    -- If a claim exists and has expired, release it so an admin can retake
    UPDATE public.moderation_assignments
       SET status = 'released', updated_at = now()
     WHERE kind = v_kind AND entity_id = v_row.entity_id
       AND status = 'claimed' AND expires_at < now();

    v_escalated := v_escalated + 1;
  END LOOP;

  RETURN jsonb_build_object('escalated', v_escalated, 'admins_notified', array_length(v_admins, 1));
END $$;

REVOKE ALL ON FUNCTION public.escalate_overdue_moderation_cases() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_overdue_moderation_cases() TO service_role;

-- Ensure pg_cron is available and schedule the sweep every 15 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'moderation-sla-escalation') THEN
    PERFORM cron.unschedule('moderation-sla-escalation');
  END IF;
  PERFORM cron.schedule(
    'moderation-sla-escalation',
    '*/15 * * * *',
    $cron$ SELECT public.escalate_overdue_moderation_cases(); $cron$
  );
END $$;
