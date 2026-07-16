-- Allow anonymous (signed-out) visitors to read non-secret platform settings.
-- Branding, site name, logos, colors, etc. must be visible to everyone —
-- otherwise the app falls back to hardcoded defaults for logged-out users
-- and for the very first page load before the session hydrates.
CREATE POLICY "Anyone can view non-secret platform settings"
ON public.platform_settings
FOR SELECT
TO anon
USING (is_secret = false);

-- Explicit grant so PostgREST exposes the table to the anon role.
GRANT SELECT ON public.platform_settings TO anon;