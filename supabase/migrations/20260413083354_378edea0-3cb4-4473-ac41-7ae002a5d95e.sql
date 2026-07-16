
-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES public.service_categories(id),
  subcategory_id UUID REFERENCES public.service_subcategories(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  photos TEXT[] DEFAULT '{}',
  preferred_date DATE,
  preferred_time TEXT,
  address TEXT NOT NULL,
  budget_min NUMERIC,
  budget_max NUMERIC,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can create tasks"
ON public.tasks FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = customer_id AND has_role(auth.uid(), 'customer'::app_role));

CREATE POLICY "Customers can view own tasks"
ON public.tasks FOR SELECT
TO authenticated
USING (auth.uid() = customer_id);

CREATE POLICY "Customers can update own tasks"
ON public.tasks FOR UPDATE
TO authenticated
USING (auth.uid() = customer_id AND has_role(auth.uid(), 'customer'::app_role));

CREATE POLICY "Vendors can view open tasks"
ON public.tasks FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'vendor'::app_role) AND status = 'open');

CREATE POLICY "Moderators can view all tasks"
ON public.tasks FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role));

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create task-photos storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('task-photos', 'task-photos', true);

CREATE POLICY "Anyone can view task photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-photos');

CREATE POLICY "Authenticated users can upload task photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own task photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
