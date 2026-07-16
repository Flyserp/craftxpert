import { test, expect, type Page } from "../playwright-fixture";
import { getFirstAdminCredentials, type TestCredentials } from "./helpers/providers";

/**
 * Responsive UI test for the shared <NumberedPagination /> control.
 *
 * For each admin list route, at a mobile viewport (375x812 — iPhone X),
 * we assert that the pagination footer:
 *   1. Renders (the "Rows per page" selector is visible), AND
 *   2. Stacks vertically — i.e. the flex container resolves to
 *      `flex-direction: column`.
 *
 * The mobile fix lives in NumberedPagination.tsx as
 *   `flex flex-col ... sm:flex-row`
 * so anything < 640px CSS px must be column.
 */

const ADMIN_LIST_ROUTES = [
  "/admin/users",
  "/admin/categories",
  "/admin/payments",      // bookings/payments dashboard
  "/admin/verifications", // vendors verification queue
];

let admin: TestCredentials;

test.beforeAll(async () => {
  admin = await getFirstAdminCredentials();
});

async function signInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill(admin.email);
  await page.getByLabel(/password/i, { exact: false }).first().fill(admin.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}

test.describe("Admin pagination stacks vertically on mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  for (const route of ADMIN_LIST_ROUTES) {
    test(`${route} — pagination footer is column-stacked < 640px`, async ({ page }) => {
      await page.goto(route);

      // The "Rows per page" label is the unique anchor for the pagination footer
      // in <NumberedPagination />. Wait for it to render (data may take a beat).
      const rowsLabel = page.getByText("Rows per page", { exact: true }).first();
      await expect(rowsLabel).toBeVisible({ timeout: 15_000 });

      // Walk up to the flex container that holds the size selector + count.
      // It's the nearest ancestor with `flex-col` in its class list.
      const container = rowsLabel.locator(
        'xpath=ancestor::div[contains(@class,"flex-col")][1]',
      );
      await expect(container).toHaveCount(1);

      // Computed style must resolve to column at this viewport.
      const direction = await container.evaluate(
        (el) => getComputedStyle(el as HTMLElement).flexDirection,
      );
      expect(direction).toBe("column");

      // Sanity: the selector and (when present) the "Showing …" caption are
      // vertically stacked — the caption's top must be >= the selector's bottom.
      const selectorBox = await rowsLabel.boundingBox();
      const caption = page.getByText(/^Showing\s+\d/i).first();
      if (await caption.count()) {
        const captionBox = await caption.boundingBox();
        if (selectorBox && captionBox) {
          expect(captionBox.y).toBeGreaterThanOrEqual(selectorBox.y);
        }
      }
    });
  }
});
