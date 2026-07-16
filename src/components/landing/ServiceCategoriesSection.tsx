import { useEffect, useState } from "react";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryIcon, isCategoryIconMissing } from "@/lib/categoryIcons";
import { getCategories } from "@/lib/taxonomyCache";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Heading } from "@/components/ui/app";

// Rotating color palette for category icons on the landing page
const ICON_COLORS = [
  { color: "text-blue-500",   bg: "bg-blue-500/10" },
  { color: "text-amber-500",  bg: "bg-amber-500/10" },
  { color: "text-teal-500",   bg: "bg-teal-500/10" },
  { color: "text-rose-500",   bg: "bg-rose-500/10" },
  { color: "text-orange-500", bg: "bg-orange-500/10" },
  { color: "text-indigo-500", bg: "bg-indigo-500/10" },
  { color: "text-slate-500",  bg: "bg-slate-500/10" },
  { color: "text-cyan-500",   bg: "bg-cyan-500/10" },
  { color: "text-green-500",  bg: "bg-green-500/10" },
  { color: "text-sky-500",    bg: "bg-sky-500/10" },
  { color: "text-violet-500", bg: "bg-violet-500/10" },
  { color: "text-pink-500",   bg: "bg-pink-500/10" },
];

const ServiceCategoriesSection = () => {
  const navigate = useNavigate();
  const headerRef = useScrollReveal();
  const gridRef = useScrollReveal({ staggerChildren: "[data-category]", staggerDelay: 70 });
  const [categories, setCategories] = useState<{ id: string; name: string; icon: string | null; vendorCount: number }[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const [cats, servicesRes] = await Promise.all([
        getCategories(),
        supabase.from("vendor_services").select("vendor_id, category_id").eq("is_active", true),
      ]);
      const services = servicesRes.data || [];

      const vendorsByCategory: Record<string, Set<string>> = {};
      services.forEach((s: any) => {
        if (!vendorsByCategory[s.category_id]) vendorsByCategory[s.category_id] = new Set();
        vendorsByCategory[s.category_id].add(s.vendor_id);
      });

      setCategories(
        cats.map((c) => ({
          id: c.id,
          name: c.name,
          icon: c.icon ?? null,
          vendorCount: vendorsByCategory[c.id]?.size || 0,
        }))
      );
    };
    fetch();
  }, []);

  return (
    <section id="services" className="py-24 md:py-32">
      <div className="container-app">
        <div className="text-center max-w-2xl mx-auto mb-14" ref={headerRef}>
          <p className="text-eyebrow mb-3">Popular Categories</p>
          <Heading level={2}  className="lg:text-[2.75rem] mb-5">
            Explore our <span className="text-accent">Categories</span>
          </Heading>
          <p className="text-lead">
            Service categories help organize and structure the offerings on our marketplace, making it easier for you to find what you need.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4" ref={gridRef}>
          {categories.map((c, i) => {
            const Icon = getCategoryIcon(c.icon);
            const palette = ICON_COLORS[i % ICON_COLORS.length];
            const iconMissing = isCategoryIconMissing(c.icon, c.name);
            return (
              <button
                key={c.id}
                data-category
                onClick={() => navigate(`/category/${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`)}
                className="group relative flex flex-col items-center gap-4 p-6 rounded-sm border border-border bg-card hover:-translate-y-1 hover:scale-[1.03] transition-all duration-300 active:scale-[0.97]"
              >
                {iconMissing && (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          role="img"
                          aria-label="Missing category icon"
                          data-testid="missing-icon-indicator"
                          className="absolute top-2 right-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        >
                          <AlertTriangle className="w-3 h-3" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        No icon configured for this category
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <div className={`w-16 h-16 rounded-sm ${palette.bg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-7 h-7 ${palette.color}`} />
                </div>
                <div className="text-center">
                  <p className="text-fs-sm font-semibold text-heading mb-1">{c.name}</p>
                  <p className="text-fs-xs text-muted-foreground">
                    {c.vendorCount > 0 ? `${c.vendorCount} Listing${c.vendorCount !== 1 ? "s" : ""}` : "Coming soon"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <Button variant="outline" size="lg" className="gap-2 group h-12 px-4" onClick={() => navigate("/browse")}>
            View All Categories
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ServiceCategoriesSection;
