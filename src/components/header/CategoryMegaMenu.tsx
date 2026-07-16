import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Menu,
  TrendingUp,
  Star,
  Droplet,
  Zap,
  PaintBucket,
  Hammer,
  Wind,
  Truck,
  Lock,
  Leaf,
  SprayCan,
  Bug,
  ShieldCheck,
  Wrench,
  Home,
  Fence,
  Sofa,
  Sparkles,
  Camera,
  Baby,
  Dog,
  Dumbbell,
  UtensilsCrossed,
  Car,
  Package,
  Scissors,
  Music,
  MonitorSmartphone,
  Shirt,
  FlameKindling,
  Waves,
  TreePine,
  Aperture,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { Heading } from "@/components/ui/app";
import { fetchSubcategoryOverrides, applySubcategoryOverrides } from "@/lib/subcategoryOverrides";
import { getTaxonomy } from "@/lib/taxonomyCache";

/* ─── Icon / Color Maps ─── */
const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Plumbing: Droplet,
  Electrical: Zap,
  Painting: PaintBucket,
  Carpentry: Hammer,
  HVAC: Wind,
  Moving: Truck,
  Locksmith: Lock,
  Landscaping: Leaf,
  Cleaning: SprayCan,
  "Pest Control": Bug,
  Security: ShieldCheck,
  "Appliance Repair": Wrench,
  "Home Renovation": Home,
  Fencing: Fence,
  Furniture: Sofa,
  "Interior Design": Sparkles,
  Photography: Camera,
  "Child Care": Baby,
  "Pet Care": Dog,
  Fitness: Dumbbell,
  Catering: UtensilsCrossed,
  Automotive: Car,
  Delivery: Package,
  "Hair & Beauty": Scissors,
  "Event & Entertainment": Music,
  "IT & Tech": MonitorSmartphone,
  Tailoring: Shirt,
  Welding: FlameKindling,
  "Pool & Spa": Waves,
  "Tree Service": TreePine,
  Roofing: Aperture,
};

const categoryColors: Record<string, string> = {
  Plumbing: "text-blue-500",
  Electrical: "text-amber-500",
  Painting: "text-rose-500",
  Carpentry: "text-orange-500",
  HVAC: "text-cyan-500",
  Moving: "text-indigo-500",
  Locksmith: "text-slate-500",
  Landscaping: "text-green-500",
  Cleaning: "text-sky-500",
  "Pest Control": "text-red-500",
  Security: "text-emerald-500",
  "Appliance Repair": "text-violet-500",
  "Home Renovation": "text-teal-500",
  Fencing: "text-stone-500",
  Furniture: "text-yellow-600",
  "Interior Design": "text-pink-500",
  Photography: "text-fuchsia-500",
  "Child Care": "text-lime-500",
  "Pet Care": "text-amber-600",
  Fitness: "text-red-600",
  Catering: "text-orange-600",
  Automotive: "text-zinc-500",
  Delivery: "text-blue-600",
  "Hair & Beauty": "text-pink-600",
  "Event & Entertainment": "text-purple-500",
  "IT & Tech": "text-sky-600",
  Tailoring: "text-rose-600",
  Welding: "text-orange-700",
  "Pool & Spa": "text-cyan-600",
  "Tree Service": "text-green-600",
  Roofing: "text-stone-600",
};

const categoryBgs: Record<string, string> = {
  Plumbing: "bg-blue-500/10",
  Electrical: "bg-amber-500/10",
  Painting: "bg-rose-500/10",
  Carpentry: "bg-orange-500/10",
  HVAC: "bg-cyan-500/10",
  Moving: "bg-indigo-500/10",
  Locksmith: "bg-slate-500/10",
  Landscaping: "bg-green-500/10",
  Cleaning: "bg-sky-500/10",
  "Pest Control": "bg-red-500/10",
  Security: "bg-emerald-500/10",
  "Appliance Repair": "bg-violet-500/10",
  "Home Renovation": "bg-teal-500/10",
  Fencing: "bg-stone-500/10",
  Furniture: "bg-yellow-600/10",
  "Interior Design": "bg-pink-500/10",
  Photography: "bg-fuchsia-500/10",
  "Child Care": "bg-lime-500/10",
  "Pet Care": "bg-amber-600/10",
  Fitness: "bg-red-600/10",
  Catering: "bg-orange-600/10",
  Automotive: "bg-zinc-500/10",
  Delivery: "bg-blue-600/10",
  "Hair & Beauty": "bg-pink-600/10",
  "Event & Entertainment": "bg-purple-500/10",
  "IT & Tech": "bg-sky-600/10",
  Tailoring: "bg-rose-600/10",
  Welding: "bg-orange-700/10",
  "Pool & Spa": "bg-cyan-600/10",
  "Tree Service": "bg-green-600/10",
  Roofing: "bg-stone-600/10",
};

