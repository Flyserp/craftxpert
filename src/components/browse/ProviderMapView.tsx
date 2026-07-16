import { useMemo, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ProviderCardData } from "./types";

// Fix default marker icons (Leaflet+webpack issue)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface Props {
  vendors: ProviderCardData[];
}

// Deterministic hash → small lat/lng offset so vendors spread visually around a city center
function hashToOffset(str: string): [number, number] {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  const lat = ((h & 0xffff) / 0xffff - 0.5) * 0.4;
  const lng = (((h >> 16) & 0xffff) / 0xffff - 0.5) * 0.4;
  return [lat, lng];
}

const CENTER: [number, number] = [40.7128, -74.006]; // NYC default

export default function ProviderMapView({ vendors }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  const points = useMemo(
    () =>
      vendors
        .filter((v) => v.address)
        .map((v) => {
          const [latOff, lngOff] = hashToOffset(v.vendor_id);
          return { vendor: v, lat: CENTER[0] + latOff, lng: CENTER[1] + lngOff };
        }),
    [vendors]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(CENTER, 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const markerLayer = L.layerGroup().addTo(map);

    mapRef.current = map;
    markerLayerRef.current = markerLayer;

    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const markerLayer = markerLayerRef.current;
    if (!markerLayer) return;

    markerLayer.clearLayers();
    points.forEach((p) => {
      const rating = p.vendor.avg_rating > 0 ? p.vendor.avg_rating.toFixed(1) : "New";
      L.marker([p.lat, p.lng])
        .bindPopup(`
          <div class="min-w-[180px]">
            <div class="flex items-center gap-2 mb-1.5">
              <div class="w-9 h-9 rounded-lg bg-primary/10 overflow-hidden shrink-0">
                ${
                  p.vendor.avatar_url
                    ? `<img src="${p.vendor.avatar_url}" alt="" class="w-full h-full object-cover" />`
                    : `<div class="w-full h-full flex items-center justify-center text-fs-xs font-bold text-primary">${p.vendor.display_name.slice(0, 2).toUpperCase()}</div>`
                }
              </div>
              <div class="min-w-0">
                <p class="font-semibold text-fs-sm truncate !m-0">${p.vendor.display_name}</p>
                <p class="text-[13px] text-muted-foreground truncate !m-0">${p.vendor.categories[0] || "Service Pro"}</p>
              </div>
            </div>
            <div class="flex items-center gap-1 text-fs-xs mb-2">
              <span class="font-semibold">★ ${rating}</span>
              <span class="text-muted-foreground">(${p.vendor.review_count})</span>
            </div>
            <a href="/provider/${p.vendor.vendor_id}" class="inline-block text-fs-xs font-semibold text-primary hover:underline">View profile →</a>
          </div>
        `)
        .addTo(markerLayer);
    });
  }, [points]);

  return (
    <div className="relative rounded-sm overflow-hidden border border-border" style={{ height: "70vh", minHeight: 420 }}>
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-2 left-2 z-[1000] bg-card/90 backdrop-blur border border-border rounded-sm px-2 py-1 text-[10px] text-muted-foreground pointer-events-none">
        Map positions are approximate
      </div>
    </div>
  );
}
