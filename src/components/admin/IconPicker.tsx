import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, X } from "lucide-react";
import {
  LUCIDE_ICON_OPTIONS,
  ICON_LOOKUP,
  getCategoryIcon,
} from "@/lib/categoryIcons";

interface IconPickerProps {
  value: string | null | undefined;
  onChange: (iconName: string | null) => void;
  placeholder?: string;
}

/**
 * Searchable dropdown for selecting a Lucide icon.
 * Stores the icon's string name (e.g. "Snowflake") so it can be saved
 * to the database and resolved later via getCategoryIcon().
 */
export function IconPicker({ value, onChange, placeholder = "Choose an icon" }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const valid = !!value && !!ICON_LOOKUP[value];
  const SelectedIcon = valid ? getCategoryIcon(value) : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LUCIDE_ICON_OPTIONS;
    return LUCIDE_ICON_OPTIONS.filter((o) => o.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between h-10 font-normal"
        >
          <span className="flex items-center gap-2 min-w-0">
            {SelectedIcon ? (
              <>
                <SelectedIcon className="w-4 h-4 text-primary shrink-0" />
                <span className="truncate">{value}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {valid && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(null);
                  }
                }}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label="Clear icon"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-2" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search icons…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="max-h-72 overflow-y-auto grid grid-cols-6 gap-1">
          {filtered.map(({ name, icon: Icon }) => {
            const selected = value === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                title={name}
                className={`flex items-center justify-center h-10 w-10 rounded-sm border transition-colors ${
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent hover:bg-muted text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-fs-xs text-muted-foreground py-6">
              No icons match "{query}".
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