const categoryGradients: Record<string, string> = {
  Plumbing: "from-blue-500/20 to-blue-600/5",
  Electrical: "from-amber-500/20 to-amber-600/5",
  Painting: "from-rose-500/20 to-rose-600/5",
  Carpentry: "from-orange-500/20 to-orange-600/5",
  HVAC: "from-cyan-500/20 to-cyan-600/5",
  Moving: "from-indigo-500/20 to-indigo-600/5",
  Locksmith: "from-slate-500/20 to-slate-600/5",
  Landscaping: "from-green-500/20 to-green-600/5",
  Cleaning: "from-sky-500/20 to-sky-600/5",
  "Pest Control": "from-red-500/20 to-red-600/5",
  Security: "from-emerald-500/20 to-emerald-600/5",
  "Appliance Repair": "from-violet-500/20 to-violet-600/5",
  "Home Renovation": "from-teal-500/20 to-teal-600/5",
  Fencing: "from-stone-500/20 to-stone-600/5",
  Furniture: "from-yellow-600/20 to-yellow-700/5",
  "Interior Design": "from-pink-500/20 to-pink-600/5",
  Photography: "from-fuchsia-500/20 to-fuchsia-600/5",
  "Child Care": "from-lime-500/20 to-lime-600/5",
  "Pet Care": "from-amber-600/20 to-amber-700/5",
  Fitness: "from-red-600/20 to-red-700/5",
  Catering: "from-orange-600/20 to-orange-700/5",
  Automotive: "from-zinc-500/20 to-zinc-600/5",
  Delivery: "from-blue-600/20 to-blue-700/5",
  "Hair & Beauty": "from-pink-600/20 to-pink-700/5",
  "Event & Entertainment": "from-purple-500/20 to-purple-600/5",
  "IT & Tech": "from-sky-600/20 to-sky-700/5",
  Tailoring: "from-rose-600/20 to-rose-700/5",
  Welding: "from-orange-700/20 to-orange-800/5",
  "Pool & Spa": "from-cyan-600/20 to-cyan-700/5",
  "Tree Service": "from-green-600/20 to-green-700/5",
  Roofing: "from-stone-600/20 to-stone-700/5",
};

/* ─── Types ─── */
export interface SubCategory {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  sort_order?: number | null;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  subcategories: SubCategory[];
}

interface Props {
  onCategorySelect?: (category: string) => void;
  onSubcategorySelect?: (subcategory: string) => void;
}

/* ─── Shared hook ─── */
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ categories: cats, subcategories: subsRaw }, overrides] = await Promise.all([
        getTaxonomy(),
        fetchSubcategoryOverrides(),
      ]);
      const subs = applySubcategoryOverrides(subsRaw as unknown as SubCategory[], overrides);
      setCategories(cats.map((c) => ({ id: c.id, name: c.name, icon: c.icon ?? null, subcategories: subs.filter((s) => s.category_id === c.id) })));
    };
    load();
  }, []);

  return categories;
}

/* ─── (Category chips are rendered directly from useCategories) ─── */


/* ════════════════════════════════════════════════════════
   DESKTOP MEGA MENU
   ════════════════════════════════════════════════════════ */
