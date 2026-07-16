import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, ShieldCheck, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { usePwaBranding } from "@/hooks/usePwaBranding";
import { Heading } from "@/components/ui/app";

const perks = [
  { icon: Clock, label: "Setup in 60 seconds" },
  { icon: ShieldCheck, label: "Verified badge" },
  { icon: TrendingUp, label: "Reach thousands" },
];

const PostServiceBanner = () => {
  const ref = useScrollReveal();
  const { siteName } = usePwaBranding();
  const brand = siteName || "TaskHive";

  return (
    <section className="py-20 md:py-28 relative overflow-hidden" ref={ref}>
      <div className="container-app">
        <div className="relative rounded-sm overflow-hidden">
          {/* Split layout */}
          <div className="grid lg:grid-cols-2 items-center">
            {/* Left – illustration / decorative */}
            <div className="relative bg-primary/[0.06] p-10 md:p-14 lg:p-16 hidden lg:flex flex-col justify-center min-h-[360px]">
              <div className="absolute inset-0 opacity-[0.04]" style={{
                backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--primary)) 1px, transparent 0)",
                backgroundSize: "20px 20px",
              }} />

              {/* Floating stat cards */}
              <div className="relative space-y-4">
                <div className="bg-card rounded-sm border border-border p-5 max-w-[280px] animate-fade-in" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
                  <p className="text-fs-3xl font-bold text-heading">2,500+</p>
                  <p className="text-fs-sm text-muted-foreground mt-1">Professionals already earning on {brand}</p>
                </div>

                <div className="bg-card rounded-sm border border-border p-5 max-w-[260px] ml-auto animate-fade-in" style={{ animationDelay: "250ms", animationFillMode: "both" }}>
                  <p className="text-fs-3xl font-bold text-primary">$12K</p>
                  <p className="text-fs-sm text-muted-foreground mt-1">Average monthly earnings for top providers</p>
                </div>

                <div className="bg-card rounded-sm border border-border p-5 max-w-[240px] animate-fade-in" style={{ animationDelay: "400ms", animationFillMode: "both" }}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-fs-sm font-semibold text-heading">98% satisfaction</p>
                      <p className="text-fs-xs text-muted-foreground">From verified reviews</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right – CTA content */}
            <div className="bg-primary p-10 md:p-14 lg:p-16 relative">
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--primary-foreground)) 1px, transparent 0)",
                backgroundSize: "24px 24px",
              }} />
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-primary-foreground/5 blur-3xl translate-x-1/3 -translate-y-1/3" />

              <div className="relative">
                <p className="text-eyebrow mb-3 !text-primary-foreground/70 text-fs-xs">
                  For Professionals
                </p>
                <Heading level={2}  className="text-primary-foreground mb-4">
                  Post your service in&nbsp;a&nbsp;minute
                </Heading>
                <p className="text-primary-foreground/80 text-fs-base leading-relaxed mb-8 max-w-md">
                  Create your profile, list your services, and start receiving bookings from customers in your area — all in under 60 seconds.
                </p>

                {/* Perk pills */}
                <div className="flex flex-wrap gap-3 mb-9">
                  {perks.map((p) => (
                    <div key={p.label} className="flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm rounded-full px-4 py-2 border border-primary-foreground/10">
                      <p.icon className="w-3.5 h-3.5 text-primary-foreground/80" />
                      <span className="text-fs-xs font-medium text-primary-foreground/90">{p.label}</span>
                    </div>
                  ))}
                </div>

                <Link to="/signup">
                  <Button
                    variant="hero-outline"
                    size="xl"
                    className="h-12 px-4 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground hover:text-primary group/btn"
                  >
                    Get Started Free
                    <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PostServiceBanner;
