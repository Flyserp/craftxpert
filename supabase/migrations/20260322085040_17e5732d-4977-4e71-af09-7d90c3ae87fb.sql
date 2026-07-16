CREATE POLICY "Moderators can view all bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Moderators can view all vendor services"
ON public.vendor_services
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Moderators can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Moderators can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'moderator'));