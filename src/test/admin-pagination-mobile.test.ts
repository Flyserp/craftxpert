import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * CI guarantee for the admin pagination mobile fix.
 *
 * 1. Every admin list page imports / renders <NumberedPagination />.
 * 2. The shared NumberedPagination component still ships the mobile
 *    layout classes that make the footer stack vertically and prevent
 *    awkward wrapping: `flex-col`, `items-center`, `whitespace-nowrap`.
 *
 * This is a static-source test (no DOM render) so it runs in CI without
 * Supabase / router / auth providers and stays fast.
 */

// Admin routes that render a list/table of records and therefore must paginate.
// Keep in sync with the AdminLayout sidebar entries.
const ADMIN_LIST_PAGES = [
  "src/pages/admin/UsersPage.tsx",
  "src/pages/admin/CategoriesPage.tsx",
  "src/pages/admin/VerificationsPage.tsx",
  "src/pages/admin/PaymentsDashboardPage.tsx",
  "src/pages/admin/EarningsPage.tsx",
  "src/pages/admin/WithdrawalsPage.tsx",
  "src/pages/admin/RefundsPage.tsx",
  "src/pages/admin/DisputesPage.tsx",
  "src/pages/admin/CouponsPage.tsx",
  "src/pages/admin/AuditLogPage.tsx",
  "src/pages/admin/CmsPagesPage.tsx",
  "src/pages/admin/EmailTemplatesPage.tsx",
  "src/pages/admin/ContactMessagesPage.tsx",
  "src/pages/admin/MissingCategoryIconsPage.tsx",
  "src/pages/admin/UnknownInviteRolesPage.tsx",
];

const PAGINATION_COMPONENT = "src/components/common/NumberedPagination.tsx";

const REQUIRED_MOBILE_CLASSES = ["flex-col", "items-center", "whitespace-nowrap"] as const;

describe("Admin list pagination — CI guarantees", () => {
  describe("each admin list page renders <NumberedPagination />", () => {
    for (const file of ADMIN_LIST_PAGES) {
      it(`${file.split("/").pop()} uses NumberedPagination`, () => {
        const src = readFileSync(join(process.cwd(), file), "utf8");
        expect(
          /NumberedPagination/.test(src),
          `${file} must import or render NumberedPagination`,
        ).toBe(true);
        expect(
          /<NumberedPagination\b/.test(src),
          `${file} imports NumberedPagination but never renders it`,
        ).toBe(true);
      });
    }
  });

  describe("NumberedPagination ships the mobile-fix classes", () => {
    const src = readFileSync(join(process.cwd(), PAGINATION_COMPONENT), "utf8");

    for (const cls of REQUIRED_MOBILE_CLASSES) {
      it(`contains "${cls}"`, () => {
        expect(
          src.includes(cls),
          `NumberedPagination.tsx must keep the "${cls}" class to preserve the mobile layout`,
        ).toBe(true);
      });
    }

    it("uses sm: breakpoint to switch back to row layout on desktop", () => {
      expect(/sm:flex-row/.test(src)).toBe(true);
    });
  });
});
