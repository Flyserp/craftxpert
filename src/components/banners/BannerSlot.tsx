import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  description: string | null;
}

interface Props {
  placement: "homepage" | "category" | "promo" | "sidebar" | "footer";
  categoryId?: string;
  className?: string;
  limit?: number;
}

export default function BannerSlot({ placement, categoryId, className, limit = 3 }: Props) {
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    let q: any = (supabase as any)
      .from("banners")
      .select("id,title,image_url,link_url,description,category_id")
      .eq("placement", placement)
      .eq("is_active", true)
      .order("position");
    if (placement === "category" && categoryId) q = q.eq("category_id", categoryId);
    q.limit(limit).then(({ data }: any) => setBanners((data as Banner[]) || []));
  }, [placement, categoryId, limit]);

  if (banners.length === 0) return null;
  return (
    <div className={className ?? "grid gap-3"}>
      {banners.map((b) => {
        const inner = (
          <div className="relative overflow-hidden rounded-sm border border-border bg-card">
            <img src={b.image_url} alt={b.title} className="w-full h-auto object-cover" loading="lazy" />
            {(b.title || b.description) && (
              <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/60 to-transparent text-white">
                <p className="font-semibold">{b.title}</p>
                {b.description && <p className="text-fs-sm opacity-90">{b.description}</p>}
              </div>
            )}
          </div>
        );
        return b.link_url ? (
          <a key={b.id} href={b.link_url} target="_blank" rel="noreferrer">{inner}</a>
        ) : (
          <div key={b.id}>{inner}</div>
        );
      })}
    </div>
  );
}