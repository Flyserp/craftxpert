import { Zap, Users, BarChart3, Globe, CreditCard, Bell, Shield, Layers } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { usePwaBranding } from "@/hooks/usePwaBranding";
import { Heading } from "@/components/ui/app";

const features = [
  {
    icon: Zap,
    title: "AI Smart Matching",
    desc: "Our algorithm pairs you with the best provider based on location, rating, availability, and job complexity.",
    accent: "from-primary/10 to-primary/5",
  },
  {
    icon: Shield,
    title: "Verified Professionals",
    desc: "Every pro is background-checked and insured. We vet credentials so you don't have to worry.",
    accent: "from-emerald-500/10 to-emerald-500/5",
  },
  {
    icon: CreditCard,
    title: "Secure Payments",
    desc: "Pay securely through the platform with automated invoicing, receipts, and transparent pricing.",
    accent: "from-blue-500/10 to-blue-500/5",
  },
  {
    icon: Globe,
    title: "Multi-Tenant Platform",
    desc: "Launch your own branded marketplace with custom branding, independent providers, and full control.",
    accent: "from-violet-500/10 to-violet-500/5",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    desc: "Track revenue, bookings, provider performance, and customer satisfaction from a single dashboard.",
    accent: "from-amber-500/10 to-amber-500/5",
  },
  {
    icon: Bell,
    title: "Instant Notifications",
    desc: "Stay updated with real-time booking confirmations, reminders, and status updates in-app.",
    accent: "from-rose-500/10 to-rose-500/5",
  },
];

const FeaturesSection = () => {
  const headerRef = useScrollReveal();
  const gridRef = useScrollReveal({ staggerChildren: "[data-feature]", staggerDelay: 100 });
  const { siteName } = usePwaBranding();
  const brand = siteName || "TaskHive";

  return (
    <section id="features" className="py-24 md:py-32 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 0.5px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="container-app relative">
        <div className="text-center max-w-2xl mx-auto mb-16" ref={headerRef}>
          <p className="text-eyebrow mb-3">Why Choose {brand}</p>
          <Heading level={2}  className="lg:text-[2.75rem] mb-5">
            Everything you need to get the{" "}
            <span className="text-accent">job done right</span>
          </Heading>
          <p className="text-lead">
            From finding the perfect pro to paying securely — {brand} handles every step so you can focus on what matters.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" ref={gridRef}>
          {features.map((f) => (
            <div
              key={f.title}
              data-feature
              className="group relative p-7 rounded-sm bg-card border border-border/60 hover:border-primary/30 transition-all duration-300 overflow-hidden"
            >
              {/* Gradient accent on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${f.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10`} />

              <div className="w-14 h-14 rounded-sm bg-primary/8 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-primary/12 transition-all duration-300">
                <f.icon className="w-6 h-6 text-primary" />
              </div>
              <Heading level={3}  className="mb-2">{f.title}</Heading>
              <p className="text-description-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
