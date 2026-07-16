CREATE TABLE public.homepage_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.homepage_content TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.homepage_content TO authenticated;
GRANT ALL ON public.homepage_content TO service_role;

ALTER TABLE public.homepage_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view homepage content"
  ON public.homepage_content FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage homepage content"
  ON public.homepage_content FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_homepage_content_updated_at
  BEFORE UPDATE ON public.homepage_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.homepage_content (singleton, content) VALUES (true, '{}'::jsonb)
  ON CONFLICT (singleton) DO NOTHING;