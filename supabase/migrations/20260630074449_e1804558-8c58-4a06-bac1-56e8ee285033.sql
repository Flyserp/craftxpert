ALTER TABLE public.content_reports DROP CONSTRAINT content_reports_entity_type_check;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_entity_type_check
  CHECK (entity_type = ANY (ARRAY['review','message','task','profile','service','portfolio','verification']));