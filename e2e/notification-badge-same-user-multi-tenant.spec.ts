import { test, expect, type Page, type BrowserContext } from "../playwright-fixture";
import { createClient } from "@supabase/supabase-js";
import {
  getFirstClientCredentials,
  type TestCredentials,
} from "./helpers/providers";
import {
  seedSameUserMultiTenantUnread,
  fetchPerTenantUnread,
  resetSeededUnread,
  type SameUserMultiTenantSeedResult,
} from "./helpers/seedNotifications";

/**
 * Same-user, multi-tenant notification badge isolation (deterministic).
 *
 * Goal: prove that a SINGLE authenticated user, switching between two
 * tenant contexts, sees DIFFERENT unread counts in the header badge for
 * each tenant — using a deterministic seeded fixture.
 *
 * Why this is a separate spec:
 *   `notification-badge-tenant-slugs.spec.ts` tests two DIFFERENT users
 *   (one per tenant). That proves user-level isolation but not
 *   tenant-level isolation: in real multi-tenancy a single user belongs
 *   to multiple tenants and must see per-tenant counts. This spec covers
 *   that case.
 *
 * Fixture model (workaround for missing `tenant_id` column):
 *   The current `public.notifications` schema has no `tenant_id`. Until
 *   that column lands, we tag each seeded notification with
 *   `metadata.e2e_tenant_slug = "<slug>"` and treat that tag as the
 *   tenant scope. The API ground truth is a count filtered by both
 *   `user_id` AND that metadata tag (see `fetchPerTenantUnread`).
 *
 * What it asserts (per tenant, in an isolated browser context):
 *   1. URL pathname starts with `/<slug>/` after navigating to the
 *      tenant home — proves the slug is actually in the route.
 *   2. The badge value matches the API per-tenant unread truth.
 *      - If the app is tenant-aware the badge equals the per-tenant
 *        count (e.g. 3 for tenantA, 7 for tenantB).
 *      - If the app is NOT yet tenant-aware (current state) the badge
 *        equals the per-USER total (sum across tenants). The test
 *        records this as an expected-failure marker via `tenantAware`
 *        env opt-in so the suite stays green while documenting the gap.
 *   3. Anti-leak: in tenant-aware mode the badge for tenant A must NOT
 *      equal tenant B's seeded count, and vice versa.
 *
 * Opt-in:
 *   E2E_TENANT_A_SLUG / E2E_TENANT_B_SLUG          (required to enable)
 *   E2E_SAME_USER_EMAIL / E2E_SAME_USER_PASSWORD   (optional override;
 *                                                   defaults to the
 *                                                   first seeded client)
 *   E2E_TENANT_LANDING_PATH                        (default: "/dashboard")
 *   E2E_TENANT_AWARE=1                             (assert per-tenant
 *                                                   badge isolation;
 *                                                   without it, the
 *                                                   badge is allowed to
 *                                                   show the per-user
 *                                                   total and the
 *                                                   isolation assertion
 *                                                   is skipped with a
 *                                                   clear reason)
 */

const TENANT_A_UNREAD = 3;
const TENANT_B_UNREAD = 7;
const DEFAULT_LANDING_PATH = "/dashboard";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://yfccbofafhsnrxyhepdj.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmY2Nib2ZhZmhzbnJ4eWhlcGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNTgxNDAsImV4cCI6MjA4OTczNDE0MH0.zEmoDJOTRV2sbsP0ew6vTeWznyCxAjxOaIE-rg79kNI";

interface TenantConfig {
  label: string;
  slug: string;
  tenantHomePath: string;
  unreadCount: number;
}

interface SuiteConfig {
  creds: TestCredentials;
  tenantAware: boolean;
  a: TenantConfig;
  b: TenantConfig;
}

function validateSlug(slug: string, varName: string): string {
  const cleaned = slug.trim().replace(/^\/+|\/+$/g, "");
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(cleaned)) {
    throw new Error(
      `${varName}="${slug}" is not a valid URL slug (expected lowercase letters, digits, dashes, 1-63 chars).`,
    );
  }
  return cleaned;
}

