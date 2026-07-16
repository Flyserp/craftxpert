CREATE OR REPLACE FUNCTION public.accept_staff_invitation(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite public.staff_invitations%ROWTYPE;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_invite FROM public.staff_invitations WHERE token = _token;
  IF NOT FOUND THEN
    INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
    VALUES (
      v_user_id,
      'staff_invite.accept_failed',
      'staff_invitation',
      NULL,
      jsonb_build_object('reason', 'not_found', 'occurred_at', now())
    );
    RETURN jsonb_build_object('error', 'Invitation not found');
  END IF;

  IF v_invite.status <> 'pending' THEN
    INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
    VALUES (
      v_user_id,
      'staff_invite.accept_failed',
      'staff_invitation',
      v_invite.id::text,
      v_invite.provider_id,
      jsonb_build_object(
        'reason', 'not_pending',
        'invitation_status', v_invite.status,
        'provider_id', v_invite.provider_id,
        'email', v_invite.email,
        'occurred_at', now()
      )
    );
    RETURN jsonb_build_object('error', 'Invitation is no longer pending');
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.staff_invitations SET status = 'expired' WHERE id = v_invite.id;
    INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
    VALUES (
      v_user_id,
      'staff_invite.expired',
      'staff_invitation',
      v_invite.id::text,
      v_invite.provider_id,
      jsonb_build_object(
        'provider_id', v_invite.provider_id,
        'email', v_invite.email,
        'expired_at', v_invite.expires_at,
        'occurred_at', now()
      )
    );
    RETURN jsonb_build_object('error', 'Invitation has expired');
  END IF;

  INSERT INTO public.provider_staff (provider_id, staff_user_id, title)
  VALUES (v_invite.provider_id, v_user_id, v_invite.title)
  ON CONFLICT (provider_id, staff_user_id) DO NOTHING;

  UPDATE public.staff_invitations
  SET status = 'accepted', accepted_at = now(), accepted_by = v_user_id
  WHERE id = v_invite.id;

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
  VALUES (
    v_user_id,
    'staff_invite.accepted',
    'staff_invitation',
    v_invite.id::text,
    v_invite.provider_id,
    jsonb_build_object(
      'provider_id', v_invite.provider_id,
      'email', v_invite.email,
      'title', v_invite.title,
      'occurred_at', now()
    )
  );

  RETURN jsonb_build_object('success', true, 'provider_id', v_invite.provider_id);
END;
$function$;