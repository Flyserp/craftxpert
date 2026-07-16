/**
 * Tenant branding version — cache-busting for branding-related URLs.
 *
 * Defense-in-depth for the SW purge in `main.tsx`: even if `purgeBrandingCaches`
 * fails (permission error, quota, foreign SW pinning entries), appending a
 * `?bv=<version>` param to branding URLs makes them a different Cache Storage
 * key, so returning users still fetch fresh assets after a bump.
 *
 * The version is a monotonically-increasing string (epoch ms) stored in
 * `platform_settings.brand_version` and bumped whenever an admin saves any
 * branding row. We mirror it into localStorage so the very first paint —
 * before the hook resolves — can already emit versioned URLs.
 */
const LS_KEY = "lovable.brandVersion";

/** Read the last-known brand version from localStorage. Never throws. */
export function getCachedBrandVersion(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

/** Persist the brand version so early paints on the next visit are versioned. */
export function setCachedBrandVersion(version: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (version) window.localStorage.setItem(LS_KEY, version);
    else window.localStorage.removeItem(LS_KEY);
  } catch {
    /* storage disabled — non-fatal, we fall back to unversioned URLs */
  }
}

/**
 * Append `?bv=<version>` to a URL. Idempotent — if the URL already carries
 * the same version, it's returned unchanged. If it has a different `bv`,
 * that value is replaced (not duplicated).
 *
 *   withBrandVersion("/logo.png", "17")           → "/logo.png?bv=17"
 *   withBrandVersion("/logo.png?x=1", "17")       → "/logo.png?x=1&bv=17"
 *   withBrandVersion("/logo.png?bv=9", "17")      → "/logo.png?bv=17"
 *   withBrandVersion("data:image/png;base64,…", …) → unchanged
 *   withBrandVersion(null, "17")                  → null
 */
export function withBrandVersion(
  url: string | null | undefined,
  version: string | null | undefined,
): string | null {
  if (!url) return null;
  if (!version) return url;
  // Never bust non-http(s) URLs (data:, blob:, mailto:, javascript:).
  if (/^(data|blob|mailto|javascript):/i.test(url)) return url;

  const [base, hash] = url.split("#", 2);
  const [pathAndQuery, ...rest] = [base];
  const qIndex = pathAndQuery.indexOf("?");
  let path = pathAndQuery;
  let query = "";
  if (qIndex >= 0) {
    path = pathAndQuery.slice(0, qIndex);
    query = pathAndQuery.slice(qIndex + 1);
  }
  const params = new URLSearchParams(query);
  params.set("bv", version);
  const nextBase = `${path}?${params.toString()}`;
  return hash !== undefined ? `${nextBase}#${hash}` : nextBase;
}

/** Best-effort brand version to use on the very first paint. */
export function initialBrandVersion(): string | null {
  return getCachedBrandVersion();
}
