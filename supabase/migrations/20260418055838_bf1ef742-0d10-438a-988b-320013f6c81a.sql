CREATE POLICY "Open tasks are publicly viewable"
ON public.tasks
FOR SELECT
TO anon, authenticated
USING (status = 'open');