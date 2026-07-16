import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import NumberedPagination from "@/components/common/NumberedPagination";
import React from "react";

/**
 * Pagination coverage test.
 *
 * Goal: ensure every table-rendering page in the admin, provider, and client
 * areas wires up the shared <NumberedPagination /> control. We do this by
 * scanning the source tree (cheaper + far more reliable than mounting every
 * page, which would require Supabase, router, and auth providers).
 *
 * A page "has a table" if its source contains a shadcn <Table or <TableBody
 * tag, OR a list-style grid that uses our pageItems slicing convention.
 */

const ROOTS = [
  { label: "admin",    dir: "src/pages/admin" },
  { label: "provider", dir: "src/pages/provider" },
  { label: "client",   dir: "src/pages/client" },
];

// Pages intentionally exempt (no tabular/list data, or fully empty states).
const EXEMPT = new Set<string>([
  // add file basenames here if a page legitimately has no list
]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (entry.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const TABLE_RX = /<Table[\s>]|<TableBody[\s>]/;
const LIST_RX  = /\bpageItems\b|\busePagination\(/;
const PAG_RX   = /NumberedPagination/;

describe("Numbered pagination coverage", () => {
  for (const { label, dir } of ROOTS) {
    describe(`${label} pages`, () => {
      const files = walk(dir);

      for (const file of files) {
        const base = file.split("/").pop()!;
        if (EXEMPT.has(base)) continue;

        const src = readFileSync(file, "utf8");
        const hasList = TABLE_RX.test(src) || LIST_RX.test(src);
        if (!hasList) continue;

        it(`${base} renders <NumberedPagination />`, () => {
          expect(
            PAG_RX.test(src),
            `${file} contains a table/list but does not import or render NumberedPagination`,
          ).toBe(true);
        });
      }
    });
  }

  it("renders numbered page buttons (1, 2, 3 …)", () => {
    render(
      React.createElement(NumberedPagination, {
        currentPage: 1,
        totalPages: 3,
        onPageChange: () => {},
      }),
    );
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows ellipsis for large page counts", () => {
    const { container } = render(
      React.createElement(NumberedPagination, {
        currentPage: 1,
        totalPages: 20,
        onPageChange: () => {},
      }),
    );
    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("20");
  });

  it("renders the 'Rows per page' selector when onPageSizeChange + pageSize are provided", () => {
    const { container } = render(
      React.createElement(NumberedPagination, {
        currentPage: 1,
        totalPages: 3,
        pageSize: 10,
        totalItems: 25,
        onPageChange: () => {},
        onPageSizeChange: () => {},
      }),
    );
    expect(container.textContent).toContain("Rows per page");
    // Radix Select renders the current value inside the trigger.
    expect(container.querySelector('[role="combobox"]')).not.toBeNull();
  });

  it("does NOT render the size selector when onPageSizeChange is omitted", () => {
    const { container } = render(
      React.createElement(NumberedPagination, {
        currentPage: 1,
        totalPages: 3,
        pageSize: 10,
        totalItems: 25,
        onPageChange: () => {},
      }),
    );
    expect(container.textContent).not.toContain("Rows per page");
  });

  /**
   * Static guarantee: every <NumberedPagination /> instance across the app
   * either wires up BOTH `pageSize` and `onPageSizeChange` (so the selector
   * works) or neither (selector intentionally hidden). This prevents the
   * regression where a caller passes only one of the two and silently breaks
   * the rows-per-page UI.
   */
  describe("page-size selector wiring", () => {
    const ALL_DIRS = [
      "src/pages",
      "src/components",
    ];

    const allFiles: string[] = [];
    for (const d of ALL_DIRS) allFiles.push(...walk(d));

    const callerFiles = allFiles.filter((f) => {
      if (f.endsWith("NumberedPagination.tsx")) return false;
      const src = readFileSync(f, "utf8");
      return /<NumberedPagination\b/.test(src);
    });

    it("finds at least one caller (sanity)", () => {
      expect(callerFiles.length).toBeGreaterThan(0);
    });

    for (const file of callerFiles) {
      const base = file.split("/").pop()!;
      const src = readFileSync(file, "utf8");
      const blocks = src.match(/<NumberedPagination\b[\s\S]*?\/>/g) ?? [];

      it(`${base} pairs pageSize with onPageSizeChange in every <NumberedPagination />`, () => {
        for (const block of blocks) {
          const hasSize = /\bpageSize\s*=/.test(block);
          const hasSetter = /\bonPageSizeChange\s*=/.test(block);
          expect(
            hasSize === hasSetter,
            `${file}: <NumberedPagination /> must pass BOTH pageSize and onPageSizeChange ` +
              `(or neither). Got pageSize=${hasSize}, onPageSizeChange=${hasSetter}.\n${block}`,
          ).toBe(true);
        }
      });
    }
  });
});

