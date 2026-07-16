ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_size integer;

CREATE INDEX IF NOT EXISTS messages_reply_to_id_idx ON public.messages(reply_to_id);