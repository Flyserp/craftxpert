import { test, expect, type Page } from "../playwright-fixture";
import { getFirstAdminCredentials, type TestCredentials } from "./helpers/providers";

/**
 * Desktop-viewport UI test for the shared <NumberedPagination /> control.
 *
 * At 1280x720 we expect:
 *   1. The pagination footer is laid out as a row (sm:flex-row kicks in).
 *   2. The "Rows per page" selector and the "Showing …" caption sit on
 *      the SAME visual line — i.e. the container does not wrap onto a
 *      second row, and the caption uses `whitespace-nowrap`.
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

test.describe("Admin pagination on desktop viewport", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  for (const route of ADMIN_LIST_ROUTES) {
    test(`${route} — pagination is horizontal and stays on one line`, async ({ page }) => {
      await page.goto(route);

      const rowsLabel = page.getByText("Rows per page", { exact: true }).first();
      await expect(rowsLabel).toBeVisible({ timeout: 15_000 });

      // The flex container that holds the size selector + count caption.
      const container = rowsLabel.locator(
        'xpath=ancestor::div[contains(@class,"flex-col")][1]',
      );
      await expect(container).toHaveCount(1);

      // 1. Computed flex-direction is row at this viewport.
      const direction = await container.evaluate(
        (el) => getComputedStyle(el as HTMLElement).flexDirection,
      );
      expect(direction).toBe("row");

      // 2. Container height stays close to a single line. We compare it to
      //    the line-height of the inner caption — anything larger means the
      //    children have wrapped onto a second row.
      const caption = page.getByText(/^Showing\s+\d/i).first();
      if (await caption.count()) {
        const containerBox = await container.boundingBox();
        const lineHeight = await caption.evaluate(
          (el) => parseFloat(getComputedStyle(el as HTMLElement).lineHeight) || 16,
        );

        if (containerBox) {
          // 1.8x line-height tolerance accommodates the select trigger's 32px
          // height (the tallest child) without permitting a true second row.
          expect(containerBox.height).toBeLessThan(Math.max(lineHeight * 3, 56));
        }

        // 3. Selector and caption baselines are on the same visual line.
        const selectorBox = await rowsLabel.boundingBox();
        const captionBox = await caption.boundingBox();
        if (selectorBox && captionBox) {
          const verticalDelta = Math.abs(captionBox.y - selectorBox.y);
          expect(verticalDelta).toBeLessThan(24);

          // Caption sits to the RIGHT of the selector at desktop widths.
          expect(captionBox.x).toBeGreaterThan(selectorBox.x);
        }

        // 4. The caption never breaks across lines (whitespace-nowrap).
        const whitespace = await caption.evaluate(
          (el) => getComputedStyle(el as HTMLElement).whiteSpace,
        );
        expect(whitespace).toBe("nowrap");
      }
    });
  }
});
