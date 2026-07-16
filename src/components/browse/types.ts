export interface ProviderCardData {
  vendor_id: string;
  display_name: string;
  address: string | null;
  bio: string | null;
  avatar_url: string | null;
  services: { id: string; title: string; price_min: number | null; price_type: string; category_name: string; subcategory_id: string | null; subcategory_name: string | null }[];
  avg_rating: number;
  review_count: number;
  categories: string[];
  available_slots: number;
  bookings_30d: number;
  plan_name: string | null;
  ranking_boost: number;
  is_sponsored?: boolean;
  sponsored_until?: string | null;
  is_featured?: boolean;
}

export interface BrowseFilters {
  search: string;
  locationFilter: string;
  activeCategory: string;
  activeSubcategory: string;
  sortBy: "relevance" | "rating" | "price" | "booked" | "reviews";
  priceRange: [number, number];
  priceFilterActive: boolean;
  minRating: number;
  availableOnly: boolean;
  emergencyMode: boolean;
}