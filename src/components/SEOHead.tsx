import { useEffect } from "react";
import { usePwaBranding } from "@/hooks/usePwaBranding";

interface SEOHeadProps {
  title?: string;
  description?: string;
  canonical?: string;
  type?: "website" | "article";
  image?: string;
  jsonLd?: Record<string, any>;
}

const FALLBACK_SITE_NAME = "TaskHive";
const DEFAULT_DESC = "Book trusted handyman professionals in minutes. AI-powered matching, real-time bookings, and multi-tenant SaaS marketplace for on-demand home services.";
const DEFAULT_IMAGE = "https://lovable.dev/opengraph-image-p98pqg.png";

export default function SEOHead({
  title,
  description,
  canonical,
  type = "website",
  image,
  jsonLd,
}: SEOHeadProps) {
  const { siteName, siteTagline, ogImageUrl } = usePwaBranding();
  const name = siteName || FALLBACK_SITE_NAME;
  const desc = description || siteTagline || DEFAULT_DESC;
  const img = image || ogImageUrl || DEFAULT_IMAGE;
  const fullTitle = title ? `${title} | ${name}` : (siteTagline ? `${name} – ${siteTagline}` : `${name} – On-Demand & Handyman Services Marketplace`);

  useEffect(() => {
    document.title = fullTitle;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        if (property.startsWith("og:") || property.startsWith("twitter:")) {
          el.setAttribute("property", property);
        } else {
          el.setAttribute("name", property);
        }
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("description", desc);
    setMeta("og:title", fullTitle);
    setMeta("og:description", desc);
    setMeta("og:type", type);
    setMeta("og:image", img);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", desc);
    setMeta("twitter:image", img);

    // Canonical
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical) {
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", canonical);
    } else {
      link?.remove();
    }

    // JSON-LD
    const ldId = "seo-jsonld";
    let script = document.getElementById(ldId) as HTMLScriptElement | null;
    if (jsonLd) {
      if (!script) {
        script = document.createElement("script");
        script.id = ldId;
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    } else {
      script?.remove();
    }

    return () => {
      document.getElementById(ldId)?.remove();
    };
  }, [fullTitle, desc, canonical, type, img, jsonLd]);

  return null;
}