async function resolveSuiteConfig(): Promise<SuiteConfig | null> {
  const aSlugRaw = process.env.E2E_TENANT_A_SLUG?.trim();
  const bSlugRaw = process.env.E2E_TENANT_B_SLUG?.trim();
  if (!aSlugRaw || !bSlugRaw) return null;

  const aSlug = validateSlug(aSlugRaw, "E2E_TENANT_A_SLUG");
  const bSlug = validateSlug(bSlugRaw, "E2E_TENANT_B_SLUG");
  if (aSlug === bSlug) {
    throw new Error(
      `Same-user multi-tenant test requires two DIFFERENT slugs. Both env vars resolved to "${aSlug}".`,
    );
  }

  const landingPathRaw =
    process.env.E2E_TENANT_LANDING_PATH?.trim() || DEFAULT_LANDING_PATH;
  const landingPath = landingPathRaw.startsWith("/")
    ? landingPathRaw
    : `/${landingPathRaw}`;

  const overrideEmail = process.env.E2E_SAME_USER_EMAIL?.trim();
  const overridePassword = process.env.E2E_SAME_USER_PASSWORD?.trim();
  const creds: TestCredentials =
    overrideEmail && overridePassword
      ? { email: overrideEmail, password: overridePassword }
      : await getFirstClientCredentials();

  return {
    creds,
    tenantAware: process.env.E2E_TENANT_AWARE === "1",
    a: {
      label: "tenantA",
      slug: aSlug,
      tenantHomePath: `/${aSlug}${landingPath}`,
      unreadCount: TENANT_A_UNREAD,
    },
    b: {
      label: "tenantB",
      slug: bSlug,
      tenantHomePath: `/${bSlug}${landingPath}`,
      unreadCount: TENANT_B_UNREAD,
    },
  };
}

let suite: SuiteConfig | null = null;
let seed: SameUserMultiTenantSeedResult | undefined;

test.beforeAll(async () => {
  suite = await resolveSuiteConfig();
  if (!suite) return;
  seed = await seedSameUserMultiTenantUnread(suite.creds, [
    { slug: suite.a.slug, unreadCount: suite.a.unreadCount, label: suite.a.label },
    { slug: suite.b.slug, unreadCount: suite.b.unreadCount, label: suite.b.label },
  ]);
});

test.afterAll(async () => {
  if (suite) await resetSeededUnread(suite.creds);
});

/** Total unread for the user (what a tenant-UNAWARE app would render). */
async function fetchTotalUnread(creds: TestCredentials): Promise<number> {
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
  if (error) throw new Error(`Total unread fetch failed: ${error.message}`);
  return count ?? 0;
}

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

async function signIn(page: Page, creds: TestCredentials): Promise<void> {
  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill(creds.email);
  await page
    .getByLabel(/password/i, { exact: false })
    .first()
    .fill(creds.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15_000,
  });
}

function expectedBadgeText(unread: number): string | null {
  if (unread <= 0) return null;
  if (unread > 9) return "9+";
  return String(unread);
}

