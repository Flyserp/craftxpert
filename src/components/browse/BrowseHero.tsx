import { Search, MapPin, Briefcase, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";

interface BrowseHeroProps {
  search: string;
  onSearchChange: (val: string) => void;
  locationFilter: string;
  onLocationChange: (val: string) => void;
  totalCount: number;
}

const BrowseHero = ({
  search,
  onSearchChange,
  locationFilter,
  onLocationChange,
  totalCount,
}: BrowseHeroProps) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/4 to-background border-b border-border/30">
      <div
        className="container-app relative z-10 flex flex-col items-center justify-center text-center"
        style={{ minHeight: "420px", paddingTop: "4.5rem", paddingBottom: "4.5rem" }}
      >
        {/* Subtitle */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/8 border border-primary/15 mb-5 animate-reveal">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-fs-xs font-semibold text-primary tracking-wide uppercase">
            Trusted Professionals
          </span>
        </div>

        {/* Title */}
        <h1
          className="text-h1 text-heading mb-3 leading-[1.1] max-w-2xl animate-reveal"
          style={{ animationDelay: "60ms" }}
        >
          Find &amp; Hire the Best Pros
        </h1>

        {/* Description */}
        <p
          className="text-lead max-w-xl mb-8 animate-reveal"
          style={{ animationDelay: "120ms" }}
        >
          Browse vetted service providers, compare ratings and prices, and book with confidence.
        </p>

        {/* Search bar */}
        <div
          className="w-full max-w-xl flex flex-col sm:flex-row gap-2.5 animate-reveal"
          style={{ animationDelay: "180ms" }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name or service…"
              className="pl-11 h-12 text-fs-sm bg-card border-border/60 rounded-sm"
            />
          </div>
          <div className="relative sm:w-48">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
            <Input
              value={locationFilter}
              onChange={(e) => onLocationChange(e.target.value)}
              placeholder="Location…"
              className="pl-11 h-12 text-fs-sm bg-card border-border/60 rounded-sm"
            />
          </div>
        </div>

        {/* Stats */}
        <p
          className="text-fs-xs text-muted-foreground mt-5 animate-reveal"
          style={{ animationDelay: "240ms" }}
        >
          <span className="font-semibold text-heading">{totalCount}</span> professional
          {totalCount !== 1 ? "s" : ""} available
        </p>
      </div>

      {/* Decorative elements */}
      <div className="absolute -right-20 -bottom-20 opacity-[0.03] pointer-events-none">
        <Briefcase className="w-80 h-80" />
      </div>
      <div className="absolute -left-10 top-10 w-56 h-56 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute right-20 top-16 w-40 h-40 bg-primary/3 rounded-full blur-2xl pointer-events-none" />
    </section>
  );
};

export default BrowseHero;
