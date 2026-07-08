import { test, expect, type Page } from "../playwright-fixture";
import {
  getFirstClientCredentials,
  type TestCredentials,
} from "./helpers/providers";

/**
 * Notification badge stable-count regression test.
 *
 * Guards against two bug classes that have appeared previously:
 *   1. The unread badge gets *duplicated* into another header surface
 *      (profile dropdown, mobile menu, page title, etc.) — there must
 *      be at most ONE badge in the DOM at any time.
 *   2. Navigating between routes or toggling the profile dropdown causes
 *      the unread count to *increment* — typically caused by a stale
 *      realtime subscription firing the same INSERT twice, or fetch +
 *      realtime double-counting the same notification.
 *
 * The test:
 *   - signs in as a seeded client
 *   - records the baseline unread count from the bell badge
 *   - toggles the profile dropdown open/closed (3x)
 *   - navigates: dashboard -> notifications page -> dashboard -> notifications
 *   - re-asserts after every step that the count is unchanged AND the
 *     badge node count is ≤ 1
 *
 * No notifications are read or created during the test, so the count must
 * stay constant.
 */

// Stable selectors — kept in sync with NotificationBell.tsx
// (`data-testid="notification-bell"` and `data-testid="notification-badge"`).
// Using testids makes this test resilient to CSS class refactors.

let clientCreds: TestCredentials;

test.beforeAll(async () => {
  clientCreds = await getFirstClientCredentials();
});

async function signIn(page: Page, creds: TestCredentials) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill(creds.email);
  await page.getByLabel(/password/i, { exact: false }).first().fill(creds.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}

/** Wait for the bell button to mount in the header. */
async function waitForBell(page: Page) {
  const bell = page.getByTestId("notification-bell").first();
  await expect(bell).toBeVisible({ timeout: 15_000 });
  return bell;
}

/**
 * Read the unread count from the (single) bell badge. Returns 0 when no
 * badge is rendered. Throws via expect() if more than one badge exists.
 */
async function readUnreadCount(page: Page, label: string): Promise<number> {
  const badges = page.getByTestId("notification-badge");
  const count = await badges.count();
  expect(
    count,
    `[${label}] expected at most one unread badge in DOM, found ${count}`,
  ).toBeLessThanOrEqual(1);
  if (count === 0) return 0;

  // Prefer the explicit numeric attribute; fall back to text content.
  const attr = await badges.first().getAttribute("data-unread-count");
  if (attr != null) {
    const n = parseInt(attr, 10);
    if (Number.isFinite(n)) return n;
  }
  const text = (await badges.first().innerText()).trim();
  if (text === "" || text === "9+") return text === "9+" ? 9 : 0;
  const n = parseInt(text, 10);
  return Number.isFinite(n) ? n : 0;
}

async function toggleProfileDropdown(page: Page) {
  const trigger = page.getByRole("button", { name: /open user menu/i }).first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  // Wait for radix portal to mount.
  await page.waitForTimeout(150);
  // Close.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
}

test.describe("Notification badge: count is stable across nav + dropdown toggles", () => {
  test("count never increments or duplicates while navigating client routes", async ({ page }) => {
    await signIn(page, clientCreds);
    await page.goto("/client-dashboard");
    await waitForBell(page);
    await page.waitForLoadState("networkidle").catch(() => {});

    // 1) Baseline.
    const baseline = await readUnreadCount(page, "baseline /client-dashboard");

    // 2) Toggle profile dropdown 3x — must not duplicate or change count.
    for (let i = 0; i < 3; i++) {
      await toggleProfileDropdown(page);
      const after = await readUnreadCount(page, `after dropdown toggle #${i + 1}`);
      expect(
        after,
        `dropdown toggle #${i + 1} changed unread count (was ${baseline}, now ${after})`,
      ).toBe(baseline);
    }

    // 3) Navigate dashboard ↔ notifications page repeatedly.
    const route = ["/notifications", "/client-dashboard", "/notifications", "/client-dashboard"];
    for (const path of route) {
      await page.goto(path);
      await waitForBell(page);
      await page.waitForLoadState("networkidle").catch(() => {});
      // Give the realtime subscription a tick to (mis)fire if it's going to.
      await page.waitForTimeout(400);

      const after = await readUnreadCount(page, `after navigate ${path}`);
      expect(
        after,
        `navigating to ${path} changed unread count (was ${baseline}, now ${after})`,
      ).toBe(baseline);
    }

    // 4) Final dropdown toggle on notifications page — still stable.
    await page.goto("/notifications");
    await waitForBell(page);
    await toggleProfileDropdown(page);
    const final = await readUnreadCount(page, "final /notifications after dropdown toggle");
    expect(
      final,
      `final unread count drifted (was ${baseline}, now ${final})`,
    ).toBe(baseline);
  });
});
