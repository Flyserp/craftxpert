CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, profile_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    -- Mark as completed if they signed up with a role (email signup), not completed for OAuth
    CASE WHEN NEW.raw_user_meta_data ->> 'role' IS NOT NULL THEN true ELSE false END
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(
    (NEW.raw_user_meta_data ->> 'role')::app_role,
    'customer'
  ));
  
  RETURN NEW;
END;
$$;