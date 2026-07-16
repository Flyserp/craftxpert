import { test, expect, type Page } from "../playwright-fixture";
import { getFirstAdminCredentials, type TestCredentials } from "./helpers/providers";

/**
 * Tablet-viewport UI test for the shared <NumberedPagination /> control.
 *
 * NumberedPagination uses Tailwind's `sm:` breakpoint (640px) to switch
 * from `flex-col` (mobile, stacked) to `sm:flex-row` (>=640px, side by side).
 *
 * At 768x900 (tablet portrait) we therefore expect the pagination footer
 * to render as a horizontal row, NOT a column.
 */

const ADMIN_LIST_ROUTES = [
  "/admin/users",
  "/admin/categories",
  "/admin/payments",
  "/admin/verifications",
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

test.describe("Admin pagination flips to row layout on tablet", () => {
  test.use({ viewport: { width: 768, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  for (const route of ADMIN_LIST_ROUTES) {
    test(`${route} — pagination footer is row-laid at >=640px`, async ({ page }) => {
      await page.goto(route);

      const rowsLabel = page.getByText("Rows per page", { exact: true }).first();
      await expect(rowsLabel).toBeVisible({ timeout: 15_000 });

      // Walk up to the nearest flex container that holds the size selector +
      // count caption. It carries `flex-col` on mobile and `sm:flex-row` on
      // tablet/desktop, so the rendered class string still contains "flex-col"
      // — but the *computed* flex-direction at this viewport must be "row".
      const container = rowsLabel.locator(
        'xpath=ancestor::div[contains(@class,"flex-col")][1]',
      );
      await expect(container).toHaveCount(1);

      const direction = await container.evaluate(
        (el) => getComputedStyle(el as HTMLElement).flexDirection,
      );
      expect(direction).toBe("row");

      // Sanity: when both the selector and the "Showing …" caption are present,
      // they sit on (roughly) the same horizontal line — caption.y should be
      // within one line-height of the selector.y, not stacked below it.
      const caption = page.getByText(/^Showing\s+\d/i).first();
      if (await caption.count()) {
        const selectorBox = await rowsLabel.boundingBox();
        const captionBox = await caption.boundingBox();
        if (selectorBox && captionBox) {
          const verticalDelta = Math.abs(captionBox.y - selectorBox.y);
          // 24px ~= 1.5 line-heights of the xs caption — generous tolerance for
          // baseline alignment differences across the two elements.
          expect(verticalDelta).toBeLessThan(24);
        }
      }
    });
  }
});
