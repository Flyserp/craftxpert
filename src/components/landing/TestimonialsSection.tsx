import { Quote } from "lucide-react";
import { StarRating } from "@/components/ui/StarRating";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useHomepageContent } from "@/hooks/useHomepageContent";
import { usePwaBranding } from "@/hooks/usePwaBranding";
import { Heading } from "@/components/ui/app";

const TestimonialsSection = () => {
  const headerRef = useScrollReveal();
  const gridRef = useScrollReveal({ staggerChildren: "[data-testimonial]", staggerDelay: 120 });
  const { content } = useHomepageContent();
  const testimonials = content.testimonials;
  const { siteName } = usePwaBranding();
  const brand = siteName || "TaskHive";

  return (
    <section className="py-24 md:py-32 surface-warm relative overflow-hidden">
      <div
        className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-[0.05] pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--accent)), transparent 70%)" }}
      />

      <div className="container-app relative">
        <div className="text-center max-w-2xl mx-auto mb-14" ref={headerRef}>
          <p className="text-eyebrow mb-3">Testimonials</p>
          <Heading level={2}  className="lg:text-[2.75rem] mb-5">
            What our <span className="text-accent">customers</span> say
          </Heading>
          <p className="text-lead">
            Thousands of homeowners trust {brand} to connect them with the best professionals.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6" ref={gridRef}>
          {testimonials.map((t, idx) => (
            <div
              key={`${t.name}-${idx}`}
              data-testimonial
              className="group bg-card rounded-sm border border-border p-7 hover:border-primary/20 transition-all duration-300 relative"
            >
              <Quote className="absolute top-5 right-5 w-8 h-8 text-primary/[0.06]" />

              <div className="mb-5">
                <StarRating count={t.rating} size="md" />
              </div>

              <p className="text-description-sm mb-6">&ldquo;{t.text}&rdquo;</p>

              <div className="flex items-center gap-3 pt-5 border-t border-border/40">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-fs-xs font-bold text-primary ring-1 ring-primary/20">
                  {t.initials}
                </div>
                <div>
                  <p className="text-fs-sm font-semibold text-heading">{t.name}</p>
                  <p className="text-fs-xs text-muted-foreground">{t.role} · {t.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
