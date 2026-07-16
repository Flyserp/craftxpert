import { Link } from "react-router-dom";
import { Megaphone } from "lucide-react";
import { useHomepageContent } from "@/hooks/useHomepageContent";

export default function PromoBanner() {
  const { content } = useHomepageContent();
  const promo = content.promo;
  if (!promo?.enabled || !promo.text?.trim()) return null;

  return (
    <div className="bg-primary text-primary-foreground">
      <div className="container-app py-2.5 flex flex-wrap items-center justify-center gap-3 text-fs-sm">
        <Megaphone className="w-4 h-4 text-accent shrink-0" />
        <span className="font-medium">{promo.text}</span>
        {promo.link_url && promo.link_label && (
          <Link
            to={promo.link_url}
            className="underline underline-offset-2 font-semibold text-accent hover:opacity-90"
          >
            {promo.link_label}
          </Link>
        )}
      </div>
    </div>
  );
}