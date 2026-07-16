ALTER TABLE public.vendor_services
ADD COLUMN subcategory_id uuid REFERENCES public.service_subcategories(id) ON DELETE SET NULL;