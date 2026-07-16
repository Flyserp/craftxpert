import { useEffect } from "react";
import { usePwaBranding } from "@/hooks/usePwaBranding";
import { validateBrandToken } from "@/lib/brand/validateBrandToken";

/**
 * Headless component: loads PWA branding from platform_settings and patches
 * <link rel="icon">, theme-color, and apple-touch-icon at runtime so the
 * installed app reflects the latest admin-uploaded icon and colors.
 *
 * Also runs a lightweight startup validator that logs a console warning if
 * the runtime `--primary` / `--accent` CSS tokens drift from the hex values
 * in platform_settings (e.g. someone saved an invalid hex, or a rebuild
 * changed the CSS token without updating the DB row).
 */
export default function PwaBrandingApplier() {
  const { loading, brandPrimary, brandAccent } = usePwaBranding();

  useEffect(() => {
    if (loading) return;
    // `applyBrandColors` already ran inside usePwaBranding — read the
    // resolved --primary / --accent CSS tokens back and confirm they match
    // the hex values in platform_settings. Reads on next paint so the
    // inline style write has committed.
    const rafId = requestAnimationFrame(() => {
      validateBrandToken("primary", brandPrimary);
      validateBrandToken("accent", brandAccent);
    });
    return () => cancelAnimationFrame(rafId);
  }, [loading, brandPrimary, brandAccent]);

  return null;
}
