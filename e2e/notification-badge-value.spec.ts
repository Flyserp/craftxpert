import { test, expect, type Page } from "../playwright-fixture";
import { createClient } from "@supabase/supabase-js";
import {
  getFirstClientCredentials,
  type TestCredentials,
} from "./helpers/providers";

/**
 * Notification badge value-correctness test.
 *
 * Earlier tests guarded uniqueness (badge appears at most once) and stability
 * (count never drifts on navigation). This one closes the remaining gap:
 *   the *value* rendered in the badge must equal the actual unread count
 *   returned by the database.
 *
 * Strategy:
 *   1. Sign in as a seeded client.
 *   2. Query Supabase directly using the same auth session for the unread
 *      notifications count (head: true, count: 'exact', is_read=false).
 *   3. Read the badge text from the header bell.
 *   4. Assert:
 *        - if API count = 0  → no badge in DOM
 *        - if 1 ≤ count ≤ 9  → badge text = String(count)
 *        - if count ≥ 10     → badge text = "9+"
 *
 * The hook caps `.limit(20)` and the rendering caps display at "9+", so we
 * mirror those rules exactly here.
 */

// Stable selectors are exposed via data-testid on the bell + badge.

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://yfccbofafhsnrxyhepdj.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmY2Nib2ZhZmhzbnJ4eWhlcGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNTgxNDAsImV4cCI6MjA4OTczNDE0MH0.zEmoDJOTRV2sbsP0ew6vTeWznyCxAjxOaIE-rg79kNI";

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

/**
 * Authenticate a server-side Supabase client as the same user and return the
 * unread notifications count. Uses head:true + count:'exact' for an accurate
 * total that is independent of the .limit(20) used by the client hook.
 */
async function fetchUnreadCount(creds: TestCredentials): Promise<number> {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await sb.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (signInError) throw new Error(`API sign-in failed: ${signInError.message}`);

  const { count, error } = await sb
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false);
  if (error) throw new Error(`Failed to fetch unread count: ${error.message}`);

  await sb.auth.signOut();
  return count ?? 0;
}

function expectedBadgeText(unread: number): string | null {
  if (unread <= 0) return null;
  if (unread > 9) return "9+";
  return String(unread);
}

test.describe("Notification badge value matches API unread count", () => {
  test("bell badge text equals unread count from notifications API", async ({ page }) => {
    // 1) Resolve API truth FIRST so the assertion isn't biased by UI-side
    //    realtime updates that happen between sign-in and read.
    const apiUnread = await fetchUnreadCount(clientCreds);
    const expected = expectedBadgeText(apiUnread);

    // 2) Sign in & land on a route that mounts the header bell.
    await signIn(page, clientCreds);
    await page.goto("/client-dashboard");

    const bell = page.getByTestId("notification-bell").first();
    await expect(bell).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle").catch(() => {});

    // Give the useNotifications hook one beat to settle (initial fetch).
    await page.waitForTimeout(500);

    const badge = page.getByTestId("notification-badge");

    if (expected === null) {
      // No unread → no badge at all.
      await expect(
        badge,
        `API reports 0 unread but a badge was rendered`,
      ).toHaveCount(0);
      return;
    }

    // Unread present → exactly one badge whose text equals the expected value.
    await expect(
      badge,
      `expected exactly one unread badge for ${apiUnread} unread, found mismatch`,
    ).toHaveCount(1);

    await expect(
      badge.first(),
      `badge text does not match API unread count (api=${apiUnread}, expected="${expected}")`,
    ).toHaveText(expected, { timeout: 5_000 });
  });
});
