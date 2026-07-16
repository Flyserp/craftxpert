
-- 1. Routing table
CREATE TABLE IF NOT EXISTS public.moderation_notification_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text,                       -- NULL = all queues; else verification|report|dispute|refund
  tenant_id uuid,                  -- NULL = platform-wide
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT moderation_route_kind_check
    CHECK (kind IS NULL OR kind IN ('verification','report','dispute','refund')),
  CONSTRAINT moderation_route_unique
    UNIQUE (kind, tenant_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.moderation_notification_routes TO authenticated;
GRANT ALL ON public.moderation_notification_routes TO service_role;

ALTER TABLE public.moderation_notification_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all routes, users see own"
  ON public.moderation_notification_routes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage routes"
  ON public.moderation_notification_routes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_mod_routes_kind_tenant
  ON public.moderation_notification_routes(kind, tenant_id);

-- 2. Helper to resolve recipients for a given queue kind + tenant
CREATE OR REPLACE FUNCTION public.moderation_route_recipients(_kind text, _tenant uuid DEFAULT NULL)
RETURNS uuid[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admins uuid[];
BEGIN
  SELECT COALESCE(array_agg(DISTINCT user_id), '{}')
    INTO v_admins
    FROM public.moderation_notification_routes r
   WHERE (r.kind IS NULL OR r.kind = _kind)
     AND (r.tenant_id IS NULL OR r.tenant_id = _tenant);

  -- Fallback: no routes configured for this queue -> notify every admin
  IF array_length(v_admins, 1) IS NULL THEN
    SELECT COALESCE(array_agg(user_id), '{}')
      INTO v_admins
      FROM public.user_roles
     WHERE role = 'admin'::public.app_role;
  END IF;

  RETURN v_admins;
END $$;

GRANT EXECUTE ON FUNCTION public.moderation_route_recipients(text, uuid) TO authenticated, service_role;

-- 3. Update escalation to use per-queue routing
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
  FOR v_row IN
    SELECT 'verification'::text AS kind, id AS entity_id,
           COALESCE(business_name, legal_name, 'Vendor verification') AS title,
           COALESCE(submitted_at, created_at) AS created_at,
           COALESCE(submitted_at, created_at) + interval '48 hours' AS due_at
    FROM public.vendor_verifications
    WHERE status IN ('pending', 'info_requested')
      AND COALESCE(submitted_at, created_at) + interval '48 hours' < now()
    UNION ALL
    SELECT 'report', id, entity_type || ' report',
           created_at, created_at + interval '24 hours'
    FROM public.content_reports
    WHERE status = 'pending'
      AND created_at + interval '24 hours' < now()
    UNION ALL
    SELECT 'dispute', id, COALESCE(subject, 'Dispute'),
           created_at, created_at + interval '24 hours'
    FROM public.disputes
    WHERE status IN ('open', 'under_review', 'info_requested')
      AND created_at + interval '24 hours' < now()
    UNION ALL
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

    IF EXISTS (
      SELECT 1 FROM public.admin_audit_log
      WHERE action = 'moderation.escalated'
        AND entity_type = v_kind
        AND entity_id = v_row.entity_id::text
    ) THEN CONTINUE; END IF;

    v_admins := public.moderation_route_recipients(v_kind, NULL);
    IF array_length(v_admins, 1) IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
    VALUES (NULL, 'moderation.escalated', v_kind, v_row.entity_id::text,
            jsonb_build_object(
              'title', v_title,
              'due_at', v_due,
              'overdue_seconds', EXTRACT(EPOCH FROM v_overdue)::int,
              'notified_admins', array_length(v_admins, 1),
              'routed', true
            ));

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
        jsonb_build_object('kind', v_kind, 'entity_id', v_row.entity_id,
                           'due_at', v_due, 'link', '/admin/inbox')
      );
    END LOOP;

    UPDATE public.moderation_assignments
       SET status = 'released', updated_at = now()
     WHERE kind = v_kind AND entity_id = v_row.entity_id
       AND status = 'claimed' AND expires_at < now();

    v_escalated := v_escalated + 1;
  END LOOP;

  RETURN jsonb_build_object('escalated', v_escalated);
END $$;
