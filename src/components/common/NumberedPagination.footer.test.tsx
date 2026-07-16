import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import NumberedPagination from "@/components/common/NumberedPagination";

/**
 * Verifies the pagination footer layout in BOTH data states on a small
 * (mobile) viewport:
 *
 *   1. totalItems > 0 — selector + "Showing X of Y" caption are stacked
 *      vertically (flex-col, centered) and the caption has whitespace-nowrap.
 *   2. totalItems === 0 — only the size selector renders, no caption,
 *      and the container still uses the mobile column layout.
 *
 * jsdom has no real layout engine, so we verify Tailwind classes (the
 * source of the responsive behaviour) rather than computed flex-direction.
 * The matching responsive computed-style assertions live in the Playwright
 * specs at e2e/admin-pagination-{responsive,tablet,desktop}.spec.ts.
 */

const MOBILE_WIDTH = 375;

beforeEach(() => {
  // Force jsdom into a "small screen" state so any hooks reading width
  // (use-mobile, etc.) behave consistently.
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: MOBILE_WIDTH,
  });
  window.dispatchEvent(new Event("resize"));
});

function getFooter(label: HTMLElement): HTMLElement {
  // Walk up to the nearest ancestor div carrying the mobile flex-col class.
  let node: HTMLElement | null = label;
  while (node && !node.classList.contains("flex-col")) {
    node = node.parentElement;
  }
  if (!node) throw new Error("Could not find flex-col footer ancestor");
  return node;
}

describe("NumberedPagination footer — small-screen layout", () => {
  it("totalItems > 0: selector + caption stacked, caption is nowrap", () => {
    render(
      React.createElement(NumberedPagination, {
        currentPage: 1,
        totalPages: 1,
        pageSize: 10,
        totalItems: 7,
        onPageChange: () => {},
        onPageSizeChange: () => {},
      }),
    );

    const label = screen.getByText("Rows per page");
    const footer = getFooter(label);

    // Mobile-stack classes present.
    for (const cls of ["flex", "flex-col", "items-center", "justify-center"]) {
      expect(footer.classList.contains(cls)).toBe(true);
    }
    // Switches to row at sm: breakpoint.
    expect(footer.className).toMatch(/sm:flex-row/);

    // Caption renders and is whitespace-nowrap.
    const caption = screen.getByText(/Showing\s+7\s+of\s+7/);
    expect(caption).toBeInTheDocument();
    expect(caption.className).toMatch(/whitespace-nowrap/);

    // DOM order: selector before caption (vertical stack on mobile).
    expect(label.compareDocumentPosition(caption)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("totalItems === 0: only the selector renders, no caption", () => {
    render(
      React.createElement(NumberedPagination, {
        currentPage: 1,
        totalPages: 1,
        pageSize: 10,
        totalItems: 0,
        onPageChange: () => {},
        onPageSizeChange: () => {},
      }),
    );

    const label = screen.getByText("Rows per page");
    const footer = getFooter(label);

    // Container still uses the mobile-stack layout for consistency.
    for (const cls of ["flex", "flex-col", "items-center", "justify-center"]) {
      expect(footer.classList.contains(cls)).toBe(true);
    }
    expect(footer.className).toMatch(/sm:flex-row/);

    // Caption MUST NOT render when totalItems is 0.
    expect(screen.queryByText(/Showing\b/i)).not.toBeInTheDocument();
    // Selector itself is still present.
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
