import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Ad {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
}

interface AdSlotProps {
  placement: string;
  className?: string;
  limit?: number;
}

/** Renders active, scheduled advertisements for a placement and records impressions + clicks. */
export default function AdSlot({ placement, className, limit = 1 }: AdSlotProps) {
  const [ads, setAds] = useState<Ad[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("advertisements")
        .select("id,title,description,image_url,link_url")
        .eq("placement", placement)
        .order("sort_order", { ascending: true })
        .limit(limit);
      if (cancelled) return;
      const list = (data as Ad[]) || [];
      setAds(list);
      list.forEach((a) => {
        supabase.rpc("record_ad_event", { _ad_id: a.id, _event_type: "impression" });
      });
    })();
    return () => { cancelled = true; };
  }, [placement, limit]);

  if (ads.length === 0) return null;

  const handleClick = (ad: Ad) => {
    supabase.rpc("record_ad_event", { _ad_id: ad.id, _event_type: "click" });
  };

  return (
    <div className={className}>
      {ads.map((ad) => {
        const inner = (
          <div className="rounded-sm border border-border bg-card overflow-hidden flex flex-col sm:flex-row">
            {ad.image_url && (
              <img src={ad.image_url} alt={ad.title} className="w-full sm:w-48 h-32 sm:h-auto object-cover" loading="lazy" />
            )}
            <div className="p-4 flex-1">
              <p className="text-eyebrow mb-1">Sponsored</p>
              <p className="text-heading text-base">{ad.title}</p>
              {ad.description && <p className="text-description-sm mt-1">{ad.description}</p>}
            </div>
          </div>
        );
        return ad.link_url ? (
          <a key={ad.id} href={ad.link_url} target="_blank" rel="noreferrer sponsored" onClick={() => handleClick(ad)} className="block">
            {inner}
          </a>
        ) : (
          <div key={ad.id}>{inner}</div>
        );
      })}
    </div>
  );
}