import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Suggestion {
  id: string;
  label: string;
  lat: number;
  lon: number;
  address: Record<string, string>;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: Suggestion) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

const DEBOUNCE_MS = 350;

const AddressAutocomplete = ({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing your address…",
  maxLength = 300,
  className,
}: AddressAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const lastQueryRef = useRef<string>("");
  const skipNextSearchRef = useRef(false); // suppress search after picking a suggestion

  // Close dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (q === lastQueryRef.current) return;

    const handle = window.setTimeout(async () => {
      lastQueryRef.current = q;
      setLoading(true);
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geocode-search?q=${encodeURIComponent(q)}&limit=5`;
        const resp = await fetch(url, {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });
        const json = await resp.json();
        if (lastQueryRef.current === q) {
          setSuggestions(json.suggestions ?? []);
          setOpen(true);
          setHighlight(-1);
        }
      } catch {
        if (lastQueryRef.current === q) {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        if (lastQueryRef.current === q) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [value]);

  const pick = (s: Suggestion) => {
    skipNextSearchRef.current = true;
    lastQueryRef.current = s.label;
    onChange(s.label.slice(0, maxLength));
    setVerified(true);
    setOpen(false);
    setSuggestions([]);
    onSelect?.(s);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      pick(suggestions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => {
            setVerified(false);
            onChange(e.target.value.slice(0, maxLength));
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
          className="text-fs-base pr-10"
          aria-autocomplete="list"
          aria-expanded={open}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : verified ? (
            <Check className="w-4 h-4 text-primary" aria-label="Verified address" />
          ) : (
            <MapPin className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-sm border border-border bg-popover shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault(); // keep input focus
                pick(s);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "px-3 py-2 text-fs-sm cursor-pointer flex items-start gap-2 border-b border-border/50 last:border-b-0 transition-colors",
                i === highlight ? "bg-secondary/60" : "hover:bg-secondary/40"
              )}
            >
              <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <span className="text-foreground leading-snug">{s.label}</span>
            </li>
          ))}
        </ul>
      )}

      {verified && (
        <p className="text-[10px] text-primary mt-1 flex items-center gap-1">
          <Check className="w-3 h-3" /> Verified address
        </p>
      )}
    </div>
  );
};

export default AddressAutocomplete;
