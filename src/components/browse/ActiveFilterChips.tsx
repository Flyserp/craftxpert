import { MapPin, DollarSign, Star, Clock, X } from "lucide-react";
import type { BrowseFilters } from "./types";

interface ActiveFilterChipsProps {
  filters: BrowseFilters;
  onFilterChange: <K extends keyof BrowseFilters>(key: K, value: BrowseFilters[K]) => void;
}

const ActiveFilterChips = ({ filters, onFilterChange }: ActiveFilterChipsProps) => {
  const { activeCategory, activeSubcategory, locationFilter, priceFilterActive, priceRange, minRating, availableOnly } = filters;

  const hasFilters = activeCategory !== "All" || locationFilter.trim() || priceFilterActive || minRating > 0 || availableOnly;

  if (!hasFilters) return null;

  const chipClass = "inline-flex items-center gap-1 text-fs-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full hover:bg-primary/20 transition-colors active:scale-95";

  return (
    <div className="flex items-center gap-2 mb-6 animate-reveal" style={{ animationDelay: "120ms" }}>
      <span className="text-fs-xs text-muted-foreground">Filtered by:</span>

      {activeCategory !== "All" && (
        <button onClick={() => { onFilterChange("activeCategory", "All"); onFilterChange("activeSubcategory", "All"); }} className={chipClass}>
          {activeCategory}
          <X className="w-3 h-3" />
        </button>
      )}

      {activeSubcategory !== "All" && (
        <button onClick={() => onFilterChange("activeSubcategory", "All")} className={chipClass}>
          {activeSubcategory}
          <X className="w-3 h-3" />
        </button>
      )}

      {locationFilter.trim() && (
        <button onClick={() => onFilterChange("locationFilter", "")} className={chipClass}>
          <MapPin className="w-3 h-3" />
          {locationFilter}
          <X className="w-3 h-3" />
        </button>
      )}

      {priceFilterActive && (
        <button
          onClick={() => {
            onFilterChange("priceFilterActive", false);
            onFilterChange("priceRange", [0, 500]);
          }}
          className={chipClass}
        >
          <DollarSign className="w-3 h-3" />
          ${priceRange[0]}–${priceRange[1]}{priceRange[1] >= 500 ? "+" : ""}
          <X className="w-3 h-3" />
        </button>
      )}

      {minRating > 0 && (
        <button onClick={() => onFilterChange("minRating", 0)} className={chipClass}>
          <Star className="w-3 h-3" />
          {minRating}+ stars
          <X className="w-3 h-3" />
        </button>
      )}

      {availableOnly && (
        <button onClick={() => onFilterChange("availableOnly", false)} className={chipClass}>
          <Clock className="w-3 h-3" />
          Available this week
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export default ActiveFilterChips;