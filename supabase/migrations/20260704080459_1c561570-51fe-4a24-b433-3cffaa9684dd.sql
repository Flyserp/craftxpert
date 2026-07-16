
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS experience_level text,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_visibility_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_visibility_check CHECK (visibility IN ('public','private'));

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_experience_level_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_experience_level_check
  CHECK (experience_level IS NULL OR experience_level IN ('entry','intermediate','expert'));
