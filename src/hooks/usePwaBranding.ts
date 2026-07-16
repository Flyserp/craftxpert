import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getCachedBrandVersion,
  setCachedBrandVersion,
  withBrandVersion,
} from "@/lib/brand/brandVersion";

/** Event name dispatched on `window` whenever branding is saved so every
 *  mounted `usePwaBranding()` refetches and re-renders. */
export const BRANDING_UPDATED_EVENT = "branding:updated";

/** Call after saving platform_settings to refresh all consumers in-app. */
export function notifyBrandingUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BRANDING_UPDATED_EVENT));
  }
}

export interface PwaBranding {
  iconUrl: string | null;
  appName: string;
  shortName: string;
  themeColor: string;
  backgroundColor: string;
  /** Optional per-tenant brand override (hex). When set, overrides the CSS --primary token at runtime. */
  brandPrimary: string | null;
  /** Optional per-tenant brand override (hex). When set, overrides the CSS --accent token at runtime. */
  brandAccent: string | null;
  /** Site-level branding, editable in Admin → Platform Settings → Branding. */
  siteName: string | null;
  siteTagline: string | null;
  logoUrl: string | null;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  /** Monotonic version string. Bumped by DB trigger on any branding write.
   *  All branding URLs above are already cache-busted with `?bv=<version>`. */
  brandVersion: string | null;
}

const DEFAULTS: PwaBranding = {
  iconUrl: null,
  appName: "TaskHive",
  shortName: "TaskHive",
  themeColor: "#00272c",
  backgroundColor: "#f7f9f7",
  brandPrimary: null,
  brandAccent: null,
  siteName: null,
  siteTagline: null,
  logoUrl: null,
  logoLightUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  ogImageUrl: null,
  brandVersion: null,
};


const KEYS = [
  "pwa_icon_url",
  "pwa_app_name",
  "pwa_short_name",
  "pwa_theme_color",
  "pwa_background_color",
  "brand_primary",
  "brand_accent",
  "brand_version",
  "site_name",
  "site_tagline",
  "site_logo_url",
  "site_logo_light_url",
  "site_logo_dark_url",
  "site_pwa_logo_url",
  "site_favicon_url",
  "site_og_image_url",
] as const;

/**
 * Loads PWA branding from platform_settings and returns it.
 * Side effect: also patches the live <link rel="icon">, theme-color meta tag,
 * and apple-touch-icon so the running app reflects the latest branding.
 */
