-- Recent AI match searches per user (last 5 retained per user via trigger)
CREATE TABLE public.recent_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category_id UUID NULL,
  category_name TEXT NULL,
  address TEXT NULL,
  budget_min NUMERIC NULL,
  budget_max NUMERIC NULL,
  task_id UUID NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  top_vendor_name TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_recent_matches_user_created ON public.recent_matches(user_id, created_at DESC);

ALTER TABLE public.recent_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recent matches"
  ON public.recent_matches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recent matches"
  ON public.recent_matches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recent matches"
  ON public.recent_matches FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Keep only the last 5 per user
CREATE OR REPLACE FUNCTION public.trim_recent_matches()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.recent_matches
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id FROM public.recent_matches
      WHERE user_id = NEW.user_id
      ORDER BY created_at DESC
      LIMIT 5
    );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trim_recent_matches_after_insert
AFTER INSERT ON public.recent_matches
FOR EACH ROW
EXECUTE FUNCTION public.trim_recent_matches();