
CREATE TABLE IF NOT EXISTS public.moderation_response_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('verification','report','dispute','refund','general')),
  action text NOT NULL CHECK (action IN ('approve','reject','dismiss','request_info','warning')),
  subject text,
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.moderation_response_templates TO authenticated;
GRANT ALL ON public.moderation_response_templates TO service_role;

ALTER TABLE public.moderation_response_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view templates"
  ON public.moderation_response_templates FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage templates"
  ON public.moderation_response_templates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER moderation_response_templates_updated_at
BEFORE UPDATE ON public.moderation_response_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS moderation_templates_kind_action_idx
  ON public.moderation_response_templates (kind, action, is_active);

INSERT INTO public.moderation_response_templates (name, kind, action, subject, body) VALUES
('Verification approved',     'verification','approve','You are verified',
 'Congratulations {{user_name}} — your verification for {{business_name}} has been approved. Your profile now shows a Verified badge. {{admin_note}}'),
('Verification rejected',     'verification','reject','Verification needs changes',
 'Hi {{user_name}}, we could not approve your verification for {{business_name}}. Reason: {{admin_note}}. Please review the requested fixes and resubmit.'),
('Verification info request', 'verification','request_info','Additional information needed',
 'Hi {{user_name}}, we need a bit more information before we can complete your verification for {{business_name}}. {{admin_note}}'),
('Content report actioned',   'report','approve','Report resolved',
 'Thanks for reporting {{entity_type}}. We reviewed the report and took action. {{admin_note}}'),
('Content report dismissed',  'report','dismiss','Report reviewed',
 'We reviewed your report on {{entity_type}} and did not find a policy violation. {{admin_note}}'),
('Dispute resolved',          'dispute','approve','Dispute resolved',
 'Your dispute has been resolved. Outcome: {{admin_note}}'),
('Refund approved',           'refund','approve','Refund approved',
 'Your refund request has been approved. {{admin_note}}');