export function usePwaBranding(): PwaBranding & { loading: boolean; refresh: () => void } {
  const [branding, setBranding] = useState<PwaBranding>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", KEYS as unknown as string[]);

      if (cancelled) return;

      const map = new Map((data ?? []).map((r) => [r.key, r.value]));
      const siteName = map.get("site_name") || null;
      const siteShort = map.get("pwa_short_name") || siteName || DEFAULTS.shortName;
      const brandVersion = map.get("brand_version") || getCachedBrandVersion();
      // Bust every branding-related URL with the tenant brand version. Even if
      // the SW purge in main.tsx fails, a bumped version produces a different
      // Cache Storage key so returning users still fetch fresh assets.
      const bv = (u: string | null) => withBrandVersion(u, brandVersion);
      const next: PwaBranding = {
        iconUrl: bv(map.get("pwa_icon_url") || map.get("site_pwa_logo_url") || null),
        appName: map.get("pwa_app_name") || siteName || DEFAULTS.appName,
        shortName: siteShort,
        themeColor: map.get("pwa_theme_color") || DEFAULTS.themeColor,
        backgroundColor: map.get("pwa_background_color") || DEFAULTS.backgroundColor,
        brandPrimary: map.get("brand_primary") || null,
        brandAccent: map.get("brand_accent") || null,
        siteName,
        siteTagline: map.get("site_tagline") || null,
        logoUrl: bv(map.get("site_logo_url") || null),
        logoLightUrl: bv(map.get("site_logo_light_url") || null),
        logoDarkUrl: bv(map.get("site_logo_dark_url") || null),
        faviconUrl: bv(map.get("site_favicon_url") || null),
        ogImageUrl: bv(map.get("site_og_image_url") || null),
        brandVersion,
      };
      setCachedBrandVersion(brandVersion);
      setBranding(next);
      applyBrandingToDocument(next);
      applyBrandColors(next.brandPrimary, next.brandAccent);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onUpdate = () => refresh();
    window.addEventListener(BRANDING_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(BRANDING_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  return { ...branding, loading, refresh };
}

function applyBrandingToDocument(b: PwaBranding) {
  if (typeof document === "undefined") return;

  // URLs from the hook are already `?bv=<version>`-busted. Fall back to a URL
  // hash only if no brand version is available yet (very first paint on a
  // never-loaded client).
  const bust = (url: string) =>
    b.brandVersion ? url : url + (url.includes("?") ? "&" : "?") + "v=" + hash(url);



  const favicon = b.faviconUrl || b.iconUrl;
  if (favicon) {
    upsertLink("icon", bust(favicon), "image/png");
    upsertLink("shortcut icon", bust(favicon), "image/png");
  }
  if (b.iconUrl) {
    upsertLink("apple-touch-icon", bust(b.iconUrl));
  }

  upsertMeta("theme-color", b.themeColor);
  upsertMeta("apple-mobile-web-app-title", b.shortName);
  upsertMeta("application-name", b.appName);

  applyDynamicManifest(b, bust);

  if (b.siteName) {
    const suffix = b.siteTagline ? ` — ${b.siteTagline}` : "";
    // Only overwrite when doc still shows the default/template title.
    if (!document.title || /lovable|vite|taskhive/i.test(document.title)) {
      document.title = b.siteName + suffix;
    }
  }
}

let lastManifestUrl: string | null = null;
function applyDynamicManifest(b: PwaBranding, bust: (u: string) => string) {
  const icon = b.iconUrl || b.faviconUrl;
  const manifest: Record<string, unknown> = {
    name: b.appName,
    short_name: b.shortName,
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: b.themeColor,
    background_color: b.backgroundColor,
  };
  if (b.siteTagline) manifest.description = b.siteTagline;
  if (icon) {
    manifest.icons = [
      { src: bust(icon), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: bust(icon), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: bust(icon), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ];
  }
  const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
  const url = URL.createObjectURL(blob);
  let link = document.head.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    document.head.appendChild(link);
  }
  link.href = url;
  if (lastManifestUrl) URL.revokeObjectURL(lastManifestUrl);
  lastManifestUrl = url;
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function upsertLink(rel: string, href: string, type?: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
  if (type) el.type = type;
}

function upsertMeta(name: string, content: string) {
  let el = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

/* ============================================================
   Per-tenant brand color overrides.
   - Tenants set `brand_primary` / `brand_accent` (hex) in platform_settings.
   - At runtime we convert to space-separated HSL (the format the rest of
     the design tokens use) and write them to :root.
   - Foreground + ring are auto-selected for AA contrast — admins never
     have to pick those by hand.
   ============================================================ */
export function applyBrandColors(primaryHex: string | null, accentHex: string | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");

  const apply = (hex: string | null, token: string, fgToken: string, alsoRing = false) => {
    if (!hex) {
      root.style.removeProperty(`--${token}`);
      root.style.removeProperty(`--${fgToken}`);
      if (alsoRing) root.style.removeProperty("--ring");
      return;
    }
    const hsl = hexToHslTriplet(hex);
    if (!hsl) return;
    root.style.setProperty(`--${token}`, hsl);
    root.style.setProperty(`--${fgToken}`, pickReadableForeground(hex));
    if (alsoRing) root.style.setProperty("--ring", hsl);
  };

  // In dark mode, keep the CSS-token lime primary (better contrast on dark surfaces)
  // and let tenant brand override only take effect in light mode.
  if (isDark) {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--primary-foreground");
    root.style.removeProperty("--ring");
  } else {
    apply(primaryHex, "primary", "primary-foreground", true);
  }
  apply(accentHex, "accent", "accent-foreground");

  // Cache last-applied brand so we can re-apply after a theme toggle.
  (window as any).__lovableBrand = { primaryHex, accentHex };

  // Keep the browser toolbar / PWA theme-color meta in sync with the
  // currently-resolved --primary token so it flips with dark/light.
  syncThemeColorMeta();
}

/** Re-apply brand tokens using the last-applied brand (called after theme change). */
export function reapplyBrandColors() {
  const cached = (typeof window !== "undefined" ? (window as any).__lovableBrand : null) as
    | { primaryHex: string | null; accentHex: string | null } | null;
  if (cached) applyBrandColors(cached.primaryHex, cached.accentHex);
  else syncThemeColorMeta();
}

/** Read the currently-resolved `--primary` HSL token and write it (as hex)
 *  into `<meta name="theme-color">`. Called after every branding / theme
 *  change so PWA chrome matches the on-screen primary. */
export function syncThemeColorMeta() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const triplet = getComputedStyle(root).getPropertyValue("--primary").trim();
  const hex = hslTripletToHex(triplet);
  if (!hex) return;
  let el = document.head.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.name = "theme-color";
    document.head.appendChild(el);
  }
  el.content = hex;
}

/** Convert "H S% L%" (space-separated triplet) → "#rrggbb". */
export function hslTripletToHex(triplet: string): string | null {
  const m = triplet.match(/^\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%\s*$/);
  if (!m) return null;
  const h = parseFloat(m[1]) / 360;
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Convert "#rrggbb" / "#rgb" → "H S% L%" (space-separated, no `hsl()` wrapper). */
export function hexToHslTriplet(hex: string): string | null {
  const m = hex.trim().replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Return the foreground HSL triplet that meets AA contrast against `hex` — black for light brands, white for dark. */
export function pickReadableForeground(hex: string): string {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const toLin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLin(parseInt(full.slice(0, 2), 16));
  const g = toLin(parseInt(full.slice(2, 4), 16));
  const b = toLin(parseInt(full.slice(4, 6), 16));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Pick whichever of black/white gives the higher WCAG contrast ratio.
  // (Fixed-threshold heuristics misjudge mid-luminance colors like lime/yellow.)
  const contrastWithWhite = (1 + 0.05) / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / (0 + 0.05);
  return contrastWithBlack >= contrastWithWhite ? "0 0% 9%" : "0 0% 100%";
}
