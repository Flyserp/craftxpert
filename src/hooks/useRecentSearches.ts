import { useCallback, useEffect, useState } from "react";

const KEY = "wrap.recent_searches.v1";
const MAX = 8;

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function useRecentSearches() {
  const [items, setItems] = useState<string[]>(() => (typeof window === "undefined" ? [] : read()));

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setItems(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const push = useCallback((term: string) => {
    const t = term.trim();
    if (t.length < 2) return;
    setItems((prev) => {
      const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const remove = useCallback((term: string) => {
    setItems((prev) => {
      const next = prev.filter((x) => x.toLowerCase() !== term.toLowerCase());
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { recent: items, push, remove, clear };
}