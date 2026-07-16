import { test, expect } from "../playwright-fixture";
import { createClient } from "@supabase/supabase-js";
import { getFirstClientCredentials, type TestCredentials } from "./helpers/providers";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://yfccbofafhsnrxyhepdj.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmY2Nib2ZhZmhzbnJ4eWhlcGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNTgxNDAsImV4cCI6MjA4OTczNDE0MH0.zEmoDJOTRV2sbsP0ew6vTeWznyCxAjxOaIE-rg79kNI";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let client: TestCredentials;

test.beforeAll(async () => {
  client = await getFirstClientCredentials();
});

test("client can complete the 7-step Post a Task wizard", async ({ page }) => {
  // Unique title so we can locate this run's task in the DB without colliding
  // with previous runs.
  const uniqueTitle = `E2E test task ${Date.now()}`;
  const description =
    "Automated end-to-end Playwright test verifying that the multi-step Post a Task wizard accepts input on every step and persists the resulting record to the database.";
  const address = "123 Test Street, Springfield";

  // ─── Sign in ───
  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill(client.email);
  await page.getByLabel(/password/i, { exact: false }).first().fill(client.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });

  // ─── Land on the wizard ───
  await page.goto("/post-task");

  // If localStorage from a previous run restored a draft, discard it so we
  // always start at Step 1.
  const discardBtn = page.getByRole("button", { name: /^discard$/i });
  if (await discardBtn.isVisible().catch(() => false)) {
    await discardBtn.click();
  }

  await expect(
    page.getByRole("heading", { name: /what do you need help with\?/i })
  ).toBeVisible({ timeout: 10_000 });

  const next = () => page.getByRole("button", { name: /^next$/i });

  // ─── Step 1: Category ───
  // Pick the first category card in the category grid (seed-agnostic).
  await page.locator("div.grid > button").first().click();
  await expect(next()).toBeEnabled();
  await next().click();

  // ─── Step 2: Describe ───
  await expect(page.getByRole("heading", { name: /describe the task/i })).toBeVisible();
  await page.getByPlaceholder(/fix leaking kitchen faucet/i).fill(uniqueTitle);
  await page.getByPlaceholder(/describe the issue in detail/i).fill(description);
  await expect(next()).toBeEnabled();
  await next().click();

  // ─── Step 3: Photos (optional, skip) ───
  await expect(page.getByRole("heading", { name: /upload photos/i })).toBeVisible();
  await next().click();

  // ─── Step 4: Schedule ───
  await expect(
    page.getByRole("heading", { name: /when do you need this done\?/i })
  ).toBeVisible();
  // shadcn Calendar renders day buttons with role="gridcell"; pick the first
  // enabled one (today or later).
  const enabledDay = page
    .locator('button[role="gridcell"]:not([disabled]), [role="gridcell"] button:not([disabled])')
    .first();
  await enabledDay.click();
  await expect(next()).toBeEnabled();
  await next().click();

  // ─── Step 5: Address ───
  await expect(page.getByRole("heading", { name: /where is the task\?/i })).toBeVisible();
  // Type into the autocomplete input. We don't pick a suggestion — the typed
  // value is what gets saved, and ≥5 chars satisfies validation.
  await page.getByPlaceholder(/start typing your address/i).fill(address);
  await expect(next()).toBeEnabled();
  await next().click();

  // ─── Step 6: Budget ───
  await expect(page.getByRole("heading", { name: /set your budget/i })).toBeVisible();
  await page.getByLabel(/minimum/i).fill("100");
  await expect(next()).toBeEnabled();
  await next().click();

  // ─── Step 7: Review & Submit ───
  await expect(page.getByRole("heading", { name: /review/i })).toBeVisible();
  await expect(page.getByText(uniqueTitle)).toBeVisible();

  const submitBtn = page.getByRole("button", { name: /post task/i });
  await expect(submitBtn).toBeEnabled();
  await submitBtn.click();

  // After successful submit the wizard navigates to the client dashboard.
  await page.waitForURL(/\/client-dashboard/, { timeout: 15_000 });

  // ─── Verify DB persistence ───
  // Poll briefly — propagation can lag a heartbeat behind navigation.
  let inserted: { id: string; title: string; address: string; status: string } | null = null;
  for (let i = 0; i < 10; i++) {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, address, status")
      .eq("title", uniqueTitle)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      inserted = data;
      break;
    }
    await page.waitForTimeout(500);
  }

  expect(
    inserted,
    `Task "${uniqueTitle}" should be persisted to the tasks table`
  ).not.toBeNull();
  expect(inserted!.title).toBe(uniqueTitle);
  expect(inserted!.address.toLowerCase()).toContain("test street");
  expect(["open", "active", "pending"]).toContain(inserted!.status);
});
