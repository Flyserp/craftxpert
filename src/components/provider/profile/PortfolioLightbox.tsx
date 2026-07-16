import { useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, ExternalLink, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LightboxItem {
  id: string;
  image_url: string;
  caption: string | null;
  media_type?: "image" | "video" | "pdf";
  title?: string | null;
  description?: string | null;
}

interface PortfolioLightboxProps {
  items: LightboxItem[];
  index: number | null;
  onClose: () => void;
  onChange: (next: number) => void;
}

export default function PortfolioLightbox({
  items, index, onClose, onChange,
}: PortfolioLightboxProps) {
  const total = items.length;
  const current = index !== null ? items[index] : null;

  const goPrev = useCallback(() => {
    if (index === null) return;
    onChange((index - 1 + total) % total);
  }, [index, total, onChange]);
  const goNext = useCallback(() => {
    if (index === null) return;
    onChange((index + 1) % total);
  }, [index, total, onChange]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, onClose, goPrev, goNext]);

  if (index === null || !current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Portfolio image viewer"
    >
      <div
        className="fixed inset-0 bg-overlay backdrop-blur-sm"
        onClick={onClose}
      />

      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-white/10 text-white text-fs-xs font-medium tabular-nums">
        {index + 1} / {total}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            aria-label="Next image"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      <div className="relative max-w-5xl w-full max-h-[88vh] flex flex-col items-center">
        {current.media_type === "video" ? (
          <video
            src={current.image_url}
            controls
            autoPlay
            className="max-w-full max-h-[78vh] rounded-lg bg-black"
          />
        ) : current.media_type === "pdf" ? (
          <div className="w-full h-[78vh] bg-white rounded-lg overflow-hidden flex flex-col">
            <iframe
              src={current.image_url}
              title={current.title || "PDF document"}
              className="flex-1 w-full"
            />
            <a
              href={current.image_url}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 text-fs-xs font-medium text-foreground flex items-center gap-1.5 border-t"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open PDF in new tab
            </a>
          </div>
        ) : (
          <img
            src={current.image_url}
            alt={current.title || current.caption || "Portfolio work"}
            className="max-w-full max-h-[78vh] object-contain rounded-lg"
          />
        )}
        {(current.title || current.description || current.caption) && (
          <div className="text-center mt-3 max-w-2xl space-y-1">
            {current.title && (
              <p className="text-fs-base font-semibold text-white flex items-center justify-center gap-2">
                {current.media_type === "pdf" && <FileText className="w-4 h-4" />}
                {current.title}
              </p>
            )}
            {current.description && (
              <p className="text-fs-sm text-white/85">{current.description}</p>
            )}
            {!current.title && !current.description && current.caption && (
              <p className="text-fs-sm text-white/85">{current.caption}</p>
            )}
          </div>
        )}

        {total > 1 && (
          <div className="flex justify-center gap-1.5 mt-4 flex-wrap max-w-full">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(i); }}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i === index ? "bg-white w-6" : "bg-white/30 hover:bg-white/60",
                )}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
