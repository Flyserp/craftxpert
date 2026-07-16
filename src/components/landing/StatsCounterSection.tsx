import { Users, Briefcase, Star, Globe } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useHomepageContent } from "@/hooks/useHomepageContent";

const ICONS = [Users, Briefcase, Star, Globe];

const StatsCounterSection = () => {
  const ref = useScrollReveal();
  const { content } = useHomepageContent();
  const stats = content.stats;

  return (
    <section className="py-16 md:py-20 bg-primary relative overflow-hidden" ref={ref}>
      {/* Pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="container-app relative">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {stats.map((s, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
            <div key={`${s.label}-${i}`} className="text-center">
              <div className="w-14 h-14 rounded-sm bg-primary-foreground/10 flex items-center justify-center mx-auto mb-4">
                <Icon className="w-7 h-7 text-primary-foreground" />
              </div>
              <p className="text-fs-3xl sm:text-fs-4xl font-bold text-primary-foreground tabular-nums mb-1">{s.value}</p>
              <p className="text-fs-sm text-primary-foreground/70">{s.label}</p>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default StatsCounterSection;
