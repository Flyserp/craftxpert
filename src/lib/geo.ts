import { supabase } from "@/integrations/supabase/client";

export type LatLng = { lat: number; lng: number };

/** Haversine distance in kilometers between two coordinates. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Resolve a free-text address to coordinates using the geocode-search edge function. */
export async function geocodeAddress(query: string): Promise<LatLng | null> {
  const q = query.trim();
  if (q.length < 3) return null;
  try {
    const { data, error } = await supabase.functions.invoke("geocode-search", {
      body: null,
      // functions.invoke doesn't pass query params; fall back to raw fetch
    } as any);
    if (!error && data?.suggestions?.[0]) {
      const s = data.suggestions[0];
      return { lat: Number(s.lat), lng: Number(s.lon) };
    }
  } catch {
    // fall through to direct fetch
  }
  try {
    const projectId = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID;
    if (!projectId) return null;
    const url = `https://${projectId}.supabase.co/functions/v1/geocode-search?q=${encodeURIComponent(q)}&limit=1`;
    const anon = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
    const res = await fetch(url, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
    if (!res.ok) return null;
    const j = await res.json();
    const s = j.suggestions?.[0];
    if (!s) return null;
    return { lat: Number(s.lat), lng: Number(s.lon) };
  } catch {
    return null;
  }
}

/** Ask the browser for the user's coordinates. */
export function getBrowserLocation(): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  });
}
