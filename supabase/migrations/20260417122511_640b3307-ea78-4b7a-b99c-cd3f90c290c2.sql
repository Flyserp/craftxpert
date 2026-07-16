-- Create task_proposals table
CREATE TABLE public.task_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('vendor_applied', 'customer_invited')),
  service_id UUID REFERENCES public.vendor_services(id) ON DELETE SET NULL,
  quoted_price NUMERIC,
  eta_date DATE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, vendor_id, direction)
);

CREATE INDEX idx_task_proposals_task_id ON public.task_proposals(task_id);
CREATE INDEX idx_task_proposals_vendor_id ON public.task_proposals(vendor_id);
CREATE INDEX idx_task_proposals_customer_id ON public.task_proposals(customer_id);

ALTER TABLE public.task_proposals ENABLE ROW LEVEL SECURITY;

-- Customers can view proposals for their tasks
CREATE POLICY "Customers can view proposals on own tasks"
ON public.task_proposals FOR SELECT
TO authenticated
USING (auth.uid() = customer_id);

-- Vendors can view their own proposals
CREATE POLICY "Vendors can view own proposals"
ON public.task_proposals FOR SELECT
TO authenticated
USING (auth.uid() = vendor_id);

-- Vendors can apply to open tasks
CREATE POLICY "Vendors can apply to tasks"
ON public.task_proposals FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = vendor_id
  AND has_role(auth.uid(), 'vendor'::app_role)
  AND direction = 'vendor_applied'
  AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.customer_id = task_proposals.customer_id AND t.status = 'open')
);

-- Customers can invite vendors to their tasks
CREATE POLICY "Customers can invite vendors"
ON public.task_proposals FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = customer_id
  AND has_role(auth.uid(), 'customer'::app_role)
  AND direction = 'customer_invited'
  AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.customer_id = auth.uid() AND t.status = 'open')
);

-- Customers can update proposals on their tasks (accept/decline)
CREATE POLICY "Customers can update proposals on own tasks"
ON public.task_proposals FOR UPDATE
TO authenticated
USING (auth.uid() = customer_id);

-- Vendors can update their own proposals (withdraw or accept invitations)
CREATE POLICY "Vendors can update own proposals"
ON public.task_proposals FOR UPDATE
TO authenticated
USING (auth.uid() = vendor_id AND has_role(auth.uid(), 'vendor'::app_role));

-- updated_at trigger
CREATE TRIGGER update_task_proposals_updated_at
BEFORE UPDATE ON public.task_proposals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_proposals;