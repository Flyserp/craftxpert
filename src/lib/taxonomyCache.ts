/**
 * Taxonomy cache — reduces database load and speeds up browsing across
 * branded tenant domains. The category and subcategory catalogs are read
 * on nearly every public page (mega menu, landing sections, browse,
 * category detail, featured services). Before this cache, every one of
 * those page loads issued fresh queries against `service_categories` and
 * `service_subcategories` even though the data changes very rarely.
 *
 * Strategy:
 *   - In-memory cache keyed by table name, TTL 5 minutes.
 *   - sessionStorage mirror so a page reload / route change reuses the
 *     same fetched payload without a network round-trip.
 *   - Concurrent-call deduping: if two components mount at the same time
 *     they share a single in-flight promise instead of racing.
 *   - Explicit `invalidateTaxonomy()` for admin mutations so edits are
 *     reflected immediately without waiting for TTL expiry.
 *
 * Rows are cached with `select("*")` so every consumer can pick the
 * columns it needs without triggering a new fetch shape.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CategoryRow {
  id: string;
  name: string;
  icon: string | null;
  sort_order?: number | null;
  slug?: string | null;
  [key: string]: any;
}

export interface SubcategoryRow {
  id: string;
  name: string;
  slug: string | null;
  category_id: string;
  icon?: string | null;
  sort_order?: number | null;
  [key: string]: any;
}

type Table = "service_categories" | "service_subcategories";

const TTL_MS = 5 * 60 * 1000;
const STORAGE_PREFIX = "taxcache:v1:";

interface Entry<T> {
  data: T[];
  fetchedAt: number;
}

const memory = new Map<Table, Entry<any>>();
const inflight = new Map<Table, Promise<any[]>>();

function readSession<T>(table: Table): Entry<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + table);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    if (Date.now() - parsed.fetchedAt > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession<T>(table: Table, entry: Entry<T>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + table, JSON.stringify(entry));
  } catch {
    /* quota — ignore */
  }
}

async function fetchTable<T>(table: Table): Promise<T[]> {
  // Fresh in-memory entry
  const mem = memory.get(table);
  if (mem && Date.now() - mem.fetchedAt <= TTL_MS) return mem.data as T[];

  // Fresh sessionStorage entry (survives reload)
  const session = readSession<T>(table);
  if (session) {
    memory.set(table, session);
    return session.data;
  }

  // Dedupe concurrent callers on the same table
  const existing = inflight.get(table);
  if (existing) return existing as Promise<T[]>;

  const promise = (async () => {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("sort_order", { nullsFirst: false })
      .order("name");
    if (error) {
      // Never cache errors — surface an empty array to callers but keep TTL
      // clean so the next call retries.
      console.error(`[taxonomyCache] failed to load ${table}`, error);
      return [] as T[];
    }
    const rows = (data ?? []) as T[];
    const entry: Entry<T> = { data: rows, fetchedAt: Date.now() };
    memory.set(table, entry);
    writeSession(table, entry);
    return rows;
  })().finally(() => {
    inflight.delete(table);
  });

  inflight.set(table, promise);
  return promise;
}

export function getCategories(): Promise<CategoryRow[]> {
  return fetchTable<CategoryRow>("service_categories");
}

export function getSubcategories(): Promise<SubcategoryRow[]> {
  return fetchTable<SubcategoryRow>("service_subcategories");
}

export async function getTaxonomy(): Promise<{
  categories: CategoryRow[];
  subcategories: SubcategoryRow[];
}> {
  const [categories, subcategories] = await Promise.all([
    getCategories(),
    getSubcategories(),
  ]);
  return { categories, subcategories };
}

/**
 * Drop cached taxonomy so the next read hits the database. Call after
 * admin CRUD / reorder on service_categories or service_subcategories.
 */
export function invalidateTaxonomy(table?: Table) {
  const targets: Table[] = table ? [table] : ["service_categories", "service_subcategories"];
  for (const t of targets) {
    memory.delete(t);
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(STORAGE_PREFIX + t);
      } catch {
        /* ignore */
      }
    }
  }
}
