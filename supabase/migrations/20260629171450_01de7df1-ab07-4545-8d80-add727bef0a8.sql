
CREATE TABLE IF NOT EXISTS public.employer_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text,
  description text,
  address text,
  industry text,
  website text,
  logo_url text,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employer_profiles TO authenticated;
GRANT SELECT ON public.employer_profiles TO anon;
GRANT ALL ON public.employer_profiles TO service_role;

ALTER TABLE public.employer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employer profiles are viewable by everyone"
  ON public.employer_profiles FOR SELECT USING (true);

CREATE POLICY "Employers manage their own profile insert"
  ON public.employer_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Employers update their own profile"
  ON public.employer_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update any employer profile"
  ON public.employer_profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_employer_profiles_updated_at
  BEFORE UPDATE ON public.employer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
