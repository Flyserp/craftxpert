
CREATE TABLE public.saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);

GRANT SELECT, INSERT, DELETE ON public.saved_jobs TO authenticated;
GRANT ALL ON public.saved_jobs TO service_role;

ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their saved jobs" ON public.saved_jobs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users save jobs" ON public.saved_jobs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove their saved jobs" ON public.saved_jobs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX saved_jobs_user_id_idx ON public.saved_jobs(user_id);
CREATE INDEX saved_jobs_job_id_idx ON public.saved_jobs(job_id);
