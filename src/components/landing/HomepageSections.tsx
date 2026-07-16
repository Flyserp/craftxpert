import { lazy, Suspense } from "react";
import type { HomepageSection, HomepageSectionType } from "@/hooks/useHomepageContent";

const FeaturedServicesSection = lazy(() => import("./FeaturedServicesSection"));
const SponsoredServicesSection = lazy(() => import("./SponsoredServicesSection"));
const TopProvidersSection = lazy(() => import("./TopProvidersSection"));
const ServiceCategoriesSection = lazy(() => import("./ServiceCategoriesSection"));
const RecentServicesSection = lazy(() => import("./RecentServicesSection"));

export const SECTION_META: Record<HomepageSectionType, { label: string; description: string }> = {
  featured_services: { label: "Featured Services", description: "Curated services from active providers." },
  sponsored_services: { label: "Sponsored Services", description: "Services with active paid promotion." },
  verified_providers: { label: "Verified Providers", description: "Top-rated providers ranked by reviews." },
  popular_categories: { label: "Popular Categories", description: "Browseable service categories grid." },
  recent_services: { label: "Recently Added Services", description: "Most recently published services." },
};

const REGISTRY: Record<HomepageSectionType, React.ComponentType> = {
  featured_services: FeaturedServicesSection,
  sponsored_services: SponsoredServicesSection,
  verified_providers: TopProvidersSection,
  popular_categories: ServiceCategoriesSection,
  recent_services: RecentServicesSection,
};

export default function HomepageSections({ sections }: { sections: HomepageSection[] }) {
  return (
    <Suspense fallback={null}>
      {sections
        .filter((s) => s.enabled && REGISTRY[s.type])
        .map((s) => {
          const Cmp = REGISTRY[s.type];
          return <Cmp key={s.id} />;
        })}
    </Suspense>
  );
}