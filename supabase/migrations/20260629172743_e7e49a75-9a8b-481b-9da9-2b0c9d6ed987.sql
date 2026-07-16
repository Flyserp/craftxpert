ALTER TABLE public.task_proposals
  ADD COLUMN IF NOT EXISTS estimated_duration text,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.task_proposals DROP CONSTRAINT IF EXISTS task_proposals_status_check;
ALTER TABLE public.task_proposals ADD CONSTRAINT task_proposals_status_check
  CHECK (status = ANY (ARRAY['pending'::text,'accepted'::text,'declined'::text,'withdrawn'::text,'shortlisted'::text]));