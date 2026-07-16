import { test, expect } from "../playwright-fixture";
import { getFirstActiveProviderId, getFirstClientCredentials, type TestCredentials } from "./helpers/providers";

let providerId: string;
let client: TestCredentials;

test.beforeEach(async () => {
  // Resolve a real provider with an active service AND a seeded client from the
  // live DB so the suite stays green even if seed UUIDs / emails change.
  [providerId, client] = await Promise.all([
    getFirstActiveProviderId(),
    getFirstClientCredentials(),
  ]);
});

test("client can launch booking flow from a provider page", async ({ page }) => {
  // 1. Sign in as a client.
  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill(client.email);
  await page.getByLabel(/password/i, { exact: false }).first().fill(client.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();

  // Wait until the auth redirect settles off /login.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });

  // 2. Open the provider profile.
  await page.goto(`/provider/${providerId}`);
  await expect(page.getByRole("button", { name: /book now/i }).first()).toBeVisible();

  // 3. Click Book Now (primary, desktop CTA).
  await page.getByRole("button", { name: /book now/i }).first().click();

  // 4. Assert URL contains the expected query params.
  await page.waitForURL(/\/book\?/, { timeout: 10_000 });
  const url = new URL(page.url());
  expect(url.pathname).toBe("/book");
  expect(url.searchParams.get("provider")).toBe(providerId);
  expect(url.searchParams.get("category")).toBeTruthy();
});
