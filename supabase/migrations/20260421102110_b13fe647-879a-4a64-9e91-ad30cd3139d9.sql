-- 1. Enum for invite role
DO $$ BEGIN
  CREATE TYPE public.staff_invite_role AS ENUM ('staff', 'manager', 'provider_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add role to staff_invitations
ALTER TABLE public.staff_invitations
  ADD COLUMN IF NOT EXISTS role public.staff_invite_role NOT NULL DEFAULT 'staff';

-- 3. Add role to provider_staff so it persists after acceptance
ALTER TABLE public.provider_staff
  ADD COLUMN IF NOT EXISTS role public.staff_invite_role NOT NULL DEFAULT 'staff';

-- 4. Ensure unique constraint for ON CONFLICT in accept function
DO $$ BEGIN
  ALTER TABLE public.provider_staff
    ADD CONSTRAINT provider_staff_provider_staff_user_unique UNIQUE (provider_id, staff_user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- 5. Drop + recreate get_staff_invitation (return type changed)
DROP FUNCTION IF EXISTS public.get_staff_invitation(text);

CREATE FUNCTION public.get_staff_invitation(_token text)
 RETURNS TABLE(
   id uuid,
   provider_id uuid,
   provider_name text,
   email text,
   title text,
   role public.staff_invite_role,
   status text,
   expires_at timestamp with time zone
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    si.id,
    si.provider_id,
    pr.display_name AS provider_name,
    si.email,
    si.title,
    si.role,
    si.status,
    si.expires_at
  FROM public.staff_invitations si
  LEFT JOIN public.profiles pr ON pr.user_id = si.provider_id
  WHERE si.token = _token
  LIMIT 1;
$function$;

-- 6. Update accept_staff_invitation to thread role through
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
        'role', v_invite.role,
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
        'role', v_invite.role,
        'expired_at', v_invite.expires_at,
        'occurred_at', now()
      )
    );
    RETURN jsonb_build_object('error', 'Invitation has expired');
  END IF;

  INSERT INTO public.provider_staff (provider_id, staff_user_id, title, role)
  VALUES (v_invite.provider_id, v_user_id, v_invite.title, v_invite.role)
  ON CONFLICT (provider_id, staff_user_id) DO UPDATE
    SET role = EXCLUDED.role,
        title = COALESCE(EXCLUDED.title, public.provider_staff.title),
        is_active = true;

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
      'role', v_invite.role,
      'occurred_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'provider_id', v_invite.provider_id,
    'role', v_invite.role
  );
END;
$function$;