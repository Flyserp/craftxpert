import { useState } from "react";
import { z } from "zod";
import { Mail, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Heading } from "@/components/ui/app";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().trim().email("Invalid email").max(255),
  subject: z.string().trim().min(1, "Subject is required").max(200, "Subject too long"),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(5000, "Message too long"),
});

const ContactSection = () => {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        if (i.path[0]) fieldErrors[i.path[0] as string] = i.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("contact_messages").insert({
      name: parsed.data.name,
      email: parsed.data.email,
      subject: parsed.data.subject,
      message: parsed.data.message,
      user_agent: navigator.userAgent.slice(0, 500),
    });
    setSubmitting(false);

    if (error) {
      toast.error("Could not send message. Please try again.");
      return;
    }

    setSent(true);
    setForm({ name: "", email: "", subject: "", message: "" });
    toast.success("Message sent! We'll get back to you soon.");
  };

  return (
    <section id="contact" className="py-20 bg-secondary/30">
      <div className="container-app">
        <div className="grid lg:grid-cols-2 gap-12 items-start max-w-6xl mx-auto">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 text-fs-xs font-medium text-accent-foreground mb-4">
              <Mail className="w-3.5 h-3.5" /> Get in touch
            </div>
            <Heading level={2}  className="mb-4">
              Have a question?<br />
              <span className="text-accent">We're here to help.</span>
            </Heading>
            <p className="text-body text-fs-base leading-relaxed mb-6">
              Reach out about partnerships, support, press inquiries, or anything else.
              Our team typically replies within 24 hours.
            </p>
            <ul className="space-y-3 text-fs-sm">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Direct line to our customer success team</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Average response time under 24 hours</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Confidential — your details stay private</span>
              </li>
            </ul>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-card border border-border rounded-sm p-6 md:p-8 space-y-4"
            aria-label="Contact form"
          >
            {sent && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center gap-2 text-fs-sm">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>Thanks! We received your message.</span>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contact-name">Name</Label>
                <Input
                  id="contact-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  maxLength={100}
                  required
                  className="mt-1.5"
                />
                {errors.name && <p className="text-fs-xs text-destructive mt-1">{errors.name}</p>}
              </div>
              <div>
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  maxLength={255}
                  required
                  className="mt-1.5"
                />
                {errors.email && <p className="text-fs-xs text-destructive mt-1">{errors.email}</p>}
              </div>
            </div>
            <div>
              <Label htmlFor="contact-subject">Subject</Label>
              <Input
                id="contact-subject"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                maxLength={200}
                required
                className="mt-1.5"
              />
              {errors.subject && <p className="text-fs-xs text-destructive mt-1">{errors.subject}</p>}
            </div>
            <div>
              <Label htmlFor="contact-message">Message</Label>
              <Textarea
                id="contact-message"
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                maxLength={5000}
                required
                className="mt-1.5 resize-none"
              />
              {errors.message && <p className="text-fs-xs text-destructive mt-1">{errors.message}</p>}
              <p className="text-fs-xs text-muted-foreground mt-1 text-right">
                {form.message.length}/5000
              </p>
            </div>
            <Button type="submit" disabled={submitting} className="w-full gap-2 h-12 px-4 ">
              <Send className="w-4 h-4" />
              {submitting ? "Sending…" : "Send message"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
