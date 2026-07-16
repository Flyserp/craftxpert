CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  variables TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT email_templates_key_format CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT email_templates_subject_len CHECK (char_length(subject) BETWEEN 1 AND 300),
  CONSTRAINT email_templates_body_len CHECK (char_length(body_html) BETWEEN 0 AND 50000)
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email templates"
ON public.email_templates
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the four default templates
INSERT INTO public.email_templates (key, name, description, subject, body_html, variables) VALUES
  (
    'booking_confirmation',
    'Booking Confirmation',
    'Sent to a customer right after they successfully book a service.',
    'Your booking is confirmed — {{service_title}}',
    '<p>Hi {{customer_name}},</p>
<p>Your booking for <strong>{{service_title}}</strong> with {{vendor_name}} is confirmed.</p>
<p><strong>When:</strong> {{booking_date}} at {{start_time}}<br/>
<strong>Total:</strong> ${{total_price}}</p>
<p>You can manage this booking from your dashboard.</p>
<p>Thanks for choosing us!</p>',
    ARRAY['customer_name','vendor_name','service_title','booking_date','start_time','total_price']
  ),
  (
    'password_reset',
    'Password Reset',
    'Sent when a user requests a password reset link.',
    'Reset your password',
    '<p>Hi {{user_name}},</p>
<p>We received a request to reset your password. Click the link below to choose a new one:</p>
<p><a href="{{reset_url}}">Reset password</a></p>
<p>This link expires in 1 hour. If you didn''t request this, you can safely ignore this email.</p>',
    ARRAY['user_name','reset_url']
  ),
  (
    'welcome',
    'Welcome Email',
    'Sent to new users right after they sign up.',
    'Welcome to {{app_name}}!',
    '<p>Hi {{user_name}},</p>
<p>Welcome to {{app_name}} — we''re glad to have you.</p>
<p>Get started by exploring services or completing your profile.</p>
<p><a href="{{dashboard_url}}">Open your dashboard</a></p>',
    ARRAY['user_name','app_name','dashboard_url']
  ),
  (
    'refund_approved',
    'Refund Approved',
    'Sent to a customer when an admin approves their refund request.',
    'Your refund of ${{amount}} has been approved',
    '<p>Hi {{customer_name}},</p>
<p>Good news — your refund of <strong>${{amount}}</strong> for booking #{{booking_id}} has been approved and credited to your wallet.</p>
<p>You can use your wallet balance toward your next booking.</p>',
    ARRAY['customer_name','amount','booking_id']
  );