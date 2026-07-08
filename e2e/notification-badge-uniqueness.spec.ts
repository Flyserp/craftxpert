import { test, expect, type Page } from "../playwright-fixture";
import {
  getFirstAdminCredentials,
  getFirstClientCredentials,
  type TestCredentials,
} from "./helpers/providers";

/**
 * Notifications unread badge uniqueness.
 *
 * The notification bell lives in the shared header (NotificationBell.tsx) and
 * is the single source of truth for the unread notification count. Earlier
 * regressions duplicated the count onto the profile-avatar trigger and into
 * the profile dropdown's "Notifications" item, which we removed.
 *
 * This test guards against any future regression by visiting several admin
 * and dashboard routes, opening the profile dropdown on each, and asserting
 * the unread badge appears AT MOST ONCE in the entire DOM.
 *
 * We don't require a badge to be present (the seed account may have zero
 * unread); we only require that *if* a count is rendered, it isn't duplicated.
 */

const ADMIN_ROUTES = [
  "/admin",
  "/admin/users",
  "/admin/payments",
  "/admin/verifications",
];

const CLIENT_ROUTES = ["/client-dashboard"];

let adminCreds: TestCredentials;
let clientCreds: TestCredentials;

test.beforeAll(async () => {
  adminCreds = await getFirstAdminCredentials();
  clientCreds = await getFirstClientCredentials();
});

async function signIn(page: Page, creds: TestCredentials) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill(creds.email);
  await page.getByLabel(/password/i, { exact: false }).first().fill(creds.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}

/**
 * Locate the notification bell button (rendered in the header) and return
 * its unread count badge if present. The badge is a <span> sibling of the
 * <Bell /> icon inside the button labelled "Notifications".
 */
async function countNotificationBadges(page: Page): Promise<number> {
  // Wait for the bell button to mount. Selected via stable data-testid so the
  // assertion survives CSS / class refactors of NotificationBell.
  const bell = page.getByTestId("notification-bell").first();
  await expect(bell).toBeVisible({ timeout: 15_000 });

  // Badge is also tagged via data-testid="notification-badge". It only renders
  // when unreadCount > 0; we just count occurrences in the DOM.
  return await page.getByTestId("notification-badge").count();
}

async function openProfileDropdown(page: Page) {
  const trigger = page.getByRole("button", { name: /open user menu/i }).first();
  await expect(trigger).toBeVisible();
  await trigger.click();
}

async function assertSingleBadge(page: Page, route: string) {
  await page.goto(route);
  // Give realtime/notifications hook a moment to populate.
  await page.waitForLoadState("networkidle").catch(() => {});

  // 1) Closed dropdown — only the bell may render a badge.
  const closedCount = await countNotificationBadges(page);
  expect(
    closedCount,
    `[${route}] notification badge rendered ${closedCount} times with profile dropdown closed (expected 0 or 1)`,
  ).toBeLessThanOrEqual(1);

  // 2) Open the profile dropdown — opening must NOT introduce a duplicate.
  await openProfileDropdown(page);
  // small wait for radix portal
  await page.waitForTimeout(150);

  const openCount = await countNotificationBadges(page);
  expect(
    openCount,
    `[${route}] notification badge rendered ${openCount} times with profile dropdown open (expected 0 or 1)`,
  ).toBeLessThanOrEqual(1);

  // The count must not increase just because the dropdown opened.
  expect(
    openCount,
    `[${route}] opening profile dropdown duplicated the notification badge`,
  ).toBeLessThanOrEqual(closedCount + 0);

  // Close the dropdown to leave a clean state for the next route.
  await page.keyboard.press("Escape");
}

test.describe("Notification unread badge appears at most once", () => {
  test("admin routes: badge never duplicates", async ({ page }) => {
    await signIn(page, adminCreds);
    for (const route of ADMIN_ROUTES) {
      await assertSingleBadge(page, route);
    }
  });

  test("client dashboard: badge never duplicates", async ({ page }) => {
    await signIn(page, clientCreds);
    for (const route of CLIENT_ROUTES) {
      await assertSingleBadge(page, route);
    }
  });
});
