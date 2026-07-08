import { test, expect, type Page } from "../playwright-fixture";
import { getFirstAdminCredentials, type TestCredentials } from "./helpers/providers";

/**
 * E2E: <NumberedPagination /> footer layout on a small (mobile) viewport.
 *
 * For each real admin list route, we exercise BOTH states:
 *   • Populated — default load. Footer should render with "Rows per page"
 *     selector + "Showing X–Y of Z" caption, vertically stacked (flex-col).
 *   • Empty     — driven by typing a nonsense search query that cannot match.
 *     Footer "Rows per page" selector should NOT render (component returns
 *     null / empty-state card replaces the list), and no "Showing …" caption.
 *
 * Mobile viewport (375x812) ensures the `flex flex-col … sm:flex-row`
 * responsive class resolves to a column layout.
 */

const ADMIN_LIST_ROUTES = [
  "/admin/users",
  "/admin/categories",
  "/admin/payments",
  "/admin/verifications",
];

const NONSENSE_QUERY = "zzzzz_no_match_xyzzy_9999";

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

test.describe("Admin pagination — populated vs empty on mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  for (const route of ADMIN_LIST_ROUTES) {
    test(`${route} — populated footer stacks vertically`, async ({ page }) => {
      await page.goto(route);

      const rowsLabel = page.getByText("Rows per page", { exact: true }).first();
      await expect(rowsLabel).toBeVisible({ timeout: 15_000 });

      // Walk up to the flex container that owns the footer.
      const container = rowsLabel.locator(
        'xpath=ancestor::div[contains(@class,"flex-col")][1]',
      );
      await expect(container).toHaveCount(1);

      const direction = await container.evaluate(
        (el) => getComputedStyle(el as HTMLElement).flexDirection,
      );
      expect(direction).toBe("column");

      // Caption (if any) sits below the selector when stacked.
      const selectorBox = await rowsLabel.boundingBox();
      const caption = page.getByText(/^Showing\s+\d/i).first();
      if (await caption.count()) {
        const captionBox = await caption.boundingBox();
        if (selectorBox && captionBox) {
          expect(captionBox.y).toBeGreaterThanOrEqual(selectorBox.y);
        }
      }
    });

    test(`${route} — empty results hide the pagination footer`, async ({ page }) => {
      await page.goto(route);

      // Wait for the page to settle (footer present in populated state).
      await expect(
        page.getByText("Rows per page", { exact: true }).first(),
      ).toBeVisible({ timeout: 15_000 });

      // Type a nonsense query into the first visible search input on the page.
      const searchInput = page
        .locator(
          'input[placeholder*="Search" i], input[placeholder*="search" i], input[type="search"]',
        )
        .first();

      // Not every admin list page has a search input — skip empty-state assertion
      // gracefully if none exists, so the test stays meaningful where it can run.
      if (!(await searchInput.count())) {
        test.skip(true, `${route} has no search input to force an empty state`);
        return;
      }

      await searchInput.click();
      await searchInput.fill(NONSENSE_QUERY);

      // Allow any debounced filter to apply.
      await page.waitForTimeout(600);

      // Footer should be gone — no "Rows per page" and no "Showing …" caption.
      await expect(
        page.getByText("Rows per page", { exact: true }),
      ).toHaveCount(0, { timeout: 5_000 });

      await expect(page.getByText(/^Showing\s+\d/i)).toHaveCount(0);
    });
  }
});
