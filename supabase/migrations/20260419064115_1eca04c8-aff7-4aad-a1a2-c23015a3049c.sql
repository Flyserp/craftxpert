-- Per-user Post-a-Task drafts (cross-device resume)
CREATE TABLE public.task_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own draft"
  ON public.task_drafts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own draft"
  ON public.task_drafts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own draft"
  ON public.task_drafts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own draft"
  ON public.task_drafts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_task_drafts_updated_at
  BEFORE UPDATE ON public.task_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();