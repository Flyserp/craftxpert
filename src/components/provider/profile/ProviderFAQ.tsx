import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";
import { Heading } from "@/components/ui/app";

interface ProviderFAQProps {
  providerName: string;
  hasAvailability: boolean;
  acceptsMessages: boolean;
}

export default function ProviderFAQ({
  providerName, hasAvailability, acceptsMessages,
}: ProviderFAQProps) {
  const firstName = providerName.split(" ")[0];

  const items: { q: string; a: string }[] = [
    {
      q: "How do I book this professional?",
      a: hasAvailability
        ? `Pick a date and time slot from the booking panel and tap Book Now. ${firstName} will confirm and you'll see the booking in My Bookings.`
        : `Tap Book Now to start the booking flow. ${firstName} will share their available slots once they review your request.`,
    },
    {
      q: "When am I charged?",
      a: "You aren't charged until checkout. You can choose a 25% deposit or pay in full. Funds are held safely and only released to the pro after the job is complete.",
    },
    {
      q: "Can I message before booking?",
      a: acceptsMessages
        ? `Yes — use the Message button to ask about scope, pricing or timing. ${firstName} typically replies within a few hours.`
        : `Messaging is available once you have an active customer account.`,
    },
    {
      q: "What if I need to cancel or reschedule?",
      a: "You can reschedule from My Bookings any time before the job starts. Cancellations follow the platform refund policy — most cancellations made 24h+ in advance receive a full refund.",
    },
    {
      q: "Are reviews verified?",
      a: "Yes. Only customers with a completed booking can leave a review, and providers can reply but never delete reviews.",
    },
    {
      q: "Is my payment protected?",
      a: "Every booking is covered by our payment protection. If the job isn't delivered as described, open a dispute and our team will review the case.",
    },
  ];

  return (
    <div className="bg-card rounded-sm border border-border p-6">
      <Heading level={2}  className="flex items-center gap-2 mb-1">
        <HelpCircle className="w-4 h-4 text-primary" /> Frequently asked questions
      </Heading>
      <p className="text-fs-xs text-muted-foreground mb-4">
        Quick answers about booking, payments and policies.
      </p>
      <Accordion type="single" collapsible className="w-full">
        {items.map((item, i) => (
          <AccordionItem key={i} value={`item-${i}`} className="border-border/60">
            <AccordionTrigger className="text-fs-sm text-left hover:no-underline">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="text-fs-sm text-body leading-relaxed">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
