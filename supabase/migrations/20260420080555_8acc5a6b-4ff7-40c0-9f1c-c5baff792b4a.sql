-- Contact messages table
CREATE TABLE public.contact_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  admin_reply TEXT,
  replied_at TIMESTAMP WITH TIME ZONE,
  replied_by UUID,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT contact_messages_status_check CHECK (status IN ('new','read','archived','replied')),
  CONSTRAINT contact_messages_name_len CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT contact_messages_email_len CHECK (char_length(email) BETWEEN 3 AND 255),
  CONSTRAINT contact_messages_subject_len CHECK (char_length(subject) BETWEEN 1 AND 200),
  CONSTRAINT contact_messages_message_len CHECK (char_length(message) BETWEEN 1 AND 5000)
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can submit
CREATE POLICY "Anyone can submit a contact message"
ON public.contact_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'new'
  AND admin_reply IS NULL
  AND replied_at IS NULL
  AND replied_by IS NULL
);

-- Only admins can read
CREATE POLICY "Admins can view contact messages"
ON public.contact_messages
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update (status, reply, etc.)
CREATE POLICY "Admins can update contact messages"
ON public.contact_messages
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Auto-update updated_at
CREATE TRIGGER update_contact_messages_updated_at
BEFORE UPDATE ON public.contact_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_contact_messages_status_created ON public.contact_messages (status, created_at DESC);