
ALTER TABLE public.tasks DROP CONSTRAINT tasks_category_id_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.service_categories(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.tasks DROP CONSTRAINT tasks_subcategory_id_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_subcategory_id_fkey
  FOREIGN KEY (subcategory_id) REFERENCES public.service_subcategories(id) ON DELETE SET NULL ON UPDATE CASCADE;
