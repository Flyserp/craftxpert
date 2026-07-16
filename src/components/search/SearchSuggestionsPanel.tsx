import { useEffect, useState } from "react";
import { Clock, Flame, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { fetchPopularSearches, fetchSearchSuggestions } from "@/lib/searchLog";

interface Props {
  query: string;
  onPick: (term: string) => void;
}

export default function SearchSuggestionsPanel({ query, onPick }: Props) {
  const { recent, remove, clear } = useRecentSearches();
  const [popular, setPopular] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    fetchPopularSearches(8).then(setPopular).catch(() => setPopular([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchSearchSuggestions(query, 6).then(setSuggestions).catch(() => setSuggestions([]));
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  const showSuggestions = query.trim().length >= 2 && suggestions.length > 0;

  if (!showSuggestions && recent.length === 0 && popular.length === 0) return null;

  return (
    <div className="space-y-4 rounded-sm border border-border bg-card p-4">
      {showSuggestions && (
        <section>
          <div className="text-eyebrow mb-2 flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5" /> Suggestions
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={`s-${s}`}
                onClick={() => onPick(s)}
                className="text-fs-sm rounded-sm border border-border bg-muted/40 px-3 py-1.5 hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <div className="text-eyebrow mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Recent
            </span>
            <Button variant="ghost" size="sm" className="px-2 text-fs-xs" onClick={clear}>
              Clear
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((r) => (
              <span
                key={`r-${r}`}
                className="text-fs-sm group inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2.5 py-1 hover:border-primary"
              >
                <button onClick={() => onPick(r)} className="truncate max-w-[200px]">
                  {r}
                </button>
                <button
                  onClick={() => remove(r)}
                  aria-label={`Remove ${r}`}
                  className="opacity-50 hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </section>
      )}

      {popular.length > 0 && (
        <section>
          <div className="text-eyebrow mb-2 flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5" /> Popular this month
          </div>
          <div className="flex flex-wrap gap-2">
            {popular.map((p) => (
              <Badge
                key={`p-${p}`}
                variant="secondary"
                className="cursor-pointer rounded-sm px-3 py-1 text-fs-sm hover:bg-accent/40"
                onClick={() => onPick(p)}
              >
                {p}
              </Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}