export default function CategoryMegaMenu({ onCategorySelect, onSubcategorySelect }: Props) {
  const navigate = useNavigate();
  const categories = useCategories();


  const [open, setOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const closeTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (categories.length > 0 && !hoveredCategory) setHoveredCategory(categories[0].id);
  }, [categories, hoveredCategory]);

  const handleEnter = () => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    setOpen(true);
  };
  const handleLeave = () => {
    closeTimeout.current = setTimeout(() => setOpen(false), 200);
  };

  const handleCategoryClick = (name: string) => {
    if (onCategorySelect) onCategorySelect(name);
    else navigate(`/browse?category=${encodeURIComponent(name)}`);
    setOpen(false);
  };

  const handleSubcategoryClick = (catName: string, subName: string) => {
    if (onCategorySelect) {
      onCategorySelect(catName);
      onSubcategorySelect?.(subName);
    } else navigate(`/browse?category=${encodeURIComponent(catName)}&subcategory=${encodeURIComponent(subName)}`);
    setOpen(false);
  };

  const activeCategory = categories.find((c) => c.id === hoveredCategory);
  const ActiveIcon = activeCategory ? (categoryIcons[activeCategory.name] || getCategoryIcon(activeCategory.icon)) : null;

  const totalServices = useMemo(() => categories.reduce((a, c) => a + c.subcategories.length, 0), [categories]);

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-fs-sm font-medium transition-all duration-200 ${
          open ? "bg-hover text-hover-foreground" : "text-body hover:text-foreground hover:bg-hover"
        }`}
      >
        <Menu className="w-4 h-4" />
        <span className="hidden lg:inline">Categories</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full left-0 pt-2 z-50" style={{ width: "840px" }}>
          <div className="rounded-2xl border border-border bg-popover shadow-[0_20px_50px_-12px_hsl(var(--primary)/0.18)] overflow-hidden animate-in fade-in-0 slide-in-from-top-1 zoom-in-[0.98] duration-200">
            {/* Main content */}
            <div className="flex h-[340px] overflow-hidden">
              {/* Left: Category rail */}
              <div className="shrink-0 border-r border-border bg-background flex flex-col overflow-hidden">
                <div className="px-4 pt-4 pb-2 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
                    Browse by Category
                  </span>
                </div>
                <ScrollArea className="flex-1">
                  <div className="px-3 pb-3 space-y-1">
                    {categories.map((cat) => {
                      const Icon = categoryIcons[cat.name] || getCategoryIcon(cat.icon);
                      const isActive = hoveredCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onMouseEnter={() => setHoveredCategory(cat.id)}
                          onClick={() => handleCategoryClick(cat.name)}
                          className={`group flex items-center gap-3 w-full p-2.5 rounded-xl transition-all duration-150 text-left ${
                            isActive
                              ? "bg-card text-foreground border border-border shadow-sm"
                              : "bg-transparent text-body hover:bg-card hover:text-foreground border border-transparent hover:border-border/60"
                          }`}
                        >
                          {Icon && (
                            <div
                              className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
                                isActive
                                  ? "bg-muted border border-border/60"
                                  : "bg-background border border-border group-hover:bg-muted"
                              }`}
                            >
                              <Icon
                                className={`w-4 h-4 ${categoryColors[cat.name] || "text-foreground/70"}`}
                              />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="text-fs-sm font-medium truncate">{cat.name}</p>
                            <p
                              className={`text-[11px] truncate ${
                                isActive ? "text-muted-foreground" : "text-muted-foreground/70"
                              }`}
                            >
                              {cat.subcategories.length} service
                              {cat.subcategories.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <ChevronRight
                            className={`w-4 h-4 transition-opacity ${
                              isActive ? "opacity-60" : "opacity-0 group-hover:opacity-40"
                            }`}
                          />

                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Right: Subcategories + featured */}
              <div className="flex-1 min-w-0 flex flex-col bg-popover overflow-hidden">
                {activeCategory && (
                  <ScrollArea className="flex-1">
                    <div className="p-6 animate-in fade-in-0 duration-150">
                      {/* Category header */}
                      <div className="flex items-center gap-3 mb-6">
                        {ActiveIcon && (
                          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                            <ActiveIcon className="w-6 h-6 text-primary" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <Heading level={3} className="text-fs-lg font-semibold">
                            {activeCategory.name}
                          </Heading>
                          <p className="text-fs-xs text-muted-foreground mt-0.5">
                            {activeCategory.subcategories.length} professional service
                            {activeCategory.subcategories.length !== 1 ? "s" : ""} available
                          </p>
                        </div>
                      </div>

                      {/* Subcategory grid — underlined rows */}
                      {activeCategory.subcategories.length > 0 ? (
                        <div className="grid grid-cols-2 gap-x-8 gap-y-0 mb-6">
                          {activeCategory.subcategories.map((sub) => (
                            <button
                              key={sub.id}
                              onClick={() => handleSubcategoryClick(activeCategory.name, sub.name)}
                              className="group flex items-center justify-between py-2 px-1 border-b border-border/50 hover:border-primary transition-colors text-left"
                            >
                              <span className="text-fs-sm text-body group-hover:text-foreground truncate">
                                {sub.name}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-70 group-hover:translate-x-0 transition-all shrink-0 ml-2" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-8 text-fs-sm text-muted-foreground/60">
                          No subcategories yet
                        </div>
                      )}

                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>


            {/* Footer */}
            <div className="border-t border-border bg-background px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                <span>{categories.length} Categories</span>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span>{totalServices} Total Services</span>
              </div>
              <Link
                to="/browse"
                onClick={() => setOpen(false)}
                className="group inline-flex items-center gap-1 text-fs-xs font-semibold text-foreground hover:gap-2 transition-all"
              >
                View All Services
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   MOBILE CATEGORIES ACCORDION
   ════════════════════════════════════════════════════════ */
export function MobileCategoryAccordion({
  onCategorySelect,
  onSubcategorySelect,
  onClose,
}: Props & { onClose: () => void }) {
  const navigate = useNavigate();
  const categories = useCategories();
  
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleCategoryClick = (name: string) => {
    if (onCategorySelect) onCategorySelect(name);
    else navigate(`/browse?category=${encodeURIComponent(name)}`);
    onClose();
  };

  const handleSubcategoryClick = (catName: string, subName: string) => {
    if (onCategorySelect) {
      onCategorySelect(catName);
      onSubcategorySelect?.(subName);
    } else navigate(`/browse?category=${encodeURIComponent(catName)}&subcategory=${encodeURIComponent(subName)}`);
    onClose();
  };

  return (
    <div className="border-b border-border/20 pb-1">
      {/* Accordion trigger */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between w-full text-fs-sm font-medium py-2.5 px-1 rounded-lg transition-colors ${
          open ? "text-primary" : "text-foreground hover:text-primary"
        }`}
      >
        <div className="flex items-center gap-2">
          <Menu className="w-4 h-4" />
          <span>Categories</span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ease-out ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Category list */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          open ? "max-h-[320px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <ScrollArea className="h-[320px]">
        <div className="pl-1 space-y-0.5 pb-2 pt-1 pr-2">
          {categories.map((cat) => {
            const Icon = categoryIcons[cat.name] || getCategoryIcon(cat.icon);
            const isExpanded = expanded === cat.id;
            return (
              <div key={cat.id} className="rounded-lg overflow-hidden">
                {/* Category row */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : cat.id)}
                  className={`relative flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-fs-sm transition-all duration-200 ${
                    isExpanded
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-body hover:bg-hover hover:text-hover-foreground active:bg-hover"
                  }`}
                >
                  <span
                    className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full bg-accent transition-all duration-200 ${
                      isExpanded ? "h-6 opacity-100" : "h-0 opacity-0"
                    }`}
                    aria-hidden
                  />
                  {Icon && (
                    <div
                      className={`w-7 h-7 rounded-sm flex items-center justify-center shrink-0 transition-all duration-200 ${
                        isExpanded
                          ? `bg-gradient-to-br ${categoryGradients[cat.name] || "from-primary/20 to-primary/5"}`
                          : categoryBgs[cat.name] || "bg-muted"
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${categoryColors[cat.name]}`} />
                    </div>
                  )}
                  <span className="flex-1 text-left">{cat.name}</span>
                  <span className="text-[10px] text-muted-foreground/50 tabular-nums mr-1">
                    {cat.subcategories.length}
                  </span>
                  {cat.subcategories.length > 0 && (
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-300 ease-out ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </button>

                {/* Subcategory list */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-out ${
                    isExpanded && cat.subcategories.length > 0 ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="pl-9 pr-2 space-y-0.5 py-1">
                    {cat.subcategories.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => handleSubcategoryClick(cat.name, sub.name)}
                        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-fs-sm text-muted-foreground hover:text-hover-foreground hover:bg-hover active:bg-hover transition-all duration-150"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/30 shrink-0" />
                        <span className="truncate">{sub.name}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => handleCategoryClick(cat.name)}
                      className="flex items-center gap-1.5 px-3 py-2 text-fs-xs font-medium text-primary active:text-primary/80 transition-colors"
                    >
                      View all {cat.name} <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

        </div>
        </ScrollArea>
      </div>
    </div>
  );
}
