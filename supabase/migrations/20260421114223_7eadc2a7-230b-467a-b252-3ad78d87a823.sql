-- 1. Helper: does the current auth user's email match this invite's email?
CREATE OR REPLACE FUNCTION public.invitee_email_matches(_invite_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_invitations si
    JOIN auth.users u ON u.id = auth.uid()
    WHERE si.id = _invite_id
      AND lower(si.email) = lower(u.email)
  );
$$;

REVOKE ALL ON FUNCTION public.invitee_email_matches(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invitee_email_matches(uuid) TO authenticated;

-- 2. Tighten the invitee insert policy.
--    - actor_id must be the auth user
--    - entity_type must be staff_invitation
--    - entity_id must be a valid UUID (no nulls / no garbage strings)
--    - For unknown_role: invitee email MUST match the invite's email
--    - For accept_completed / redirect_completed / redirect_failed:
--      the invite must already be accepted by the auth user
DROP POLICY IF EXISTS "Invitees can log their own invite funnel events" ON public.admin_audit_log;

CREATE POLICY "Invitees can log their own invite funnel events"
ON public.admin_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND entity_type = 'staff_invitation'
  AND entity_id IS NOT NULL
  AND entity_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND action = ANY (ARRAY[
    'staff_invite.accept_completed',
    'staff_invite.redirect_completed',
    'staff_invite.redirect_failed',
    'staff_invite.unknown_role'
  ])
  AND (
    -- Post-acceptance funnel events: invitee is the accepter
    (
      action <> 'staff_invite.unknown_role'
      AND EXISTS (
        SELECT 1 FROM public.staff_invitations si
        WHERE si.id = entity_id::uuid
          AND si.accepted_by = auth.uid()
      )
    )
    OR
    -- Pre-accept schema-drift event: invitee email must match the invite's email
    (
      action = 'staff_invite.unknown_role'
      AND public.invitee_email_matches(entity_id::uuid)
    )
  )
);

-- 3. Regression test function. Admins can call this to verify the policy
--    behaves correctly for unknown_role inserts. Returns one row per assertion
--    with pass/fail status; fails loudly if the policy ever regresses.
CREATE OR REPLACE FUNCTION public.test_admin_audit_log_invitee_policy()
RETURNS TABLE (assertion text, passed boolean, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider uuid;
  v_invitee  uuid;
  v_intruder uuid;
  v_invite   uuid;
  v_inserted boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can run RLS regression tests';
  END IF;

  -- Pick three real users from auth.users for the test fixture.
  -- We don't create fake auth users (can't from SQL); we just need 3 distinct ids+emails.
  SELECT id INTO v_provider FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT id INTO v_invitee  FROM auth.users WHERE id <> v_provider ORDER BY created_at LIMIT 1;
  SELECT id INTO v_intruder FROM auth.users WHERE id NOT IN (v_provider, v_invitee) ORDER BY created_at LIMIT 1;

  IF v_provider IS NULL OR v_invitee IS NULL OR v_intruder IS NULL THEN
    assertion := 'fixture'; passed := false;
    detail := 'Need at least 3 auth.users to run this test';
    RETURN NEXT; RETURN;
  END IF;

  -- Create a synthetic invitation addressed to the invitee's email
  INSERT INTO public.staff_invitations (provider_id, email, role, token, status)
  SELECT v_provider, lower(u.email), 'staff'::public.staff_invite_role,
         'rls-test-' || gen_random_uuid()::text, 'pending'
    FROM auth.users u WHERE u.id = v_invitee
  RETURNING id INTO v_invite;

  -- Assertion 1: matching invitee CAN insert unknown_role
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_invitee::text, true);
    EXECUTE format($q$
      INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
      VALUES (%L::uuid, 'staff_invite.unknown_role', 'staff_invitation', %L, '{"received_role":"x"}'::jsonb)
    $q$, v_invitee, v_invite);
    v_inserted := true;
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    v_inserted := false;
  END;
  assertion := 'matching invitee can insert unknown_role';
  passed := v_inserted;
  detail := CASE WHEN v_inserted THEN 'ok' ELSE 'BLOCKED unexpectedly' END;
  RETURN NEXT;

  -- Assertion 2: non-matching user CANNOT insert unknown_role for this invite
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_intruder::text, true);
    EXECUTE format($q$
      INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
      VALUES (%L::uuid, 'staff_invite.unknown_role', 'staff_invitation', %L, '{"received_role":"x"}'::jsonb)
    $q$, v_intruder, v_invite);
    v_inserted := true;
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    v_inserted := false;
  END;
  assertion := 'non-matching user blocked from unknown_role';
  passed := NOT v_inserted;
  detail := CASE WHEN v_inserted THEN 'INSERT SUCCEEDED — POLICY REGRESSED' ELSE 'ok' END;
  RETURN NEXT;

  -- Assertion 3: invalid (non-uuid) entity_id is rejected
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_invitee::text, true);
    EXECUTE format($q$
      INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
      VALUES (%L::uuid, 'staff_invite.unknown_role', 'staff_invitation', 'not-a-uuid', '{}'::jsonb)
    $q$, v_invitee);
    v_inserted := true;
  EXCEPTION WHEN insufficient_privilege OR check_violation OR invalid_text_representation THEN
    v_inserted := false;
  END;
  assertion := 'invalid entity_id rejected';
  passed := NOT v_inserted;
  detail := CASE WHEN v_inserted THEN 'INSERT SUCCEEDED — POLICY REGRESSED' ELSE 'ok' END;
  RETURN NEXT;

  -- Cleanup
  DELETE FROM public.admin_audit_log
   WHERE entity_type = 'staff_invitation' AND entity_id = v_invite::text;
  DELETE FROM public.staff_invitations WHERE id = v_invite;
END;
$$;

REVOKE ALL ON FUNCTION public.test_admin_audit_log_invitee_policy() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_admin_audit_log_invitee_policy() TO authenticated;