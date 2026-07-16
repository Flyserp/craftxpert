import { useState } from "react";
import { z } from "zod";
import { LifeBuoy, MessageSquare, AlertTriangle, Sparkles, HelpCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ReportIssueModal from "@/components/disputes/ReportIssueModal";
import { Heading } from "@/components/ui/app";

const FAQS = [
  { q: "How do I book a service?", a: "Browse providers or services, open a profile, pick a date and time, then confirm. You'll get a confirmation in Notifications and email." },
  { q: "How do payments work?", a: "Payments are processed securely. A 25% deposit may be charged at booking and the remainder once the job is complete." },
  { q: "How do I become a verified provider?", a: "Open Provider Verification, upload your ID and required documents, and our team reviews within 1-2 business days." },
  { q: "How do I cancel or reschedule?", a: "Go to My Bookings, open the booking, and use Cancel or Request reschedule. Cancellation fees may apply close to the start time." },
  { q: "How do refunds work?", a: "Open the booking and submit a Refund request. Approved refunds are credited to your wallet, typically within 24 hours." },
  { q: "How do I contact a provider?", a: "Use the Message button on any provider profile or inside an active booking to chat in real time." },
];

const messageSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  subject: z.string().trim().min(3, "Subject is too short").max(150),
  message: z.string().trim().min(10, "Please add a bit more detail").max(2000),
});

function MessageForm({ kind }: { kind: "contact" | "feedback" }) {
  const { user, profile } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const parsed = messageSchema.safeParse({ name, email, subject, message });
    if (!parsed.success) {
      return toast.error(parsed.error.issues[0].message);
    }
    setSaving(true);
    const prefix = kind === "feedback" ? "[Feedback] " : "";
    const { error } = await supabase.from("contact_messages").insert({
      name: parsed.data.name,
      email: parsed.data.email,
      subject: prefix + parsed.data.subject,
      message: parsed.data.message,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(kind === "feedback" ? "Thanks for the feedback!" : "Message sent. We'll be in touch.");
    setSubject(""); setMessage("");
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${kind}-name`}>Name</Label>
          <Input id={`${kind}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${kind}-email`}>Email</Label>
          <Input id={`${kind}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${kind}-subject`}>Subject</Label>
        <Input id={`${kind}-subject`} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150}
          placeholder={kind === "feedback" ? "What would you like to share?" : "How can we help?"} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${kind}-message`}>Message</Label>
        <Textarea id={`${kind}-message`} rows={6} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
        <p className="text-xs text-muted-foreground">{message.length}/2000</p>
      </div>
      <Button onClick={submit} disabled={saving}>
        {saving ? "Sending…" : kind === "feedback" ? "Submit feedback" : "Send message"}
      </Button>
    </div>
  );
}

export default function HelpSupportPage() {
  const [reportOpen, setReportOpen] = useState(false);
  const { user } = useAuth();

  return (
    <main className="container max-w-4xl py-10 space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-eyebrow">
          <LifeBuoy className="h-4 w-4" /> Help center
        </div>
        <Heading level={1} >How can we help?</Heading>
        <p className="text-lead text-muted-foreground">
          Browse common questions, get in touch with support, report an issue, or share feedback.
        </p>
      </header>

      <Tabs defaultValue="faq" className="space-y-6">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="faq"><HelpCircle className="mr-2 h-4 w-4" />FAQ</TabsTrigger>
          <TabsTrigger value="contact"><MessageSquare className="mr-2 h-4 w-4" />Contact</TabsTrigger>
          <TabsTrigger value="report"><AlertTriangle className="mr-2 h-4 w-4" />Report issue</TabsTrigger>
          <TabsTrigger value="feedback"><Sparkles className="mr-2 h-4 w-4" />Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="faq">
          <Card>
            <CardHeader>
              <CardTitle>Frequently asked questions</CardTitle>
              <CardDescription>Quick answers to the most common questions.</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {FAQS.map((f, i) => (
                  <AccordionItem key={i} value={`f-${i}`}>
                    <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                    <AccordionContent>{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact">
          <Card>
            <CardHeader>
              <CardTitle>Contact support</CardTitle>
              <CardDescription>We typically reply within one business day.</CardDescription>
            </CardHeader>
            <CardContent><MessageForm kind="contact" /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report">
          <Card>
            <CardHeader>
              <CardTitle>Report an issue</CardTitle>
              <CardDescription>
                Report a problem with a booking, a user, or platform behavior. Our moderation team reviews every report.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user ? (
                <Button onClick={() => setReportOpen(true)} variant="destructive">
                  <AlertTriangle className="mr-2 h-4 w-4" /> Open report form
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">Please sign in to file a report so we can follow up with you.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback">
          <Card>
            <CardHeader>
              <CardTitle>Submit feedback</CardTitle>
              <CardDescription>Ideas, suggestions, or things we could do better — we read every message.</CardDescription>
            </CardHeader>
            <CardContent><MessageForm kind="feedback" /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ReportIssueModal open={reportOpen} onOpenChange={setReportOpen} />
    </main>
  );
}