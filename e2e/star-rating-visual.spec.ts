import { test, expect } from "@playwright/test";

/**
 * Visual regression for the shared <StarRating> component in both light and
 * dark themes. Rating stars render through a single component (see
 * `src/components/ui/StarRating.tsx`), so a pixel snapshot of one instance
 * catches every theming or fill regression across the app.
 *
 * The first run creates baseline snapshots in
 * `e2e/star-rating-visual.spec.ts-snapshots/`. Subsequent runs diff against
 * them with a small pixel tolerance to absorb font/AA noise.
 */

const THEMES = ["light", "dark"] as const;

for (const theme of THEMES) {
  test(`StarRating visual — ${theme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    // Force the theme BEFORE first paint so hydration matches.
    await page.addInitScript((t) => {
      try {
        localStorage.setItem("theme", t);
      } catch {
        /* private mode */
      }
    }, theme);

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Belt + braces: also toggle the class in case the app reads a different key.
    await page.evaluate((t) => {
      document.documentElement.classList.toggle("dark", t === "dark");
    }, theme);

    // Kill animations for deterministic pixels.
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

    // Testimonials on the landing page render <StarRating count={t.rating} />.
    // The role="img" wrapper is the deterministic hook.
    const star = page.locator('[role="img"][aria-label*="star"]').first();
    await star.scrollIntoViewIfNeeded();
    await expect(star).toBeVisible();

    // Sanity assertion so the failure surfaces as a clear message (not just a
    // pixel diff) if the component is ever rewritten with different classes.
    const svgCount = await star.locator("svg").count();
    expect(svgCount).toBeGreaterThan(0);

    await expect(star).toHaveScreenshot(`star-rating-${theme}.png`, {
      maxDiffPixelRatio: 0.02,
    });
  });
}
