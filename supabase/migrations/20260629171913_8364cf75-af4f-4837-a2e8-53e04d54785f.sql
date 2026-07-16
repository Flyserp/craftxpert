
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS posting_fee numeric(10,2) NOT NULL DEFAULT 0;

-- Allow employers to create/update/view their own tasks
DROP POLICY IF EXISTS "Employers can create tasks" ON public.tasks;
CREATE POLICY "Employers can create tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = customer_id AND public.has_role(auth.uid(), 'employer'::public.app_role));

DROP POLICY IF EXISTS "Employers can update own tasks" ON public.tasks;
CREATE POLICY "Employers can update own tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (auth.uid() = customer_id AND public.has_role(auth.uid(), 'employer'::public.app_role));

-- Task payments table
CREATE TABLE IF NOT EXISTS public.task_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  employer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  payment_method text NOT NULL DEFAULT 'stripe',
  status text NOT NULL DEFAULT 'pending', -- pending | paid | failed | refunded
  reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_payments_employer ON public.task_payments(employer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_payments_task ON public.task_payments(task_id);

GRANT SELECT, INSERT, UPDATE ON public.task_payments TO authenticated;
GRANT ALL ON public.task_payments TO service_role;

ALTER TABLE public.task_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employers view own job payments" ON public.task_payments
  FOR SELECT USING (auth.uid() = employer_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Employers create own job payments" ON public.task_payments
  FOR INSERT WITH CHECK (auth.uid() = employer_id);
CREATE POLICY "Employers update own pending payments" ON public.task_payments
  FOR UPDATE USING (auth.uid() = employer_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = employer_id OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_task_payments_updated
  BEFORE UPDATE ON public.task_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
