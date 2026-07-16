
CREATE TABLE public.cms_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  meta_description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published pages are viewable by everyone"
ON public.cms_pages FOR SELECT
USING (status = 'published');

CREATE POLICY "Admins can manage all cms pages"
ON public.cms_pages FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_cms_pages_updated_at
BEFORE UPDATE ON public.cms_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default pages
INSERT INTO public.cms_pages (title, slug, content, status, sort_order) VALUES
('About Us', 'about', '# About Us

Welcome to TaskHive — the modern marketplace connecting customers with trusted service professionals.

## Our Mission

We believe everyone deserves access to reliable, high-quality services. TaskHive makes it easy to find, book, and pay for professional services in your area.

## How It Works

1. **Browse** — Search our curated network of verified professionals
2. **Book** — Schedule services at your convenience
3. **Pay** — Secure payments with transparent pricing
4. **Review** — Share your experience to help others', 'published', 1),

('Frequently Asked Questions', 'faq', '# Frequently Asked Questions

## General

**What is TaskHive?**
TaskHive is a service marketplace that connects customers with vetted professionals for home services, repairs, and more.

**How do I book a service?**
Browse available services, select a professional, choose a date and time, and confirm your booking.

**Is there a fee to use TaskHive?**
Creating an account and browsing is free. You only pay when you book a service.

## For Customers

**How are professionals vetted?**
All professionals go through an application and approval process before they can offer services on our platform.

**What if I need to cancel?**
You can cancel a booking from your dashboard. Cancellation policies vary by service provider.

## For Professionals

**How do I become a vendor?**
Sign up as a vendor, complete your profile, and submit your application for review.

**How do I get paid?**
Earnings from completed bookings are available for withdrawal through your vendor dashboard.', 'published', 2),

('Terms of Service', 'terms', '# Terms of Service

*Last updated: April 2026*

By using TaskHive, you agree to these terms. Please read them carefully.

## 1. Acceptance of Terms
By accessing or using our platform, you agree to be bound by these Terms of Service.

## 2. User Accounts
You must provide accurate information when creating an account. You are responsible for maintaining the security of your account.

## 3. Services
TaskHive is a marketplace connecting customers with service professionals. We do not directly provide services.

## 4. Payments
All payments are processed securely through our platform. Pricing is set by individual service providers.

## 5. Cancellations & Refunds
Cancellation and refund policies are outlined in our Refund Policy. Disputes are handled through our support team.

## 6. Limitation of Liability
TaskHive provides the platform "as is" and is not liable for the quality of services provided by vendors.', 'published', 3),

('Privacy Policy', 'privacy', '# Privacy Policy

*Last updated: April 2026*

Your privacy is important to us. This policy explains how we collect, use, and protect your information.

## Information We Collect
- Account information (name, email, phone)
- Booking and transaction history
- Usage data and analytics

## How We Use Your Information
- To provide and improve our services
- To process bookings and payments
- To communicate with you about your account

## Data Security
We use industry-standard encryption and security measures to protect your data.

## Your Rights
You can access, update, or delete your personal information at any time through your account settings.', 'published', 4);
