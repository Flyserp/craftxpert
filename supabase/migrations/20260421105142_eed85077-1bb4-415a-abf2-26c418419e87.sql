-- Allow invitees to log "unknown role" schema-drift events for invitations they
-- are looking at (matched by email), even before acceptance. This lets the
-- accept page report client-detected role drift to admin_audit_log.
DROP POLICY IF EXISTS "Invitees can log their own invite funnel events" ON public.admin_audit_log;

CREATE POLICY "Invitees can log their own invite funnel events"
ON public.admin_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  (actor_id = auth.uid())
  AND (entity_type = 'staff_invitation'::text)
  AND (
    action = ANY (ARRAY[
      'staff_invite.accept_completed'::text,
      'staff_invite.redirect_completed'::text,
      'staff_invite.redirect_failed'::text,
      'staff_invite.unknown_role'::text
    ])
  )
  AND (
    -- accepted invites: invitee is the accepter
    EXISTS (
      SELECT 1 FROM public.staff_invitations si
      WHERE si.id::text = admin_audit_log.entity_id
        AND si.accepted_by = auth.uid()
    )
    OR
    -- pre-accept unknown_role drift: invitee email matches the auth user's email
    (
      action = 'staff_invite.unknown_role'::text
      AND EXISTS (
        SELECT 1
        FROM public.staff_invitations si
        JOIN auth.users u ON u.id = auth.uid()
        WHERE si.id::text = admin_audit_log.entity_id
          AND lower(si.email) = lower(u.email)
      )
    )
  )
);