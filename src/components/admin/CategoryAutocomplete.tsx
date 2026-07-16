import { useMemo, useRef, useState, useEffect } from "react";
import { Search, X, Layers, FolderTree } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";

export interface AutocompleteCategory {
  id: string;
  name: string;
  icon?: string | null;
}
export interface AutocompleteSubcategory {
  id: string;
  name: string;
  slug: string;
  category_id: string;
}

interface Props {
  categories: AutocompleteCategory[];
  subcategories: AutocompleteSubcategory[];
  search: string;
  onSearchChange: (v: string) => void;
  onPickCategory: (id: string) => void;
  onPickSubcategory: (sub: AutocompleteSubcategory) => void;
  placeholder?: string;
  maxResults?: number;
}

type ResultRow =
  | { kind: "category"; id: string; name: string; extra: string }
  | { kind: "subcategory"; sub: AutocompleteSubcategory; parent: string };

/**
 * Autocomplete for the admin Categories screen.
 * Searches across both categories and subcategories, opens a popover with
 * grouped results, keyboard-navigable via ↑/↓/Enter/Esc.
 */
export default function CategoryAutocomplete({
  categories,
  subcategories,
  search,
  onSearchChange,
  onPickCategory,
  onPickSubcategory,
  placeholder = "Search categories or subcategories…",
  maxResults = 12,
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const catNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const q = search.trim().toLowerCase();

  const results: ResultRow[] = useMemo(() => {
    if (!q) return [];
    const catSubCount = new Map<string, number>();
    for (const s of subcategories) {
      catSubCount.set(s.category_id, (catSubCount.get(s.category_id) ?? 0) + 1);
    }
    const catMatches: ResultRow[] = categories
      .filter((c) => c.name.toLowerCase().includes(q))
      .map((c) => ({
        kind: "category" as const,
        id: c.id,
        name: c.name,
        extra: `${catSubCount.get(c.id) ?? 0} subs`,
      }));
    const subMatches: ResultRow[] = subcategories
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q),
      )
      .map((s) => ({
        kind: "subcategory" as const,
        sub: s,
        parent: catNameById.get(s.category_id) ?? "—",
      }));
    return [...catMatches, ...subMatches].slice(0, maxResults);
  }, [q, categories, subcategories, catNameById, maxResults]);

  // Keep active index in bounds when results change.
  useEffect(() => {
    setActive(0);
  }, [q]);

  useEffect(() => {
    setOpen(q.length > 0 && results.length > 0);
  }, [q, results.length]);

  const pick = (row: ResultRow) => {
    if (row.kind === "category") onPickCategory(row.id);
    else onPickSubcategory(row.sub);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => q && results.length > 0 && setOpen(true)}
            placeholder={placeholder}
            className="pl-8 pr-8 h-9 w-72 text-fs-sm"
            aria-autocomplete="list"
            aria-expanded={open}
            role="combobox"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                onSearchChange("");
                setOpen(false);
                inputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-72 p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {results.length === 0 ? (
          <div className="px-2 py-3 text-fs-xs text-muted-foreground">No matches.</div>
        ) : (
          <ul role="listbox" className="max-h-80 overflow-y-auto">
            {results.map((r, i) => {
              const isActive = i === active;
              const key = r.kind === "category" ? `c-${r.id}` : `s-${r.sub.id}`;
              return (
                <li
                  key={key}
                  role="option"
                  aria-selected={isActive}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(r);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex items-center gap-2 rounded-sm px-2 py-1.5 text-fs-sm cursor-pointer ${
                    isActive ? "bg-muted" : ""
                  }`}
                >
                  {r.kind === "category" ? (
                    <>
                      <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="flex-1 truncate">{r.name}</span>
                      <span className="text-fs-xs text-muted-foreground shrink-0">
                        {r.extra}
                      </span>
                    </>
                  ) : (
                    <>
                      <FolderTree className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">
                        {r.sub.name}
                        <span className="text-fs-xs text-muted-foreground"> · {r.parent}</span>
                      </span>
                      <span className="text-fs-xs text-muted-foreground shrink-0">sub</span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
