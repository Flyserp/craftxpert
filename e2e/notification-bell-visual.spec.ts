import { test, expect, type Page } from "../playwright-fixture";
import { getFirstClientCredentials, type TestCredentials } from "./helpers/providers";

/**
 * Visual regression for the header NotificationBell.
 *
 * Guards two things across breakpoints (mobile / tablet / desktop):
 *  1. The bell icon renders inside the standard 36×36 HeaderIconButton.
 *  2. If an unread badge is present, it sits in the top-right corner of the
 *     bell (overlapping the icon by a few px), is roughly circular, and uses
 *     the destructive token.
 *
 * The screenshot is scoped tightly to the bell button so unrelated header
 * drift (logo, menus, theme toggle) doesn't cause false diffs. First run
 * creates baselines under
 * `e2e/notification-bell-visual.spec.ts-snapshots/`.
 */

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 720 },
  { name: "tablet", width: 1024, height: 720 },
  { name: "desktop", width: 1280, height: 720 },
] as const;

let creds: TestCredentials;

test.beforeAll(async () => {
  creds = await getFirstClientCredentials();
});

async function signIn(page: Page, c: TestCredentials) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill(c.email);
  await page.getByLabel(/password/i, { exact: false }).first().fill(c.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}

async function freezeAnimations(page: Page) {
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
}

for (const vp of VIEWPORTS) {
  test(`NotificationBell layout — ${vp.name} (${vp.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await signIn(page, creds);

    // Land on a page that always renders the unified header with the bell.
    await page.goto("/client-dashboard");
    await page.waitForLoadState("networkidle").catch(() => {});
    await freezeAnimations(page);

    // The visible bell may live in different header slots depending on
    // breakpoint (UnifiedHeader renders the bell in 3 responsive containers).
    // Pick the first one that's actually visible.
    const bell = page.getByTestId("notification-bell").first();
    await expect(bell).toBeVisible({ timeout: 15_000 });

    // 1) Bell button must be the canonical 36×36 HeaderIconButton.
    const box = await bell.boundingBox();
    expect(box, "bell should have a bounding box").not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(35);
    expect(box!.width).toBeLessThanOrEqual(37);
    expect(box!.height).toBeGreaterThanOrEqual(35);
    expect(box!.height).toBeLessThanOrEqual(37);

    // 2) If a badge is present, assert it's pinned to the top-right of the
    //    bell and roughly circular — the canonical `-top-0.5 -right-0.5
    //    rounded-full` styling from NotificationBell.tsx.
    const badge = bell.getByTestId("notification-badge");
    const badgeCount = await badge.count();
    expect(
      badgeCount,
      "at most one unread badge per bell",
    ).toBeLessThanOrEqual(1);

    if (badgeCount === 1) {
      const bbox = await badge.boundingBox();
      expect(bbox, "badge should have a bounding box").not.toBeNull();

      // Top-right anchored: badge's right edge should be near (or just past)
      // the bell's right edge, and badge's top should be near the bell's top.
      const bellRight = box!.x + box!.width;
      const bellTop = box!.y;
      expect(Math.abs(bbox!.x + bbox!.width - bellRight)).toBeLessThanOrEqual(6);
      expect(Math.abs(bbox!.y - bellTop)).toBeLessThanOrEqual(6);

      // Roughly circular pill (min 18×18, width may grow with 2-digit count).
      expect(bbox!.height).toBeGreaterThanOrEqual(16);
      expect(bbox!.height).toBeLessThanOrEqual(22);
      expect(bbox!.width).toBeGreaterThanOrEqual(16);
    }

    // 3) Pixel-level snapshot of just the bell (icon + optional badge).
    await expect(bell).toHaveScreenshot(`notification-bell-${vp.name}.png`, {
      maxDiffPixelRatio: 0.02,
    });
  });
}
