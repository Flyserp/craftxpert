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
 * Path-based tenant-slug E2E mode.
 *
 * Sibling spec `notification-badge-tenant-subdomains.spec.ts` runs when real
 * per-tenant subdomains are available. This file is the equivalent for
 * environments where subdomains aren't reachable (e.g. the Lovable preview,
 * which serves a single host) but the app uses `/:tenantSlug/...` routing.
 *
 * Why this is opt-in:
 *   The current router (src/App.tsx) does NOT yet mount a `:tenantSlug`
 *   route — project memory describes path-based tenancy as the intended
 *   architecture, but no live route exposes it. Running the assertions
 *   blindly would either 404 or pass meaninglessly. So this suite SKIPS
 *   with a clear reason unless the operator opts in via env vars.
 *
 * How to enable:
 *   E2E_TENANT_A_SLUG=acme
 *   E2E_TENANT_B_SLUG=globex
 *   # Optional credentials override (defaults to seeded client + admin)
 *   E2E_TENANT_A_EMAIL / E2E_TENANT_A_PASSWORD
 *   E2E_TENANT_B_EMAIL / E2E_TENANT_B_PASSWORD
 *   # Optional landing path under each tenant (defaults to "/dashboard")
 *   E2E_TENANT_LANDING_PATH=/dashboard
 *
 * What it asserts (per tenant, in an isolated browser context):
 *   1. After login + navigate, the URL pathname starts with `/<slug>/`
 *      (proves the slug is actually in the path, not stripped or rewritten).
 *   2. Session user id matches the seeded tenant user (auth identity =
 *      tenant context — same model the multi-tenant-value spec uses).
 *   3. The header notification badge value equals that tenant's API
 *      unread count, with the UI's "9+" cap.
 *   4. The badge is NOT rendering the OTHER tenant's value (anti-leak).
 *
 * Each tenant runs in its own `browser.newContext()` so cookies and
 * localStorage cannot bleed across the two slugs.
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
  /** Path the test navigates to AFTER login, prefixed with the tenant slug. */
  tenantHomePath: string;
  creds: TestCredentials;
  unreadCount: number;
}

/** Sanity check on user-supplied slugs so we don't inject anything weird. */
function validateSlug(slug: string, varName: string): string {
  const cleaned = slug.trim().replace(/^\/+|\/+$/g, "");
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(cleaned)) {
    throw new Error(
      `${varName}="${slug}" is not a valid URL slug (expected lowercase letters, digits, dashes, 1-63 chars).`,
    );
  }
  return cleaned;
}

async function resolveTenantConfigs(): Promise<{
  a: TenantConfig;
  b: TenantConfig;
} | null> {
  const aSlugRaw = process.env.E2E_TENANT_A_SLUG?.trim();
  const bSlugRaw = process.env.E2E_TENANT_B_SLUG?.trim();
  if (!aSlugRaw || !bSlugRaw) return null;

  const aSlug = validateSlug(aSlugRaw, "E2E_TENANT_A_SLUG");
  const bSlug = validateSlug(bSlugRaw, "E2E_TENANT_B_SLUG");
  if (aSlug === bSlug) {
    throw new Error(
      `Tenant slug test requires two DIFFERENT slugs. Both env vars resolved to "${aSlug}".`,
    );
  }

  const landingPathRaw = process.env.E2E_TENANT_LANDING_PATH?.trim() || DEFAULT_LANDING_PATH;
  const landingPath = landingPathRaw.startsWith("/") ? landingPathRaw : `/${landingPathRaw}`;

  const aEmail = process.env.E2E_TENANT_A_EMAIL?.trim();
  const aPassword = process.env.E2E_TENANT_A_PASSWORD?.trim();
  const bEmail = process.env.E2E_TENANT_B_EMAIL?.trim();
  const bPassword = process.env.E2E_TENANT_B_PASSWORD?.trim();

  const credsA: TestCredentials =
    aEmail && aPassword
      ? { email: aEmail, password: aPassword }
      : await getFirstClientCredentials();
  const credsB: TestCredentials =
    bEmail && bPassword
      ? { email: bEmail, password: bPassword }
      : await getFirstAdminCredentials();

  if (credsA.email.toLowerCase() === credsB.email.toLowerCase()) {
    throw new Error(
      "Tenant A and Tenant B resolved to the same account; isolation test would be meaningless.",
    );
  }

  return {
    a: {
      label: "tenantA",
      slug: aSlug,
      tenantHomePath: `/${aSlug}${landingPath}`,
      creds: credsA,
      unreadCount: TENANT_A_UNREAD,
    },
    b: {
      label: "tenantB",
      slug: bSlug,
      tenantHomePath: `/${bSlug}${landingPath}`,
      creds: credsB,
      unreadCount: TENANT_B_UNREAD,
    },
  };
}

let configs: { a: TenantConfig; b: TenantConfig } | null = null;
let seedA: SeedResult | undefined;
let seedB: SeedResult | undefined;

test.beforeAll(async () => {
  configs = await resolveTenantConfigs();
  if (!configs) return;
  ({ a: seedA, b: seedB } = await seedTwoUserUnread(
    { creds: configs.a.creds, unreadCount: configs.a.unreadCount, label: configs.a.label },
    { creds: configs.b.creds, unreadCount: configs.b.unreadCount, label: configs.b.label },
  ));
});

test.afterAll(async () => {
  if (!configs) return;
  await Promise.all([
    resetSeededUnread(configs.a.creds),
    resetSeededUnread(configs.b.creds),
  ]);
});

