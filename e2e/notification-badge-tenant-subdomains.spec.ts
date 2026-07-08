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
 * Tenant-subdomain E2E mode.
 *
 * What this file is for:
 *   The sibling spec (`notification-badge-multi-tenant-value.spec.ts`)
 *   exercises tenant isolation on a SINGLE host because the Lovable preview
 *   only serves one origin and the active routes don't use `:tenantSlug`.
 *   This file adds an OPT-IN mode that drives the test against REAL
 *   per-tenant hostnames (e.g. `acme.local` and `globex.local`) when the
 *   environment supports them — useful for staging deployments that already
 *   have per-tenant subdomains wired up at the DNS / hosting layer.
 *
 * How to enable it:
 *   Set both of these env vars before running Playwright:
 *     E2E_TENANT_A_BASE_URL=https://acme.local
 *     E2E_TENANT_B_BASE_URL=https://globex.local
 *   (Optionally) override credentials per tenant:
 *     E2E_TENANT_A_EMAIL / E2E_TENANT_A_PASSWORD
 *     E2E_TENANT_B_EMAIL / E2E_TENANT_B_PASSWORD
 *
 *   If either base URL is missing, the suite is SKIPPED with a clear reason
 *   rather than silently passing or falling back to the single-host run.
 *
 * What the test asserts (per tenant, in an isolated browser context):
 *   1. The current origin equals the tenant's expected hostname (proves we
 *      really are on a per-tenant subdomain, not a fallthrough).
 *   2. The session user id matches the seeded tenant user (auth identity =
 *      tenant context, in this app's data model).
 *   3. The notification badge value equals that tenant's API unread count,
 *      with the UI's "9+" cap.
 *   4. Cross-checked: the OTHER tenant's count must NOT be the value shown.
 *
 * Why isolation is meaningful here:
 *   Each tenant runs in its own `browser.newContext()`, so cookies and
 *   localStorage cannot bleed across hostnames even at the browser layer.
 */

const TENANT_A_UNREAD = 3;
const TENANT_B_UNREAD = 7;

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://yfccbofafhsnrxyhepdj.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmY2Nib2ZhZmhzbnJ4eWhlcGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNTgxNDAsImV4cCI6MjA4OTczNDE0MH0.zEmoDJOTRV2sbsP0ew6vTeWznyCxAjxOaIE-rg79kNI";

interface TenantConfig {
  label: string;
  baseUrl: string;
  expectedHostname: string;
  creds: TestCredentials;
  unreadCount: number;
  /** Role-aware landing route this tenant lands on after login. */
  landingRoute: RegExp;
}

/** Resolve the per-tenant config from env vars. Returns null if disabled. */
async function resolveTenantConfigs(): Promise<{
  a: TenantConfig;
  b: TenantConfig;
} | null> {
  const aBase = process.env.E2E_TENANT_A_BASE_URL?.trim();
  const bBase = process.env.E2E_TENANT_B_BASE_URL?.trim();
  if (!aBase || !bBase) return null;

  // Parse hostnames so the origin assertion is robust to trailing slashes,
  // ports, etc.
  let aHost: string;
  let bHost: string;
  try {
    aHost = new URL(aBase).hostname;
    bHost = new URL(bBase).hostname;
  } catch (e) {
    throw new Error(
      `Tenant base URLs must be valid absolute URLs. Got A="${aBase}" B="${bBase}". (${
        (e as Error).message
      })`,
    );
  }
  if (aHost === bHost) {
    throw new Error(
      `Tenant subdomain test requires two DIFFERENT hostnames. Both env vars resolved to "${aHost}".`,
    );
  }

  // Credentials: explicit env wins, else fall back to the seeded demo accounts.
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

  // Map credentials to the role-aware landing path the LoginPage redirects to.
  // Demo client → /client-dashboard, demo admin → /admin. If the caller
  // supplied custom creds we don't know the role → accept any non-/login route.
  const landingForClient = /^\/client-dashboard(\/|$|\?)/;
  const landingForAdmin = /^\/admin(\/|$|\?)/;
  const anyAuthed = /^\/(?!login)/;

  return {
    a: {
      label: "tenantA",
      baseUrl: aBase.replace(/\/$/, ""),
      expectedHostname: aHost,
      creds: credsA,
      unreadCount: TENANT_A_UNREAD,
      landingRoute: aEmail ? anyAuthed : landingForClient,
    },
    b: {
      label: "tenantB",
      baseUrl: bBase.replace(/\/$/, ""),
      expectedHostname: bHost,
      creds: credsB,
      unreadCount: TENANT_B_UNREAD,
      landingRoute: bEmail ? anyAuthed : landingForAdmin,
    },
  };
}

let configs: { a: TenantConfig; b: TenantConfig } | null = null;
let seedA: SeedResult | undefined;
let seedB: SeedResult | undefined;

test.beforeAll(async () => {
  configs = await resolveTenantConfigs();
  if (!configs) return; // suite will skip per-test below
  ({ a: seedA, b: seedB } = await seedTwoUserUnread(
    {
      creds: configs.a.creds,
      unreadCount: configs.a.unreadCount,
      label: configs.a.label,
    },
    {
      creds: configs.b.creds,
      unreadCount: configs.b.unreadCount,
      label: configs.b.label,
    },
  ));
});

test.afterAll(async () => {
  if (!configs) return;
  await Promise.all([
    resetSeededUnread(configs.a.creds),
    resetSeededUnread(configs.b.creds),
  ]);
});

/** API truth — uses the same auth as the in-app hook, with count:'exact'. */
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

/** Read auth user id from the persisted Supabase session in localStorage. */
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

async function signInAt(
  page: Page,
  baseUrl: string,
  creds: TestCredentials,
): Promise<void> {
  await page.goto(`${baseUrl}/login`);
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

async function assertTenantBadge(
  page: Page,
  tenant: TenantConfig,
  expectedUserId: string,
  otherTenantUnread: number,
): Promise<void> {
  // 1) API truth resolved BEFORE UI to avoid realtime bias.
  const apiUnread = await fetchUnreadCount(tenant.creds);
  const expected = expectedBadgeText(apiUnread);

  // 2) Sign in on this tenant's hostname.
  await signInAt(page, tenant.baseUrl, tenant.creds);

  // 3) Origin assertion — we are actually on the per-tenant hostname, not a
  //    fallback that silently rewrote the URL.
  const currentHostname = new URL(page.url()).hostname;
  expect(
    currentHostname,
    `[${tenant.label}] expected to be on hostname "${tenant.expectedHostname}" but got "${currentHostname}"`,
  ).toBe(tenant.expectedHostname);

  // 4) Role-aware landing route.
  await expect(page, `[${tenant.label}] post-login URL`).toHaveURL(
    tenant.landingRoute,
    { timeout: 10_000 },
  );

  // 5) Session identity = tenant context.
  await expect
    .poll(async () => readSessionUserId(page), {
      timeout: 10_000,
      message: `[${tenant.label}] session user id never became ${expectedUserId}`,
    })
    .toBe(expectedUserId);

  // 6) Header bell mounts.
  await expect(
    page.getByTestId("notification-bell").first(),
    `[${tenant.label}] header bell should render`,
  ).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);

  // 7) Badge value assertion.
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

  // 8) Anti-leak: if the OTHER tenant's count would render a different badge
  //    text, assert we're NOT showing that. (When the two unread counts both
  //    cap to "9+" or coincide, the prior equality check already covers us.)
  const otherExpected = expectedBadgeText(otherTenantUnread);
  if (otherExpected && otherExpected !== expected) {
    await expect(
      badge.first(),
      `[${tenant.label}] badge is showing the OTHER tenant's value ("${otherExpected}")`,
    ).not.toHaveText(otherExpected);
  }
}

test.describe("Per-tenant subdomain notification badge isolation", () => {
  test("tenant A subdomain shows tenant A's unread count", async ({ browser }, testInfo) => {
    test.skip(
      !configs,
      "Tenant subdomain mode disabled. Set E2E_TENANT_A_BASE_URL and E2E_TENANT_B_BASE_URL to enable.",
    );
    const cfg = configs!;
    const ctx: BrowserContext = await browser.newContext({
      // ignoreHTTPSErrors lets *.local self-signed certs work in dev/staging.
      ignoreHTTPSErrors: true,
    });
    const page = await ctx.newPage();
    try {
      await assertTenantBadge(page, cfg.a, seedA!.userId, seedB!.unreadCount);
      testInfo.annotations.push({
        type: "tenant-mode",
        description: `subdomains: ${cfg.a.expectedHostname} vs ${cfg.b.expectedHostname}`,
      });
    } finally {
      await ctx.close();
    }
  });

  test("tenant B subdomain shows tenant B's unread count", async ({ browser }, testInfo) => {
    test.skip(
      !configs,
      "Tenant subdomain mode disabled. Set E2E_TENANT_A_BASE_URL and E2E_TENANT_B_BASE_URL to enable.",
    );
    const cfg = configs!;
    const ctx: BrowserContext = await browser.newContext({
      ignoreHTTPSErrors: true,
    });
    const page = await ctx.newPage();
    try {
      await assertTenantBadge(page, cfg.b, seedB!.userId, seedA!.unreadCount);
      testInfo.annotations.push({
        type: "tenant-mode",
        description: `subdomains: ${cfg.a.expectedHostname} vs ${cfg.b.expectedHostname}`,
      });
    } finally {
      await ctx.close();
    }
  });

  test("subdomains are different and counts differ (precondition)", async () => {
    test.skip(
      !configs,
      "Tenant subdomain mode disabled. Set E2E_TENANT_A_BASE_URL and E2E_TENANT_B_BASE_URL to enable.",
    );
    const cfg = configs!;
    expect(cfg.a.expectedHostname, "tenant hostnames must differ").not.toBe(
      cfg.b.expectedHostname,
    );
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
