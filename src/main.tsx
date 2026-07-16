import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { purgeBrandingCaches } from "./lib/pwa/purgeBrandingCaches";


// ────────────────────────────────────────────────────────────────────────────────
// Service Worker / PWA registration guard
// ────────────────────────────────────────────────────────────────────────────────
// Lovable previews run inside an iframe. Service workers there cause stale
// content, broken navigation, and persistent cache pollution. We must NEVER
// register a service worker in those contexts. PWA features (install,
// offline) only activate on the published/deployed origin.
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com") ||
  window.location.hostname.includes("lovable.dev");

if (isPreviewHost || isInIframe) {
  // Defensive cleanup: remove any SW that might have been registered earlier
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
  }
} else if ("serviceWorker" in navigator && import.meta.env.PROD) {
  // Production deployment: let vite-plugin-pwa's auto-register virtual module
  // handle SW lifecycle. Importing it lazily avoids dev-time noise.
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch(() => {
      // Plugin not available — fail silently
    });

  // ──────────────────────────────────────────────────────────────────────────
  // Branding cache purge on SW update
  // ──────────────────────────────────────────────────────────────────────────
  // See src/lib/pwa/purgeBrandingCaches.ts for the eviction rules. Fires once
  // per session, right after the new SW claims the page, then soft-reloads so
  // the fresh CSS bundle + tenant settings apply on the next paint.
  let reloadedOnce = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadedOnce) return;
    reloadedOnce = true;
    void purgeBrandingCaches().finally(() => {
      window.location.reload();
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
