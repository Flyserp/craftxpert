import { test, expect, type Page, type BrowserContext } from "../playwright-fixture";
import { createClient } from "@supabase/supabase-js";
import {
  getFirstClientCredentials,
  getFirstAdminCredentials,
  type TestCredentials,
} from "./helpers/providers";
import {
  seedTwoUserUnread,
  resetSeededUnread,
  type SeedResult,
} from "./helpers/seedNotifications";

/**
 * Multi-tenant notifications-badge value-equality test.
 *
 * Goal:
 *   For each "tenant" (modeled here as a distinct user account, since the
 *   active `notifications` schema is scoped by `user_id` — see
 *   helpers/seedNotifications.ts for the rationale), assert that the badge
 *   value rendered in the header equals the unread count returned by the
 *   notifications API for THAT SAME tenant. No cross-tenant leakage.
 *
 * Strategy (per tenant, in an isolated browser context so cookies/storage
 * never bleed across sessions):
 *   1) Seed a deterministic unread count for the tenant via Supabase.
 *   2) Independently fetch the unread count from the notifications API
 *      using that tenant's own auth session — this is the truth value.
 *   3) Sign that tenant into a fresh browser context and read the
 *      `data-testid="notification-badge"` value from the header.
 *   4) Assert the badge value matches the API value, applying the same
 *      "9+" cap the UI applies. Also assert the seeded count matches the
 *      API count, so any drift between seed and API is caught explicitly.
 *
 * Cross-tenant isolation is asserted by:
 *   - Using DIFFERENT seed counts per tenant (3 vs 7) so a leak would show
 *     up as the wrong number, not just "any number".
 *   - Using a separate `browser.newContext()` per tenant so storage/cookies
 *     from tenant A cannot influence tenant B's badge.
 */

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://yfccbofafhsnrxyhepdj.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmY2Nib2ZhZmhzbnJ4eWhlcGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNTgxNDAsImV4cCI6MjA4OTczNDE0MH0.zEmoDJOTRV2sbsP0ew6vTeWznyCxAjxOaIE-rg79kNI";

const TENANT_A_UNREAD = 3;
const TENANT_B_UNREAD = 7;

let tenantA: TestCredentials;
let tenantB: TestCredentials;
let seedA: SeedResult;
let seedB: SeedResult;

test.beforeAll(async () => {
  // Two distinct accounts stand in for two tenants. We use the seeded
  // client + admin demo accounts because they're guaranteed to be different
  // auth users with different unread streams.
  tenantA = await getFirstClientCredentials();
  tenantB = await getFirstAdminCredentials();

  if (tenantA.email.toLowerCase() === tenantB.email.toLowerCase()) {
    throw new Error(
      "multi-tenant test requires two distinct accounts; client and admin resolved to the same email",
    );
  }

  ({ a: seedA, b: seedB } = await seedTwoUserUnread(
    { creds: tenantA, unreadCount: TENANT_A_UNREAD, label: "tenantA" },
    { creds: tenantB, unreadCount: TENANT_B_UNREAD, label: "tenantB" },
  ));
});

test.afterAll(async () => {
  await Promise.all([resetSeededUnread(tenantA), resetSeededUnread(tenantB)]);
});

/** Authenticate against the notifications API as `creds` and return the
 *  unread count using the same shape the in-app hook would see. */
async function fetchUnreadCount(creds: TestCredentials): Promise<number> {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await sb.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (signInError) {
    throw new Error(`API sign-in failed for ${creds.email}: ${signInError.message}`);
  }
  const { count, error } = await sb
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false);
  await sb.auth.signOut().catch(() => {});
  if (error) {
    throw new Error(`Unread count fetch failed for ${creds.email}: ${error.message}`);
  }
  return count ?? 0;
}

async function signIn(page: Page, creds: TestCredentials): Promise<void> {
  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill(creds.email);
  await page.getByLabel(/password/i, { exact: false }).first().fill(creds.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  // Login redirects role-aware: admin → /admin, provider → /provider-dashboard,
  // client → /client-dashboard. Just wait for ANY non-/login route.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15_000,
  });
}

