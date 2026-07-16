
-- Hidden flags for moderatable content
ALTER TABLE public.reviews  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.reviews  ADD COLUMN IF NOT EXISTS moderation_note text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS moderation_note text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS moderation_note text;

-- Admin moderation policies
DROP POLICY IF EXISTS "Admins can moderate reviews"  ON public.reviews;
CREATE POLICY "Admins can moderate reviews"  ON public.reviews
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can view all reviews" ON public.reviews;
CREATE POLICY "Admins can view all reviews" ON public.reviews
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can moderate messages" ON public.messages;
CREATE POLICY "Admins can moderate messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can view all messages" ON public.messages;
CREATE POLICY "Admins can view all messages" ON public.messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Unified user-submitted content reports
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('review','message','task','profile','portfolio','verification')),
  entity_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','actioned','dismissed')),
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can file reports"
  ON public.content_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users see their own reports"
  ON public.content_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage reports"
  ON public.content_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete reports"
  ON public.content_reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS content_reports_status_idx ON public.content_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS content_reports_entity_idx ON public.content_reports(entity_type, entity_id);

CREATE TRIGGER content_reports_set_updated_at
  BEFORE UPDATE ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
