import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface HomepageStat { value: string; label: string; icon?: string }
export interface HomepageTestimonial { name: string; role: string; location: string; text: string; rating: number; initials: string }
export interface HomepagePromo { enabled: boolean; text: string; link_label?: string; link_url?: string }
export interface HomepageFooter { tagline: string; email: string; phone: string; address: string; newsletter_title: string; newsletter_subtitle: string }
export interface HomepageHero {
  badge: string;
  title_prefix: string;
  title_accent: string;
  subtitle: string;
  popular_searches: string[];
}
export type HomepageSectionType =
  | "featured_services"
  | "sponsored_services"
  | "verified_providers"
  | "popular_categories"
  | "recent_services";
export interface HomepageSection {
  id: string;
  type: HomepageSectionType;
  enabled: boolean;
}
export interface HomepageContent {
  hero: HomepageHero;
  stats: HomepageStat[];
  testimonials: HomepageTestimonial[];
  promo: HomepagePromo;
  footer: HomepageFooter;
  sections: HomepageSection[];
}

export const DEFAULT_HOMEPAGE: HomepageContent = {
  hero: {
    badge: "Verified & Insured Professionals",
    title_prefix: "Connect with Nearby ",
    title_accent: "Top-rated Pros",
    subtitle: "We connect you to the right service, first time and every time. Book trusted professionals in minutes.",
    popular_searches: ["Plumber", "Electrician", "Painter", "HVAC", "Cleaning"],
  },
  stats: [
    { value: "12,000+", label: "Verified Providers" },
    { value: "90,000+", label: "Services Completed" },
    { value: "2.3M+", label: "Reviews Globally" },
    { value: "150+", label: "Cities Covered" },
  ],
  testimonials: [
    { name: "Jessica Reynolds", role: "Homeowner", location: "Brooklyn, NY", rating: 5, initials: "JR", text: "TaskHive matched me with an amazing plumber in under 30 minutes. He arrived same-day and fixed a leak I'd been worrying about for weeks." },
    { name: "David Kim", role: "Property Manager", location: "Austin, TX", rating: 5, initials: "DK", text: "Managing 12 rental properties used to be a nightmare for maintenance. Now I book everything through TaskHive — all vetted and reliable." },
    { name: "Maria Santos", role: "Homeowner", location: "Chicago, IL", rating: 5, initials: "MS", text: "The AI matching was spot-on. The carpenter who came was professional, on time, and his work was flawless." },
  ],
  promo: { enabled: false, text: "🎉 Limited time: Get 20% off your first booking with code WELCOME20", link_label: "Browse services", link_url: "/browse" },
  footer: {
    tagline: "The AI-powered marketplace connecting homeowners with trusted, verified service professionals.",
    email: "support@taskhive.app",
    phone: "+1 (555) 123-4567",
    address: "New York, NY 10001",
    newsletter_title: "Stay updated with TaskHive",
    newsletter_subtitle: "Get the latest updates, tips, and exclusive offers delivered to your inbox.",
  },
  sections: [
    { id: "popular_categories", type: "popular_categories", enabled: true },
    { id: "featured_services", type: "featured_services", enabled: true },
    { id: "sponsored_services", type: "sponsored_services", enabled: true },
    { id: "verified_providers", type: "verified_providers", enabled: true },
    { id: "recent_services", type: "recent_services", enabled: true },
  ],
};

function mergeContent(raw: any): HomepageContent {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    hero: { ...DEFAULT_HOMEPAGE.hero, ...(r.hero || {}) },
    stats: Array.isArray(r.stats) && r.stats.length ? r.stats : DEFAULT_HOMEPAGE.stats,
    testimonials: Array.isArray(r.testimonials) && r.testimonials.length ? r.testimonials : DEFAULT_HOMEPAGE.testimonials,
    promo: { ...DEFAULT_HOMEPAGE.promo, ...(r.promo || {}) },
    footer: { ...DEFAULT_HOMEPAGE.footer, ...(r.footer || {}) },
    sections: Array.isArray(r.sections) && r.sections.length
      ? r.sections.filter((s: any) => s && s.type)
      : DEFAULT_HOMEPAGE.sections,
  };
}

export function useHomepageContent() {
  const [content, setContent] = useState<HomepageContent>(DEFAULT_HOMEPAGE);
  const [loading, setLoading] = useState(true);
  const channelId = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
  );

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("homepage_content")
      .select("content")
      .eq("singleton", true)
      .maybeSingle();
    setContent(mergeContent(data?.content));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`homepage_content_changes:${channelId.current}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "homepage_content" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const save = useCallback(async (next: HomepageContent) => {
    const { error } = await (supabase as any)
      .from("homepage_content")
      .update({ content: next, updated_by: (await supabase.auth.getUser()).data.user?.id })
      .eq("singleton", true);
    if (error) throw error;
    setContent(next);
  }, []);

  return { content, loading, save, reload: load };
}