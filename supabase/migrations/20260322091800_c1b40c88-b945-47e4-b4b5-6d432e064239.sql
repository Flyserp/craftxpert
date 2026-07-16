
-- Allow anyone to view active tenants (needed for public marketplace pages)
CREATE POLICY "Anyone can view active tenants"
ON public.tenants FOR SELECT TO public
USING (status = 'active');
