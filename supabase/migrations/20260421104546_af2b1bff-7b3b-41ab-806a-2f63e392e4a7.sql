-- Allow invitees to log their own invite-funnel analytics events to admin_audit_log.
-- Constraints:
--  * actor_id must be the authenticated user
--  * action must be one of the three invite funnel events
--  * entity_type must be 'staff_invitation'
--  * the entity_id must reference an invitation actually accepted by this user
CREATE POLICY "Invitees can log their own invite funnel events"
ON public.admin_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND entity_type = 'staff_invitation'
  AND action IN (
    'staff_invite.accept_completed',
    'staff_invite.redirect_completed',
    'staff_invite.redirect_failed'
  )
  AND EXISTS (
    SELECT 1
    FROM public.staff_invitations si
    WHERE si.id::text = admin_audit_log.entity_id
      AND si.accepted_by = auth.uid()
  )
);