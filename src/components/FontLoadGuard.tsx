import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";

/**
 * Runtime guard: verifies the primary web font (Inter) loads successfully.
 * If Inter fails to load, the browser falls back to Geist / system-ui, which
 * changes the entire app's typography. This component surfaces that failure
 * as a visible warning so it doesn't go unnoticed in production.
 */
export default function FontLoadGuard() {
  useEffect(() => {
    if (typeof document === "undefined" || !("fonts" in document)) return;

    let cancelled = false;

    const check = async () => {
      try {
        // Wait for any pending font loads to settle, then explicitly request Inter.
        await document.fonts.ready;
        await document.fonts.load('16px "Inter"').catch(() => []);

        if (cancelled) return;

        const interLoaded = document.fonts.check('16px "Inter"');
        const bodyFamily = getComputedStyle(document.body).fontFamily || "";
        const firstFamily = bodyFamily
          .split(",")[0]
          ?.trim()
          .replace(/^["']|["']$/g, "")
          .toLowerCase();

        // Primary font must be Inter AND the face must actually be available.
        // If Inter isn't first in the cascade, styling changed intentionally — skip.
        if (firstFamily !== "inter") return;

        if (!interLoaded) {
          // eslint-disable-next-line no-console
          console.warn(
            "[FontLoadGuard] Inter failed to load — falling back to Geist/system fonts.",
            { bodyFamily },
          );
          document.documentElement.setAttribute("data-font-fallback", "true");
          toast({
            variant: "destructive",
            title: "Typography degraded",
            description:
              "The Inter web font failed to load. The app is using a fallback font — check your network or ad-blocker.",
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[FontLoadGuard] font check failed", err);
      }
    };

    // Small delay so we don't race the initial stylesheet fetch.
    const t = window.setTimeout(check, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  return null;
}
