// Address autocomplete proxy for OpenStreetMap Nominatim.
// Nominatim requires a descriptive User-Agent and rate-limits to ~1 req/sec.
// We proxy from the edge so the browser never hits Nominatim directly
// (which would be CORS-blocked + UA-blocked) and so we can apply a tiny
// in-memory cache to soften the rate limit.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

interface Suggestion {
  id: string;
  label: string;
  lat: number;
  lon: number;
  address: Record<string, string>;
}

// 5-minute LRU-ish cache (per cold-start). Keeps repeat keystrokes off Nominatim.
const CACHE = new Map<string, { at: number; data: Suggestion[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 5), 1), 10);

    if (q.length < 3) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = `${q.toLowerCase()}|${limit}`;
    const hit = CACHE.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return new Response(JSON.stringify({ suggestions: hit.data, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const params = new URLSearchParams({
      q,
      format: "jsonv2",
      addressdetails: "1",
      limit: String(limit),
    });

    const resp = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        // Nominatim usage policy requires a descriptive UA with a contact URL.
        "User-Agent": "LovableMarketplace/1.0 (https://lovable.dev; address-autocomplete)",
        "Accept-Language": req.headers.get("accept-language") ?? "en",
      },
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("Nominatim error:", resp.status, t);
      return new Response(
        JSON.stringify({ error: "Address lookup failed. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const raw = (await resp.json()) as NominatimResult[];
    const suggestions: Suggestion[] = (Array.isArray(raw) ? raw : []).map((r) => ({
      id: String(r.place_id),
      label: r.display_name,
      lat: Number(r.lat),
      lon: Number(r.lon),
      address: r.address ?? {},
    }));

    CACHE.set(key, { at: Date.now(), data: suggestions });
    // Prevent the cache from growing unbounded on long-lived isolates.
    if (CACHE.size > 500) {
      const oldestKey = CACHE.keys().next().value;
      if (oldestKey) CACHE.delete(oldestKey);
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("geocode-search error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
