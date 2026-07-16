import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { usePwaBranding } from "@/hooks/usePwaBranding";
import { Heading } from "@/components/ui/app";

const CTASection = () => {
  const ref = useScrollReveal();
  const { siteName } = usePwaBranding();
  const brand = siteName || "TaskHive";

  return (
    <section className="py-24 md:py-32" ref={ref}>
      <div className="container-app">
        <div className="relative rounded-sm bg-primary overflow-hidden px-8 py-18 md:px-16 md:py-24 text-center">
          {/* Pattern */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--primary-foreground)) 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* Gradient orbs */}
          <div className="absolute top-0 left-0 w-72 h-72 rounded-full bg-primary-foreground/5 blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-primary-foreground/5 blur-3xl translate-x-1/3 translate-y-1/3" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-foreground/30 to-transparent" />

          <div className="relative max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-7 border border-primary-foreground/10">
              <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
              <span className="text-fs-xs font-semibold text-primary-foreground/90">Start free, upgrade anytime</span>
            </div>

            <Heading level={2}  className="lg:text-[2.75rem] text-primary-foreground mb-5">
              Ready to get your home the care it deserves?
            </Heading>
            <p className="text-primary-foreground/80 text-fs-lg mb-10 leading-relaxed max-w-xl mx-auto">
              Join thousands of homeowners who trust {brand} to find reliable, verified professionals for every job.
            </p>

            {/* Benefit pills */}
            <div className="flex flex-wrap justify-center gap-3 mb-10">
              {["No signup fees", "Cancel anytime", "Satisfaction guaranteed"].map((b) => (
                <div key={b} className="flex items-center gap-1.5 bg-primary-foreground/10 backdrop-blur-sm rounded-full px-4 py-2 border border-primary-foreground/10">
                  <CheckCircle className="w-3.5 h-3.5 text-primary-foreground/80" />
                  <span className="text-fs-xs font-medium text-primary-foreground/90">{b}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/signup">
                <Button
                  variant="hero-outline"
                  size="xl"
                  className="h-12 px-4 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground hover:text-primary group/cta"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4 group-hover/cta:translate-x-0.5 transition-transform" />
                </Button>
              </Link>
              <Link to="/browse">
                <Button variant="ghost" size="xl" className="h-12 px-4 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10">
                  Browse Professionals
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