/** API truth — same shape the in-app hook uses. */
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
  if (error) throw new Error(`Unread count fetch failed: ${error.message}`);
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

/** Regex: the URL pathname starts with `/<slug>` followed by `/`, end, or `?`. */
function slugPathnameRegex(slug: string): RegExp {
  // Escape any regex-significant characters in the slug (validateSlug
  // already restricts to [a-z0-9-], but be defensive).
  const safe = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^/${safe}(/|$|\\?)`);
}

async function assertTenantSlugBadge(
  page: Page,
  tenant: TenantConfig,
  expectedUserId: string,
  otherTenantUnread: number,
): Promise<void> {
  // 1) API truth resolved BEFORE UI to avoid realtime bias.
  const apiUnread = await fetchUnreadCount(tenant.creds);
  const expected = expectedBadgeText(apiUnread);

  // 2) Auth, then explicitly navigate to this tenant's slugged home so the
  //    URL has `/<slug>/...` regardless of role-based default redirect.
  await signIn(page, tenant.creds);
  await page.goto(tenant.tenantHomePath);

  // 3) URL slug assertion — the pathname must start with `/<slug>/`. This
  //    catches the case where the route doesn't exist (SPA fallback to "/")
  //    or where the slug got stripped by a redirect.
  await expect(page, `[${tenant.label}] expected URL under /${tenant.slug}/`).toHaveURL(
    slugPathnameRegex(tenant.slug),
    { timeout: 10_000 },
  );

  // 4) Session identity = tenant context.
  await expect
    .poll(async () => readSessionUserId(page), {
      timeout: 10_000,
      message: `[${tenant.label}] session user id never became ${expectedUserId}`,
    })
    .toBe(expectedUserId);

  // 5) Header bell mounts.
  await expect(
    page.getByTestId("notification-bell").first(),
    `[${tenant.label}] header bell should render`,
  ).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);

  // 6) Badge value assertion.
  const badge = page.getByTestId("notification-badge");
  if (expected === null) {
    await expect(
      badge,
      `[${tenant.label}] API reports 0 unread but a badge was rendered`,
    ).toHaveCount(0);
    return;
  }

  await expect(
    badge,
    `[${tenant.label}] expected exactly one badge for ${apiUnread} unread`,
  ).toHaveCount(1);

  await expect(
    badge.first(),
    `[${tenant.label}] badge text != API unread count (api=${apiUnread}, expected="${expected}")`,
  ).toHaveText(expected, { timeout: 5_000 });

  // 7) Anti-leak: when the OTHER tenant's count would render a different
  //    badge text, assert we are NOT showing that text.
  const otherExpected = expectedBadgeText(otherTenantUnread);
  if (otherExpected && otherExpected !== expected) {
    await expect(
      badge.first(),
      `[${tenant.label}] badge is showing the OTHER tenant's value ("${otherExpected}")`,
    ).not.toHaveText(otherExpected);
  }
}

const SKIP_REASON =
  "Tenant slug mode disabled. Set E2E_TENANT_A_SLUG and E2E_TENANT_B_SLUG to enable.";

test.describe("Per-tenant slug (/:tenant-slug) notification badge isolation", () => {
  test("tenant A slug shows tenant A's unread count", async ({ browser }) => {
    test.skip(!configs, SKIP_REASON);
    const cfg = configs!;
    const ctx: BrowserContext = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await assertTenantSlugBadge(page, cfg.a, seedA!.userId, seedB!.unreadCount);
    } finally {
      await ctx.close();
    }
  });

  test("tenant B slug shows tenant B's unread count", async ({ browser }) => {
    test.skip(!configs, SKIP_REASON);
    const cfg = configs!;
    const ctx: BrowserContext = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await assertTenantSlugBadge(page, cfg.b, seedB!.userId, seedA!.unreadCount);
    } finally {
      await ctx.close();
    }
  });

  test("switching slugs in the same browser context does not leak counts", async ({
    browser,
  }) => {
    test.skip(!configs, SKIP_REASON);
    const cfg = configs!;
    // Single context, two slugs back-to-back. Sign out between sessions so
    // the badge is recomputed from scratch under the new tenant identity —
    // a leak would surface as the wrong badge value on the second visit.
    const ctx: BrowserContext = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await assertTenantSlugBadge(page, cfg.a, seedA!.userId, seedB!.unreadCount);

      // Clear auth between slug switches so the second visit goes through a
      // fresh login under the second tenant — mirrors what a user switching
      // workspaces actually does.
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
      await page.waitForURL((u) => u.pathname.startsWith("/login"), { timeout: 10_000 });
      await expect(
        page.getByTestId("notification-badge"),
        "badge should not render between slug switches while signed out",
      ).toHaveCount(0);

      await assertTenantSlugBadge(page, cfg.b, seedB!.userId, seedA!.unreadCount);
    } finally {
      await ctx.close();
    }
  });

  test("slug routes and counts differ (precondition)", async () => {
    test.skip(!configs, SKIP_REASON);
    const cfg = configs!;
    expect(cfg.a.slug, "tenant slugs must differ").not.toBe(cfg.b.slug);
    const [apiA, apiB] = await Promise.all([
      fetchUnreadCount(cfg.a.creds),
      fetchUnreadCount(cfg.b.creds),
    ]);
    expect(apiA, "tenantA seeded value").toBe(seedA!.unreadCount);
    expect(apiB, "tenantB seeded value").toBe(seedB!.unreadCount);
    expect(apiA, "tenant unread counts must differ for the leak check to be meaningful").not.toBe(
      apiB,
    );
  });
});
