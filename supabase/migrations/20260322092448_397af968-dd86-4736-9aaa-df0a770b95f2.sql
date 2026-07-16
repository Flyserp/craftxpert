-- Invitation table for tenant member invitations
CREATE TABLE public.tenant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL,
  email text,
  invite_code text NOT NULL UNIQUE DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  role app_role NOT NULL DEFAULT 'vendor',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_by uuid
);

ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

-- Tenant owners can manage invitations
CREATE POLICY "Tenant owners can manage invitations"
  ON public.tenant_invitations FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tenants WHERE tenants.id = tenant_invitations.tenant_id AND tenants.owner_id = auth.uid()
  ));

-- Anyone can view invitations by code (for acceptance flow)
CREATE POLICY "Anyone can view invitation by code"
  ON public.tenant_invitations FOR SELECT
  TO public
  USING (true);

-- Authenticated users can accept invitations
CREATE POLICY "Authenticated users can accept invitations"
  ON public.tenant_invitations FOR UPDATE
  TO authenticated
  USING (status = 'pending');