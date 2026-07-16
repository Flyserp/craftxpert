CREATE OR REPLACE FUNCTION public.is_admin_or_moderator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'moderator'::public.app_role)
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_or_moderator(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  meta_role text;
  resolved_role public.app_role;
BEGIN
  INSERT INTO public.profiles (user_id, display_name, profile_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    false
  );

  meta_role := NEW.raw_user_meta_data ->> 'role';
  resolved_role := CASE meta_role
    WHEN 'customer'  THEN 'customer'::public.app_role
    WHEN 'client'    THEN 'customer'::public.app_role
    WHEN 'provider'  THEN 'provider'::public.app_role
    WHEN 'vendor'    THEN 'provider'::public.app_role
    WHEN 'employer'  THEN 'employer'::public.app_role
    WHEN 'admin'     THEN 'admin'::public.app_role
    WHEN 'moderator' THEN 'moderator'::public.app_role
    ELSE 'customer'::public.app_role
  END;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, resolved_role);
  RETURN NEW;
END;
$function$;