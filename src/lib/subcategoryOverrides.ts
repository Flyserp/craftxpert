import { supabase } from "@/integrations/supabase/client";

export type SubcategoryOverride = {
  subcategory_id: string;
  is_hidden: boolean;
  sort_order: number | null;
};

export type SubcategoryLike = {
  id: string;
  name: string;
  sort_order?: number | null;
  [key: string]: any;
};

/**
 * Fetch admin overrides for subcategories. Missing rows = defaults
 * (visible, base sort order).
 */
export async function fetchSubcategoryOverrides(): Promise<Map<string, SubcategoryOverride>> {
  const { data, error } = await supabase
    .from("subcategory_overrides")
    .select("subcategory_id, is_hidden, sort_order");
  if (error) return new Map();
  const map = new Map<string, SubcategoryOverride>();
  for (const row of (data as SubcategoryOverride[]) ?? []) {
    map.set(row.subcategory_id, row);
  }
  return map;
}

/**
 * Apply overrides: filter out hidden subcategories and sort by
 * (override.sort_order ?? base.sort_order ?? Infinity) then by name.
 */
export function applySubcategoryOverrides<T extends SubcategoryLike>(
  subs: T[],
  overrides: Map<string, SubcategoryOverride>,
): T[] {
  const withOrder = subs
    .filter((s) => !overrides.get(s.id)?.is_hidden)
    .map((s) => {
      const o = overrides.get(s.id);
      const effective =
        (o?.sort_order ?? null) !== null
          ? (o!.sort_order as number)
          : typeof s.sort_order === "number"
            ? s.sort_order
            : Number.POSITIVE_INFINITY;
      return { s, effective };
    });
  withOrder.sort((a, b) => {
    if (a.effective !== b.effective) return a.effective - b.effective;
    return a.s.name.localeCompare(b.s.name);
  });
  return withOrder.map((x) => x.s);
}

/**
 * Convenience: fetch overrides + apply to a subcategory list in one call.
 */
export async function withSubcategoryOverrides<T extends SubcategoryLike>(
  subs: T[],
): Promise<T[]> {
  const overrides = await fetchSubcategoryOverrides();
  return applySubcategoryOverrides(subs, overrides);
}
