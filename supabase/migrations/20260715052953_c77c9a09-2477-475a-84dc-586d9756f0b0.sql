
CREATE OR REPLACE FUNCTION public.set_initial_role(_role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role_count int;
  v_completed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _role NOT IN ('customer','provider','employer') THEN
    RAISE EXCEPTION 'Invalid role: %', _role;
  END IF;

  -- Never let this touch admin accounts
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'admin') THEN
    RAISE EXCEPTION 'Cannot change role for admin accounts';
  END IF;

  SELECT COUNT(*) INTO v_role_count FROM public.user_roles WHERE user_id = v_uid;
  IF v_role_count <> 1 THEN
    RAISE EXCEPTION 'Role already established';
  END IF;

  SELECT COALESCE(profile_completed, false) INTO v_completed
    FROM public.profiles WHERE user_id = v_uid;
  IF v_completed THEN
    RAISE EXCEPTION 'Profile already completed; role is locked';
  END IF;

  UPDATE public.user_roles
     SET role = _role
   WHERE user_id = v_uid;

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
  VALUES (v_uid, 'user.initial_role_set', 'user_role', v_uid::text, v_uid,
          jsonb_build_object('role', _role));
END $$;

GRANT EXECUTE ON FUNCTION public.set_initial_role(public.app_role) TO authenticated;