function slugPathnameRegex(slug: string): RegExp {
  const safe = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^/${safe}(/|$|\\?)`);
}

async function visitTenantAndReadBadge(
  page: Page,
  creds: TestCredentials,
  tenant: TenantConfig,
  expectedUserId: string,
): Promise<string | null> {
  await signIn(page, creds);
  await page.goto(tenant.tenantHomePath);

  await expect(
    page,
    `[${tenant.label}] expected URL under /${tenant.slug}/`,
  ).toHaveURL(slugPathnameRegex(tenant.slug), { timeout: 10_000 });

  await expect
    .poll(async () => readSessionUserId(page), {
      timeout: 10_000,
      message: `[${tenant.label}] session user id never became ${expectedUserId}`,
    })
    .toBe(expectedUserId);

  await expect(
    page.getByTestId("notification-bell").first(),
    `[${tenant.label}] header bell should render`,
  ).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);

  const badge = page.getByTestId("notification-badge");
  if ((await badge.count()) === 0) return null;
  return (await badge.first().textContent())?.trim() ?? null;
}

const SKIP_REASON =
  "Same-user multi-tenant mode disabled. Set E2E_TENANT_A_SLUG and E2E_TENANT_B_SLUG to enable.";

test.describe("Same user, different unread counts per tenant — badge isolation", () => {
  test("seeded fixture: per-tenant API truth matches the requested counts", async () => {
    test.skip(!suite, SKIP_REASON);
    const cfg = suite!;
    const [apiA, apiB, total] = await Promise.all([
      fetchPerTenantUnread(cfg.creds, cfg.a.slug),
      fetchPerTenantUnread(cfg.creds, cfg.b.slug),
      fetchTotalUnread(cfg.creds),
    ]);
    expect(apiA, `tenantA per-tenant unread`).toBe(cfg.a.unreadCount);
    expect(apiB, `tenantB per-tenant unread`).toBe(cfg.b.unreadCount);
    expect(apiA, `per-tenant counts must differ for the leak check to be meaningful`)
      .not.toBe(apiB);
    expect(total, `total unread must equal sum of per-tenant`).toBe(
      seed!.totalUnreadCount,
    );
  });

  test("tenant A: badge value reflects tenant-A scope (or documents the gap)", async ({
    browser,
  }) => {
    test.skip(!suite, SKIP_REASON);
    const cfg = suite!;
    const ctx: BrowserContext = await browser.newContext();
    const page = await ctx.newPage();
    try {
      const badgeText = await visitTenantAndReadBadge(
        page,
        cfg.creds,
        cfg.a,
        seed!.userId,
      );
      const perTenantExpected = expectedBadgeText(cfg.a.unreadCount);
      const totalExpected = expectedBadgeText(seed!.totalUnreadCount);

      if (cfg.tenantAware) {
        // Strict tenant-aware mode: badge MUST equal per-tenant count and
        // MUST NOT leak the OTHER tenant's value.
        expect(
          badgeText,
          `[tenantA] badge should equal per-tenant count (${perTenantExpected}), got "${badgeText}"`,
        ).toBe(perTenantExpected);

        const otherExpected = expectedBadgeText(cfg.b.unreadCount);
        if (otherExpected && otherExpected !== perTenantExpected) {
          expect(
            badgeText,
            `[tenantA] badge is leaking tenantB's value ("${otherExpected}")`,
          ).not.toBe(otherExpected);
        }
      } else {
        // Tenant-unaware mode (current app state): badge equals the per-user
        // total. We assert that explicitly so a future tenant-aware build
        // breaks this test loudly and prompts flipping E2E_TENANT_AWARE=1.
        expect(
          badgeText,
          `[tenantA] tenant-unaware app: badge should equal per-user total (${totalExpected}), got "${badgeText}". Set E2E_TENANT_AWARE=1 once tenant scoping ships.`,
        ).toBe(totalExpected);
      }
    } finally {
      await ctx.close();
    }
  });

  test("tenant B: badge value reflects tenant-B scope (or documents the gap)", async ({
    browser,
  }) => {
    test.skip(!suite, SKIP_REASON);
    const cfg = suite!;
    const ctx: BrowserContext = await browser.newContext();
    const page = await ctx.newPage();
    try {
      const badgeText = await visitTenantAndReadBadge(
        page,
        cfg.creds,
        cfg.b,
        seed!.userId,
      );
      const perTenantExpected = expectedBadgeText(cfg.b.unreadCount);
      const totalExpected = expectedBadgeText(seed!.totalUnreadCount);

      if (cfg.tenantAware) {
        expect(
          badgeText,
          `[tenantB] badge should equal per-tenant count (${perTenantExpected}), got "${badgeText}"`,
        ).toBe(perTenantExpected);

        const otherExpected = expectedBadgeText(cfg.a.unreadCount);
        if (otherExpected && otherExpected !== perTenantExpected) {
          expect(
            badgeText,
            `[tenantB] badge is leaking tenantA's value ("${otherExpected}")`,
          ).not.toBe(otherExpected);
        }
      } else {
        expect(
          badgeText,
          `[tenantB] tenant-unaware app: badge should equal per-user total (${totalExpected}), got "${badgeText}". Set E2E_TENANT_AWARE=1 once tenant scoping ships.`,
        ).toBe(totalExpected);
      }
    } finally {
      await ctx.close();
    }
  });

  test("switching tenants in the same context yields different badges (tenant-aware only)", async ({
    browser,
  }) => {
    test.skip(!suite, SKIP_REASON);
    const cfg = suite!;
    test.skip(
      !cfg.tenantAware,
      "Per-tenant badge differentiation only meaningful when E2E_TENANT_AWARE=1.",
    );

    const ctx: BrowserContext = await browser.newContext();
    const page = await ctx.newPage();
    try {
      const badgeA = await visitTenantAndReadBadge(page, cfg.creds, cfg.a, seed!.userId);
      // Stay logged in — same user, just navigate to the other tenant's home.
      await page.goto(cfg.b.tenantHomePath);
      await expect(page).toHaveURL(slugPathnameRegex(cfg.b.slug), {
        timeout: 10_000,
      });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(500);

      const badgeBLocator = page.getByTestId("notification-badge");
      const badgeB =
        (await badgeBLocator.count()) === 0
          ? null
          : ((await badgeBLocator.first().textContent())?.trim() ?? null);

      const expectedA = expectedBadgeText(cfg.a.unreadCount);
      const expectedB = expectedBadgeText(cfg.b.unreadCount);
      expect(badgeA, `tenantA badge`).toBe(expectedA);
      expect(badgeB, `tenantB badge`).toBe(expectedB);
      expect(badgeA, `same-user badges must differ across tenants`).not.toBe(badgeB);
    } finally {
      await ctx.close();
    }
  });

  /**
   * Sign in ONCE, then walk A → B → A in the same session, asserting the
   * badge value resets to each tenant's per-tenant count on every switch.
   * Catches stale-state bugs (e.g. cached unread count not invalidated when
   * the active tenant changes).
   */
  test("single sign-in: badge resets on every tenant switch (A→B→A)", async ({
    browser,
  }) => {
    test.skip(!suite, SKIP_REASON);
    const cfg = suite!;
    test.skip(
      !cfg.tenantAware,
      "Per-tenant badge reset only meaningful when E2E_TENANT_AWARE=1.",
    );

    const ctx: BrowserContext = await browser.newContext();
    const page = await ctx.newPage();
    try {
      // Sign in once up front; subsequent tenant visits must NOT re-auth.
      await signIn(page, cfg.creds);
      const initialUserId = await readSessionUserId(page);
      expect(initialUserId, "user id after single sign-in").toBe(seed!.userId);

      const expectedA = expectedBadgeText(cfg.a.unreadCount);
      const expectedB = expectedBadgeText(cfg.b.unreadCount);

      const readBadgeAt = async (tenant: TenantConfig): Promise<string | null> => {
        await page.goto(tenant.tenantHomePath);
        await expect(
          page,
          `[${tenant.label}] expected URL under /${tenant.slug}/`,
        ).toHaveURL(slugPathnameRegex(tenant.slug), { timeout: 10_000 });
        // Session must NOT have been recycled by the navigation.
        await expect
          .poll(async () => readSessionUserId(page), {
            timeout: 5_000,
            message: `[${tenant.label}] session changed mid-walk`,
          })
          .toBe(seed!.userId);
        await expect(
          page.getByTestId("notification-bell").first(),
          `[${tenant.label}] header bell should render`,
        ).toBeVisible({ timeout: 15_000 });
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(500);
        const badge = page.getByTestId("notification-badge");
        if ((await badge.count()) === 0) return null;
        return (await badge.first().textContent())?.trim() ?? null;
      };

      const a1 = await readBadgeAt(cfg.a);
      expect(a1, `[A→…] badge on first A visit`).toBe(expectedA);

      const b1 = await readBadgeAt(cfg.b);
      expect(b1, `[A→B] badge after switching to B`).toBe(expectedB);
      expect(b1, `[A→B] badge MUST change from A's value`).not.toBe(a1);

      const a2 = await readBadgeAt(cfg.a);
      expect(a2, `[A→B→A] badge after switching back to A`).toBe(expectedA);
      expect(a2, `[A→B→A] badge MUST change from B's value`).not.toBe(b1);
    } finally {
      await ctx.close();
    }
  });

  /**
   * Same A → B → A walk, but with an explicit sign-out + sign-in BETWEEN
   * tenant visits. Proves the badge is recomputed from a fresh auth
   * session per tenant — no localStorage / cached query carry-over.
   */
  test("sign-out between switches: badge recomputes from fresh session per tenant", async ({
    browser,
  }) => {
    test.skip(!suite, SKIP_REASON);
    const cfg = suite!;
    test.skip(
      !cfg.tenantAware,
      "Per-tenant badge isolation only meaningful when E2E_TENANT_AWARE=1.",
    );

    const ctx: BrowserContext = await browser.newContext();
    const page = await ctx.newPage();

    const signOutAndAssertCleared = async (note: string): Promise<void> => {
      // Hard sign-out: clear all Supabase auth keys and visit /login. The
      // badge MUST disappear because no session = no notifications query.
      await page.evaluate(() => {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith("sb-") || k.includes("supabase"))) keys.push(k);
        }
        keys.forEach((k) => localStorage.removeItem(k));
        sessionStorage.clear();
      });
      await page.goto("/login");
      await page.waitForURL((u) => u.pathname.startsWith("/login"), {
        timeout: 10_000,
      });
      await expect(
        page.getByTestId("notification-badge"),
        `[${note}] badge must not render while signed out`,
      ).toHaveCount(0);
    };

    try {
      const expectedA = expectedBadgeText(cfg.a.unreadCount);
      const expectedB = expectedBadgeText(cfg.b.unreadCount);

      // Visit A under a fresh session.
      const a1 = await visitTenantAndReadBadge(page, cfg.creds, cfg.a, seed!.userId);
      expect(a1, `[A] badge after first sign-in`).toBe(expectedA);

      // Sign out, then sign back in (same user) and visit B.
      await signOutAndAssertCleared("between A and B");
      const b1 = await visitTenantAndReadBadge(page, cfg.creds, cfg.b, seed!.userId);
      expect(b1, `[B] badge after sign-out + sign-in`).toBe(expectedB);
      expect(b1, `[B] badge MUST differ from A's previous value`).not.toBe(a1);

      // Sign out again, sign back in, visit A — badge must be A's count again.
      await signOutAndAssertCleared("between B and A");
      const a2 = await visitTenantAndReadBadge(page, cfg.creds, cfg.a, seed!.userId);
      expect(a2, `[A] badge after second sign-out + sign-in`).toBe(expectedA);
      expect(a2, `[A] badge MUST differ from B's previous value`).not.toBe(b1);
    } finally {
      await ctx.close();
    }
  });
});
