-- Add 'employer' to the app_role enum and update the new-user role mapping
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'employer';

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
    CASE WHEN NEW.raw_user_meta_data ->> 'role' IS NOT NULL THEN true ELSE false END
  );

  meta_role := NEW.raw_user_meta_data ->> 'role';
  resolved_role := CASE meta_role
    WHEN 'client'    THEN 'client'::public.app_role
    WHEN 'customer'  THEN 'client'::public.app_role
    WHEN 'provider'  THEN 'provider'::public.app_role
    WHEN 'vendor'    THEN 'provider'::public.app_role
    WHEN 'employer'  THEN 'employer'::public.app_role
    WHEN 'admin'     THEN 'admin'::public.app_role
    WHEN 'moderator' THEN 'admin'::public.app_role
    ELSE 'client'::public.app_role
  END;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, resolved_role);
  RETURN NEW;
END;
$function$;