/**
 * Sign the current session out by clearing Supabase's persisted auth keys
 * from storage and reloading. Using storage-clear (rather than clicking the
 * profile menu's "Sign out") makes the test resilient to header layout
 * changes while still exercising the real onAuthStateChange → useNotifications
 * teardown path on reload. We then assert /login is reachable as a guest.
 */
async function signOutViaStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith("sb-") || k.includes("supabase"))) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch {
      /* storage may be unavailable on about:blank; ignore */
    }
  });
  await page.goto("/login");
  await page.waitForURL((url) => url.pathname.startsWith("/login"), {
    timeout: 10_000,
  });
  // Confirm session is actually gone (not just the URL).
  const sessionUserId = await readSessionUserId(page);
  expect(sessionUserId, "session should be cleared after sign-out").toBeNull();
  // Badge must not exist while logged out.
  await expect(
    page.getByTestId("notification-badge"),
    "badge should not render while signed out",
  ).toHaveCount(0);
}

/**
 * Read the auth user id from the Supabase session persisted in localStorage.
 * Returns null if no session is present. We parse the `sb-*-auth-token` key
 * (Supabase v2 storage shape) which contains `{ user: { id, email, ... } }`.
 *
 * This is the closest thing to a "tenant context" assertion this app
 * supports: there is no `:tenantSlug` in the URL (path-based tenancy is
 * documented in project memory but the active routes don't expose it), so
 * the authoritative tenant context = the signed-in auth user.
 */
async function readSessionUserId(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith("sb-") || !k.endsWith("-auth-token")) continue;
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const id = parsed?.user?.id ?? parsed?.currentSession?.user?.id ?? null;
        if (typeof id === "string") return id;
      }
    } catch {
      /* fall through */
    }
    return null;
  });
}

/**
 * Wait until the session in the page matches `expectedUserId`. Used right
 * after sign-in to confirm the cookie/localStorage swap completed before we
 * read the badge — otherwise a stale prior session could leak a wrong count.
 */
async function waitForSessionUser(
  page: Page,
  expectedUserId: string,
  label: string,
): Promise<void> {
  await expect
    .poll(async () => readSessionUserId(page), {
      timeout: 10_000,
      message: `[${label}] session user id never became ${expectedUserId}`,
    })
    .toBe(expectedUserId);
}

/** Per-role landing route the LoginPage redirects to after sign-in. */
function expectedLandingRoute(label: string): RegExp {
  // tenantA = client → /client-dashboard ; tenantB = admin → /admin
  if (label.startsWith("tenantA")) return /^\/client-dashboard(\/|$|\?)/;
  if (label.startsWith("tenantB")) return /^\/admin(\/|$|\?)/;
  // Fallback: any authenticated, non-login route.
  return /^\/(?!login)/;
}

/** UI rendering rule: 0 → no badge, 1..9 → digit, ≥10 → "9+". */
function expectedBadgeText(unread: number): string | null {
  if (unread <= 0) return null;
  if (unread > 9) return "9+";
  return String(unread);
}

