import { ShieldCheck, UserCheck, Lock, BadgeCheck, FileCheck, HeartHandshake } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import trustShield from "@/assets/trust-shield.png";
import { usePwaBranding } from "@/hooks/usePwaBranding";
import { Heading } from "@/components/ui/app";

const trustItems = [
  {
    icon: UserCheck,
    title: "Background-Checked Pros",
    desc: "Every professional undergoes thorough identity verification, criminal background checks, and credential validation before joining.",
  },
  {
    icon: ShieldCheck,
    title: "Fully Insured",
    desc: "All service providers carry liability insurance, so you're protected against accidental property damage during any job.",
  },
  {
    icon: Lock,
    title: "Secure Payments",
    desc: "Your payment details are encrypted end-to-end. Funds are held securely until the job is completed to your satisfaction.",
  },
  {
    icon: BadgeCheck,
    title: "Verified Reviews",
    desc: "Only customers who completed a booking can leave reviews — ensuring every rating is genuine and trustworthy.",
  },
  {
    icon: FileCheck,
    title: "Service Guarantee",
    desc: "Not satisfied? We'll send another pro or refund your payment. Your happiness is backed by our satisfaction guarantee.",
  },
  {
    icon: HeartHandshake,
    title: "24/7 Support",
    desc: "Our dedicated support team is available around the clock to help resolve any issues quickly and fairly.",
  },
];

const TrustSecuritySection = () => {
  const headerRef = useScrollReveal();
  const gridRef = useScrollReveal({ staggerChildren: "[data-trust]", staggerDelay: 120 });
  const { siteName } = usePwaBranding();
  const brand = siteName || "TaskHive";

  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 surface-warm" />
      <div
        className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full opacity-[0.04] pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)), transparent 70%)" }}
      />

      <div className="container-app relative">
        <div className="text-center max-w-2xl mx-auto mb-16" ref={headerRef}>
          <img src={trustShield} alt="Security shield" width={80} height={80} loading="lazy" className="mx-auto mb-5" />
          <p className="text-eyebrow mb-3">Trust & Safety</p>
          <Heading level={2}  className="lg:text-[2.75rem] mb-5">
            Your safety is our{" "}
            <span className="text-accent">top priority</span>
          </Heading>
          <p className="text-lead">
            We go above and beyond to ensure every interaction on {brand} is safe, secure, and transparent.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" ref={gridRef}>
          {trustItems.map((item) => (
            <div
              key={item.title}
              data-trust
              className="group bg-card rounded-sm border border-border p-7 hover:border-primary/30 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-sm bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors duration-300">
                <item.icon className="w-6 h-6 text-primary" />
              </div>
              <Heading level={3}  className="mb-2">{item.title}</Heading>
              <p className="text-description-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSecuritySection;
