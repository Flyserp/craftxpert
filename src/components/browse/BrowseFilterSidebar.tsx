import { Star, Clock, DollarSign, ChevronDown, ChevronUp, Layers } from "lucide-react";
import { StarRating } from "@/components/ui/StarRating";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { useState } from "react";
import type { BrowseFilters } from "./types";
import { Heading } from "@/components/ui/app";

interface SubCategory {
  id: string;
  name: string;
  slug: string;
  category_id: string;
}

interface BrowseFilterSidebarProps {
  filters: BrowseFilters;
  onFilterChange: <K extends keyof BrowseFilters>(key: K, value: BrowseFilters[K]) => void;
  categories: { id: string; name: string; icon: string | null }[];
  subcategories: SubCategory[];
  onClearAll: () => void;
}

const SectionHeader = ({
  icon: Icon,
  label,
  open,
  onToggle,
}: {
  icon: React.ElementType;
  label: string;
  open: boolean;
  onToggle: () => void;
}) => (
  <button
    onClick={onToggle}
    className="flex items-center justify-between w-full py-2 text-fs-xs font-semibold text-muted-foreground uppercase tracking-wider group/hdr"
  >
    <span className="flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
    <ChevronDown
      className={cn(
        "w-3.5 h-3.5 transition-transform duration-200",
        open && "rotate-180"
      )}
    />
  </button>
);

const BrowseFilterSidebar = ({
  filters,
  onFilterChange,
  categories,
  subcategories,
  onClearAll,
}: BrowseFilterSidebarProps) => {
  const { activeCategory, activeSubcategory, priceRange, priceFilterActive, minRating, availableOnly, sortBy } = filters;
  const [categoryOpen, setCategoryOpen] = useState(true);
  const [priceOpen, setPriceOpen] = useState(true);
  const [ratingOpen, setRatingOpen] = useState(true);

  const activeCat = categories.find((c) => c.name === activeCategory);
  const activeSubs = activeCat
    ? subcategories.filter((s) => s.category_id === activeCat.id)
    : [];

  const hasFilters = activeCategory !== "All" || priceFilterActive || minRating > 0 || availableOnly;

  const itemClass = (active: boolean) =>
    cn(
      "w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
      active
        ? "bg-primary/10 text-primary"
        : "text-body hover:bg-muted/80"
    );

  return (
    <aside className="w-full space-y-0.5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Heading level={2} >Filters</Heading>
        {hasFilters && (
          <button onClick={onClearAll} className="text-[13px] text-primary hover:underline font-medium">
            Clear all
          </button>
        )}
      </div>

      {/* Sort */}
      <div className="pb-3 mb-1 border-b border-border/40">
        <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sort by</p>
        <div className="space-y-0.5">
          {(["relevance", "rating", "price"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onFilterChange("sortBy", s)}
              className={itemClass(sortBy === s)}
            >
              {s === "relevance" ? "Best Match" : s === "rating" ? "Top Rated" : "Lowest Price"}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="py-3 border-b border-border/40">
        <SectionHeader icon={Layers} label="Categories" open={categoryOpen} onToggle={() => setCategoryOpen(!categoryOpen)} />
        {categoryOpen && (
          <div className="mt-1 space-y-0.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
            <button
              onClick={() => { onFilterChange("activeCategory", "All"); onFilterChange("activeSubcategory", "All"); }}
              className={itemClass(activeCategory === "All")}
            >
              All Services
            </button>
            {categories.map((cat) => {
              const Icon = getCategoryIcon(cat.icon || "");
              return (
                <button
                  key={cat.id}
                  onClick={() => onFilterChange("activeCategory", cat.name)}
                  className={cn(itemClass(activeCategory === cat.name), "flex items-center gap-2")}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  {cat.name}
                </button>
              );
            })}

            {/* Subcategories */}
            {activeSubs.length > 0 && (
              <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-primary/12 pl-2.5">
                <button
                  onClick={() => onFilterChange("activeSubcategory", "All")}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 rounded-sm text-sm font-medium transition-all",
                    activeSubcategory === "All" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                >
                  All {activeCategory}
                </button>
                {activeSubs.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => onFilterChange("activeSubcategory", sub.name)}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 rounded-sm text-sm font-medium transition-all",
                      activeSubcategory === sub.name ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    )}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Price Range */}
      <div className="py-3 border-b border-border/40">
        <SectionHeader icon={DollarSign} label="Budget" open={priceOpen} onToggle={() => setPriceOpen(!priceOpen)} />
        {priceOpen && (
          <div className="mt-2 px-0.5">
            <div className="flex items-center justify-between text-fs-xs mb-3">
              <span className="font-semibold text-heading tabular-nums">${priceRange[0]}</span>
              <span className="font-semibold text-heading tabular-nums">${priceRange[1]}{priceRange[1] >= 500 ? "+" : ""}</span>
            </div>
            <Slider
              value={priceRange}
              onValueChange={(val) => {
                onFilterChange("priceRange", val as [number, number]);
                onFilterChange("priceFilterActive", true);
              }}
              min={0}
              max={500}
              step={10}
              minStepsBetweenThumbs={1}
            />
            {priceFilterActive && (
              <button
                onClick={() => { onFilterChange("priceFilterActive", false); onFilterChange("priceRange", [0, 500]); }}
                className="text-[13px] text-primary hover:underline mt-2 font-medium"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* Rating */}
      <div className="py-3 border-b border-border/40">
        <SectionHeader icon={Star} label="Rating" open={ratingOpen} onToggle={() => setRatingOpen(!ratingOpen)} />
        {ratingOpen && (
          <div className="mt-1 space-y-0.5">
            {[0, 3, 3.5, 4, 4.5].map((r) => (
              <button
                key={r}
                onClick={() => onFilterChange("minRating", r)}
                className={cn(itemClass(minRating === r), "flex items-center gap-2")}
              >
                {r === 0 ? (
                  "Any Rating"
                ) : (
                  <span className="flex items-center gap-1">
                    <StarRating value={r} size="xs" />
                    <span className="text-fs-xs text-muted-foreground">{r}+</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Availability */}
      <div className="pt-3">
        <button
          onClick={() => onFilterChange("availableOnly", !availableOnly)}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all",
            availableOnly ? "bg-primary/10 text-primary" : "text-body hover:bg-muted/80"
          )}
        >
          <div className={cn(
            "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
            availableOnly ? "bg-primary border-primary" : "border-border"
          )}>
            {availableOnly && <span className="text-primary-foreground text-[10px] font-bold">✓</span>}
          </div>
          <Clock className="w-3.5 h-3.5" />
          Available this week
        </button>
      </div>
    </aside>
  );
};

export default BrowseFilterSidebar;
