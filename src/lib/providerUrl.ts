const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function slugify(name: string | null | undefined): string {
  return (name || "provider")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "provider";
}

/** Build a clean, SEO-friendly provider URL: /provider/john-doe-<uuid> */
export function providerUrl(id: string, name?: string | null): string {
  if (!id) return "/provider/";
  return `/provider/${slugify(name)}-${id}`;
}

/** Extract a UUID from a slugged route param. Returns null if none found. */
export function extractProviderId(param: string | undefined | null): string | null {
  if (!param) return null;
  const m = param.match(UUID_RE);
  return m ? m[0] : null;
}