import { test, expect } from "@playwright/test";

/**
 * Quick UI regression check for button heights.
 *
 * After unifying `size="sm"` Buttons to h-10 (40 px), this test visits key
 * pages at BOTH desktop and mobile viewports and asserts every visible
 * Button has one of the whitelisted heights (40 / 44 / 48 for sm /
 * default / lg). Any per-file override that drops back to h-7/h-8/h-9 —
 * including responsive overrides that only trigger on smaller screens —
 * will fail here. A screenshot of each (page × viewport) combination is
 * saved so a visual diff can be inspected on failure.
 *
 * First run creates baseline screenshots under
 * `e2e/button-height-consistency.spec.ts-snapshots/`.
 */

// Auth-gated pages redirect to /login when no session is present. That's
// intentional — the login/redirect surface still ships shadcn Buttons and
// must obey the same height contract. The measurement runs against whatever
// finally renders at the target path.
const PAGES = [
  // Public
  { name: "home",                 path: "/" },
  { name: "browse",               path: "/browse" },
  { name: "notifications",        path: "/notifications" },
  { name: "complete-profile",     path: "/complete-profile" },
  // Vendor / provider surfaces
  { name: "provider-dashboard",   path: "/provider-dashboard" },
  { name: "provider-bookings",    path: "/provider/bookings" },
  { name: "provider-services",    path: "/provider-services" },
  { name: "provider-verification",path: "/provider-verification" },
  { name: "provider-subscription",path: "/provider-subscription" },
  // Customer surfaces
  { name: "client-dashboard",     path: "/client-dashboard" },
  { name: "my-bookings",          path: "/my-bookings" },
  { name: "book-service",         path: "/book" },
  // Employer onboarding surface
  { name: "employer-dashboard",   path: "/employer-dashboard" },
  { name: "employer-verification",path: "/employer-verification" },
] as const;

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile",  width: 390,  height: 844 }, // iPhone 13/14 class
] as const;

// Allowed rendered heights for shadcn Button size variants used in the app.
// sm=40, default=44, lg=44, xl=48. Icon-sm=40 (was 32; unified with sm).
const ALLOWED_HEIGHTS = new Set([40, 44, 48]);

for (const vp of VIEWPORTS) {
  for (const p of PAGES) {
    test(`button heights consistent — ${p.name} @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(p.path, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});

      // Kill animations so screenshots + measurements are stable.
      await page.addStyleTag({
        content: `*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}`,
      });

      // Measure every visible <button> that carries the shadcn Button class
      // (identified by the always-present `inline-flex` + `whitespace-nowrap`
      // pair applied via buttonVariants).
      const heights = await page.$$eval("button", (nodes) =>
        nodes
          .filter((el) => {
            if (!(el as HTMLElement).offsetParent) return false;
            const cls = el.className || "";
            return cls.includes("inline-flex") && cls.includes("whitespace-nowrap");
          })
          .map((el) => Math.round(el.getBoundingClientRect().height)),
      );

      // Ignore zero-height (not yet laid out) and > 60 px (custom hero CTAs).
      const violations = heights.filter((h) => h > 0 && h < 60 && !ALLOWED_HEIGHTS.has(h));
      expect(
        violations,
        `Unexpected button heights on ${p.path} @ ${vp.name}: ${violations.join(", ")}`,
      ).toEqual([]);

      await expect(page).toHaveScreenshot(`buttons-${p.name}-${vp.name}.png`, {
        fullPage: false,
        maxDiffPixelRatio: 0.03,
      });
    });
  }
}
