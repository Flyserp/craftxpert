import { Search, CalendarCheck, ThumbsUp, ArrowRight, Sparkles, CreditCard } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { usePwaBranding } from "@/hooks/usePwaBranding";
import { Heading } from "@/components/ui/app";

const steps = [
  {
    icon: Search,
    step: "01",
    title: "Describe Your Job",
    desc: "Tell us what you need — plumbing, electrical, painting, or any home service. Add photos and preferred timing for faster matching.",
    highlights: ["Any service type", "Photo upload", "Flexible scheduling"],
  },
  {
    icon: Sparkles,
    step: "02",
    title: "Get AI-Matched",
    desc: "Our smart algorithm instantly finds top-rated, available professionals near you — ranked by skill, reviews, and proximity.",
    highlights: ["Instant matching", "Verified pros", "Compare & choose"],
  },
  {
    icon: CalendarCheck,
    step: "03",
    title: "Confirm & Book",
    desc: "Pick your preferred date and time, review transparent pricing, and book in one tap. Your pro is confirmed instantly.",
    highlights: ["Real-time slots", "Upfront pricing", "Instant confirmation"],
  },
  {
    icon: ThumbsUp,
    step: "04",
    title: "Job Done, Pay Securely",
    desc: "Your pro arrives on schedule and completes the work. Pay securely through the app and rate your experience.",
    highlights: ["On-time arrival", "Secure payment", "Satisfaction guarantee"],
  },
];

const HowItWorksSection = () => {
  const headerRef = useScrollReveal();
  const stepsRef = useScrollReveal({ staggerChildren: "[data-step]", staggerDelay: 150 });
  const { siteName } = usePwaBranding();
  const brand = siteName || "TaskHive";

  return (
    <section id="how-it-works" className="py-24 md:py-32 surface-warm relative overflow-hidden">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-[0.04] pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)), transparent 70%)" }}
      />

      <div className="container-app relative">
        <div className="text-center max-w-2xl mx-auto mb-16" ref={headerRef}>
          <p className="text-eyebrow mb-3">How It Works</p>
          <Heading level={2}  className="lg:text-[2.75rem] mb-5">
            From request to done in{" "}
            <span className="text-accent">four simple steps</span>
          </Heading>
          <p className="text-lead">
            No more hunting for reliable help. {brand} streamlines the entire process.
          </p>
        </div>

        <div className="relative" ref={stepsRef}>
          {/* Connecting line */}
          <div className="hidden lg:block absolute top-16 left-[12.5%] right-[12.5%] h-px border-t-2 border-dashed border-primary/20" />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {steps.map((s, i) => (
              <div key={s.step} data-step className="relative group">
                {/* Step card */}
                <div className="bg-card rounded-sm border border-border p-6 transition-all duration-300 h-full flex flex-col">
                  {/* Icon + number */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="relative w-14 h-14 rounded-sm bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors duration-300">
                      <s.icon className="w-6 h-6 text-primary" />
                    </div>
                    <span className="text-fs-4xl font-bold text-primary/10 group-hover:text-primary/20 transition-colors duration-300 leading-none">
                      {s.step}
                    </span>
                  </div>

                  {/* Content */}
                  <Heading level={3}  className="mb-2">{s.title}</Heading>
                  <p className="text-description-sm mb-4 flex-1">{s.desc}</p>

                  {/* Highlight chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {s.highlights.map((h) => (
                      <span
                        key={h}
                        className="text-[13px] font-medium text-primary bg-primary/8 rounded-full px-2.5 py-1 border border-primary/10"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Arrow connector (between cards on lg) */}
                {i < steps.length - 1 && (
                  <ArrowRight className="hidden lg:block absolute top-10 -right-3 w-5 h-5 text-primary/25 z-10" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