async function assertBadgeMatchesApi(
  page: Page,
  creds: TestCredentials,
  expectedUserId: string,
  tenantLabel: string,
): Promise<void> {
  // Resolve API truth FIRST so the assertion isn't biased by realtime
  // updates that arrive after the page mounts.
  const apiUnread = await fetchUnreadCount(creds);
  const expected = expectedBadgeText(apiUnread);

  await signIn(page, creds);

  // ── Tenant-context guards (run BEFORE reading the badge) ──────────────
  // 1) Auth-session identity matches the tenant we think we signed in as.
  //    This is the strongest "right tenant" signal in a path-tenancy app.
  await waitForSessionUser(page, expectedUserId, tenantLabel);

  // 2) Post-login route is the one the LoginPage redirects this role to.
  //    A wrong landing page = wrong role/tenant, even if auth succeeded.
  await expect(page, `[${tenantLabel}] post-login URL`).toHaveURL(
    expectedLandingRoute(tenantLabel),
    { timeout: 10_000 },
  );

  // 3) Header is rendered for an authenticated user — the profile menu
  //    trigger only mounts when AuthContext has a user. Wait for it before
  //    reading the badge so we never race the auth-state hydration.
  await expect(
    page.getByTestId("notification-bell").first(),
    `[${tenantLabel}] header bell should render`,
  ).toBeVisible({ timeout: 15_000 });

  await page.waitForLoadState("networkidle").catch(() => {});
  // Give useNotifications one beat to settle its initial fetch.
  await page.waitForTimeout(500);

  // Re-confirm the session user didn't change between guards and read.
  const finalUserId = await readSessionUserId(page);
  expect(
    finalUserId,
    `[${tenantLabel}] session user changed under us before badge read`,
  ).toBe(expectedUserId);

  const badge = page.getByTestId("notification-badge");

  if (expected === null) {
    await expect(
      badge,
      `[${tenantLabel}] API reports 0 unread but a badge was rendered`,
    ).toHaveCount(0);
    return;
  }

  await expect(
    badge,
    `[${tenantLabel}] expected exactly one badge for ${apiUnread} unread`,
  ).toHaveCount(1);

  await expect(
    badge.first(),
    `[${tenantLabel}] badge text != API unread count (api=${apiUnread}, expected="${expected}")`,
  ).toHaveText(expected, { timeout: 5_000 });
}

test.describe("Per-tenant notification badge equals that tenant's API unread count", () => {
  test("seed and API agree before the UI is asked", async () => {
    // Sanity gate: if the seed didn't actually land, the per-tenant UI
    // assertions below would still pass for the wrong reason. Catch that here.
    const [apiA, apiB] = await Promise.all([
      fetchUnreadCount(tenantA),
      fetchUnreadCount(tenantB),
    ]);
    expect(apiA, "tenantA API unread != seeded value").toBe(seedA.unreadCount);
    expect(apiB, "tenantB API unread != seeded value").toBe(seedB.unreadCount);
    expect(seedA.unreadCount).toBe(TENANT_A_UNREAD);
    expect(seedB.unreadCount).toBe(TENANT_B_UNREAD);
    // Counts MUST differ so a cross-tenant leak would be visible as a
    // wrong-number assertion, not a coincidentally-correct one.
    expect(apiA).not.toBe(apiB);
  });

  test("tenant A badge value equals tenant A's API unread count", async ({ browser }) => {
    const ctx: BrowserContext = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await assertBadgeMatchesApi(page, tenantA, seedA.userId, "tenantA");
    } finally {
      await ctx.close();
    }
  });

  test("tenant B badge value equals tenant B's API unread count", async ({ browser }) => {
    const ctx: BrowserContext = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await assertBadgeMatchesApi(page, tenantB, seedB.userId, "tenantB");
    } finally {
      await ctx.close();
    }
  });

  test("logging out and back in on each tenant recomputes badge per session", async ({
    browser,
  }) => {
    const ctx: BrowserContext = await browser.newContext();
    const page = await ctx.newPage();
    try {
      // --- First A session ---
      await assertBadgeMatchesApi(page, tenantA, seedA.userId, "tenantA#session1");
      await signOutViaStorage(page);

      // --- B session in the same browser context ---
      await assertBadgeMatchesApi(page, tenantB, seedB.userId, "tenantB#session1");
      const apiB = await fetchUnreadCount(tenantB);
      const apiA = await fetchUnreadCount(tenantA);
      expect(apiA, "preconditions: tenant counts must differ").not.toBe(apiB);

      await signOutViaStorage(page);

      // --- Back to A: badge must be RECOMPUTED, not cached from B ---
      await assertBadgeMatchesApi(page, tenantA, seedA.userId, "tenantA#session2");
    } finally {
      await ctx.close();
    }
  });
});
