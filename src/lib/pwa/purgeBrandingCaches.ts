// Branding cache purge — extracted so main.tsx and E2E tests can share exactly
// the same eviction rules.
//
// Runs on `controllerchange` after a new SW activates (autoUpdate +
// clientsClaim). Without it, returning users would keep serving the
// previously-cached tenant settings + branding assets from the
// "supabase-api" / "branding-assets" caches for up to their NetworkFirst
// timeout — which means a stale `--accent` flashes on first paint.

export const BRANDING_CACHE_NAMES: ReadonlySet<string> = new Set([
  "branding-assets",
  "supabase-api",
  "html-cache",
]);

export const BRANDING_URL_HINTS: readonly string[] = [
  "brand_accent",
  "brand_primary",
  "platform_settings",
  "tenants",
];

export interface PurgeBrandingCachesOptions {
  cacheNames?: ReadonlySet<string>;
  urlHints?: readonly string[];
  cacheStorage?: CacheStorage;
}

/**
 * Drop branding-related Cache Storage entries.
 *
 * - Fully deletes caches we own end-to-end (branding-assets, html-cache,
 *   supabase-api).
 * - For any other cache, evicts individual entries whose URL contains a
 *   branding hint (brand_accent, tenants, …). Leaves unrelated messaging /
 *   push caches untouched.
 *
 * Best-effort: swallows errors so the caller can still reload.
 */
export async function purgeBrandingCaches(
  options: PurgeBrandingCachesOptions = {},
): Promise<void> {
  const cacheNames = options.cacheNames ?? BRANDING_CACHE_NAMES;
  const urlHints = options.urlHints ?? BRANDING_URL_HINTS;
  const storage =
    options.cacheStorage ??
    (typeof caches !== "undefined" ? caches : undefined);
  if (!storage) return;

  try {
    const names = await storage.keys();
    await Promise.all(
      names.map(async (name) => {
        if (cacheNames.has(name)) {
          await storage.delete(name);
          return;
        }
        const cache = await storage.open(name);
        const requests = await cache.keys();
        await Promise.all(
          requests.map((req) =>
            urlHints.some((hint) => req.url.includes(hint))
              ? cache.delete(req)
              : Promise.resolve(),
          ),
        );
      }),
    );
  } catch {
    // best-effort — never block the reload
  }
}
