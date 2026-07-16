// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.
import { writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// TODO: replace with your project URL once a custom domain is set.
const BASE_URL = "";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/browse", changefreq: "daily", priority: "0.9" },
  { path: "/providers", changefreq: "daily", priority: "0.9" },
  { path: "/browse-tasks", changefreq: "daily", priority: "0.8" },
  { path: "/help", changefreq: "monthly", priority: "0.4" },
  { path: "/login", changefreq: "yearly", priority: "0.2" },
  { path: "/signup", changefreq: "yearly", priority: "0.3" },
];

async function fetchDynamicEntries(): Promise<SitemapEntry[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn("[sitemap] Supabase env vars missing — skipping dynamic entries");
    return [];
  }
  const supabase = createClient(url, key);
  const out: SitemapEntry[] = [];

  const [{ data: cats }, { data: services }, { data: providers }, { data: jobs }, { data: pages }] = await Promise.all([
    supabase.from("categories").select("slug, updated_at").limit(1000),
    supabase.from("vendor_services").select("id, updated_at").eq("is_active", true).limit(2000),
    supabase.from("profiles").select("id, updated_at").eq("role", "provider").limit(2000),
    supabase.from("tasks").select("id, title, updated_at").in("status", ["open", "in_progress"]).limit(2000),
    supabase.from("cms_pages").select("slug, updated_at").eq("is_published", true).limit(200),
  ]);

  cats?.forEach((c: any) => c.slug && out.push({ path: `/category/${c.slug}`, lastmod: c.updated_at, changefreq: "weekly", priority: "0.7" }));
  services?.forEach((s: any) => out.push({ path: `/service/${s.id}`, lastmod: s.updated_at, changefreq: "weekly", priority: "0.6" }));
  providers?.forEach((p: any) => out.push({ path: `/provider/${p.id}`, lastmod: p.updated_at, changefreq: "weekly", priority: "0.6" }));
  jobs?.forEach((j: any) => {
    const slug = (j.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || j.id;
    out.push({ path: `/jobs/${slug}-${j.id}`, lastmod: j.updated_at, changefreq: "daily", priority: "0.5" });
  });
  pages?.forEach((p: any) => p.slug && out.push({ path: `/${p.slug}`, lastmod: p.updated_at, changefreq: "monthly", priority: "0.4" }));

  return out;
}

function generateSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${new Date(e.lastmod).toISOString().slice(0, 10)}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ].filter(Boolean).join("\n"),
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

(async () => {
  try {
    const dynamic = await fetchDynamicEntries();
    const all = [...staticEntries, ...dynamic];
    writeFileSync(resolve("public/sitemap.xml"), generateSitemap(all));
    console.log(`sitemap.xml written (${all.length} entries)`);
  } catch (err) {
    console.warn("[sitemap] generation failed, writing static-only sitemap:", err);
    writeFileSync(resolve("public/sitemap.xml"), generateSitemap(staticEntries));
  }
})();