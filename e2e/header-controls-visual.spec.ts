import { test, expect } from "@playwright/test";

/**
 * Visual regression test for the header icon-button cluster.
 *
 * Captures a screenshot of the right-side header controls (theme toggle,
 * notification bell when logged in, avatar/login icon, compact menu / mobile
 * hamburger) at three viewports so future style drift — e.g. someone bumping
 * the size from h-9 w-9 back to h-8 w-8, or losing the rounded-full shape — is
 * caught automatically.
 *
 * The first run will create baseline snapshots in
 * `e2e/header-controls-visual.spec.ts-snapshots/`. Subsequent runs diff against
 * them with a small pixel tolerance to absorb font anti-aliasing noise.
 */

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 720 },
  { name: "tablet", width: 1024, height: 720 },
  { name: "desktop", width: 1280, height: 720 },
] as const;

for (const vp of VIEWPORTS) {
  test(`header controls layout — ${vp.name} (${vp.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/");

    // Wait for the header to be present + the splash/preloader to finish so the
    // screenshot is stable.
    const header = page.locator("header").first();
    await expect(header).toBeVisible();
    await page.waitForLoadState("networkidle");

    // Disable animations & caret blink for deterministic pixels.
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
          caret-color: transparent !important;
        }
      `,
    });

    // Sanity-check that every header icon button has the unified size class so
    // the test fails with a clear assertion (not just a pixel diff) if someone
    // bypasses the HeaderIconButton wrapper.
    const iconButtons = header.locator(
      'button[aria-label="Toggle theme"], ' +
        'button[aria-label="Notifications"], ' +
        'button[aria-label="Account menu"], ' +
        'button[aria-label="Open compact menu"], ' +
        'button[aria-label="Open menu"], ' +
        'button[aria-label="Close menu"], ' +
        'button[aria-label="Log in"]',
    );

    const count = await iconButtons.count();
    for (let i = 0; i < count; i++) {
      const btn = iconButtons.nth(i);
      const box = await btn.boundingBox();
      expect(box, `icon button #${i} should have a bounding box`).not.toBeNull();
      // h-9 w-9 → 36×36 CSS px. Allow ±1 px for sub-pixel rounding.
      expect(box!.width).toBeGreaterThanOrEqual(35);
      expect(box!.width).toBeLessThanOrEqual(37);
      expect(box!.height).toBeGreaterThanOrEqual(35);
      expect(box!.height).toBeLessThanOrEqual(37);

      // Border-radius must be a full pill (≥ half the height) for visual parity.
      const radius = await btn.evaluate(
        (el) => parseFloat(getComputedStyle(el as HTMLElement).borderTopLeftRadius) || 0,
      );
      expect(radius, `icon button #${i} should be rounded-full`).toBeGreaterThanOrEqual(16);
    }

    // Snapshot just the right-aligned controls cluster (everything after the
    // logo) to avoid noise from hero copy, search input, etc.
    await expect(header).toHaveScreenshot(`header-${vp.name}.png`, {
      maxDiffPixelRatio: 0.02,
    });
  });
}
