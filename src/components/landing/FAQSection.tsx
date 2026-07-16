import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { usePwaBranding } from "@/hooks/usePwaBranding";
import { Heading } from "@/components/ui/app";

const makeFaqs = (brand: string) => [
  {
    q: `How does ${brand} match me with the right professional?`,
    a: "Our AI-powered algorithm considers your job type, location, budget, and scheduling preferences — then ranks available pros by rating, experience, and proximity so you get the best match in seconds.",
  },
  {
    q: `Are all professionals on ${brand} verified?`,
    a: "Yes. Every professional goes through identity verification, background checks, and license/insurance validation before they can accept bookings. Look for the green verified badge on their profile.",
  },
  {
    q: "How do I pay for a service?",
    a: `You can pay securely through the platform using credit/debit cards, digital wallets, or your ${brand} wallet balance. Payment is only released to the professional after you confirm the job is complete.`,
  },
  {
    q: "What if I'm not satisfied with the work?",
    a: "We offer a satisfaction guarantee. If the work doesn't meet the agreed scope, you can request a revision or file a refund request through your dashboard — our support team will review it within 24 hours.",
  },
  {
    q: "Can I book a professional for a recurring service?",
    a: "Absolutely. When booking, you can set up weekly, bi-weekly, or monthly recurring appointments. You'll get the same trusted pro each time, and you can cancel or reschedule anytime.",
  },
  {
    q: `How much does it cost to use ${brand}?`,
    a: "Signing up and browsing professionals is completely free. You only pay for the services you book, with transparent pricing shown upfront — no hidden fees or surprise charges.",
  },
];

const FAQSection = () => {
  const headerRef = useScrollReveal();
  const contentRef = useScrollReveal();
  const { siteName } = usePwaBranding();
  const brand = siteName || "TaskHive";
  const faqs = makeFaqs(brand);

  return (
    <section className="py-24 md:py-32 relative">
      <div className="container-app">
        <div className="text-center max-w-2xl mx-auto mb-14" ref={headerRef}>
          <p className="text-eyebrow mb-3">
            FAQ
          </p>
          <Heading level={2}  className="lg:text-[2.75rem] mb-5">
            Frequently asked <span className="text-accent">questions</span>
          </Heading>
          <p className="text-lead">
            Everything you need to know about using {brand}.
          </p>
        </div>

        <div className="max-w-3xl mx-auto" ref={contentRef}>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="bg-card border border-border/60 rounded-sm px-6 data-[state=open]:border-primary/20 transition-all duration-300"
              >
                <AccordionTrigger className="text-left text-fs-sm sm:text-fs-base font-semibold text-heading hover:text-primary py-5 [&>svg]:text-primary">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-description-sm pb-5">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
