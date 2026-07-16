CREATE POLICY "Authenticated users can view non-secret settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (is_secret = false);