import { slugify } from "./providerUrl";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Build a clean, SEO-friendly job URL: /jobs/title-slug-<uuid> */
export function jobUrl(id: string, title?: string | null): string {
  if (!id) return "/jobs/";
  return `/jobs/${slugify(title || "job")}-${id}`;
}

/** Extract a UUID from a slugged job route param. */
export function extractJobId(param: string | undefined | null): string | null {
  if (!param) return null;
  const m = param.match(UUID_RE);
  return m ? m[0] : null;
}