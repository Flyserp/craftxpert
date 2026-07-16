import { test, expect } from "../playwright-fixture";
import { getFirstAdminCredentials, type TestCredentials } from "./helpers/providers";

let admin: TestCredentials;

test.beforeEach(async () => {
  admin = await getFirstAdminCredentials();
});

test("admin can view the latest withdrawal.paid entry on /admin/audit", async ({ page }) => {
  // 1. Sign in as admin.
  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill(admin.email);
  await page.getByLabel(/password/i, { exact: false }).first().fill(admin.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();

  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });

  // 2. Open the audit log.
  await page.goto("/admin/audit");

  // Page heading rendered by DashboardLayout.
  await expect(page.getByRole("heading", { name: /audit log/i }).first()).toBeVisible({ timeout: 10_000 });

  // 3. Filter to "Withdrawal paid" so the latest entry is guaranteed at the top.
  //    The page sorts created_at desc, so the first matching row is the latest.
  await page.locator('[role="combobox"]').last().click();
  await page.getByRole("option", { name: /withdrawal paid/i }).click();

  // 4. At least one Withdrawal Paid badge is visible, and the summary cell uses
  //    the "$X.XX via <method>" format produced by AuditLogPage.summarize().
  const badge = page.getByText("Withdrawal Paid", { exact: true }).first();
  await expect(badge).toBeVisible({ timeout: 10_000 });

  const summaryCell = page.locator("tbody tr").first().locator("td").nth(3);
  await expect(summaryCell).toContainText(/\$\d+(?:\.\d{2})?\s+via\s+\w+/);
});
