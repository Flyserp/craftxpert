import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import RoleBadge, { type BadgeRole } from "../RoleBadge";

/**
 * Per-role × per-variant token unit tests.
 *
 * Snapshots (RoleBadge.test.tsx) lock the *exact* className output;
 * these tests assert the *semantic* tokens that drive contrast, so a
 * developer can read intent without diffing snapshots.
 */

type Variant = "desktop" | "mobile";

const TOKENS: Record<BadgeRole, { bg: RegExp; text: RegExp; border: RegExp }> = {
  Admin: {
    bg: /\bbg-primary\b/,
    text: /\btext-primary-foreground\b/,
    border: /\bborder-primary\b/,
  },
  Provider: {
    bg: /bg-primary\/10/,
    text: /\btext-primary\b/,
    border: /border-primary\/30/,
  },
  Client: {
    bg: /\bbg-muted\b/,
    text: /\btext-muted-foreground\b/,
    border: /\bborder-border\b/,
  },
};

const SHARED_BASE = [
  /\binline-flex\b/,
  /\brounded-full\b/,
  /(^|\s)text-\[9px\](\s|$)/,
  /\bfont-bold\b/,
  /\buppercase\b/,
  /\btracking-wide\b/,
  /\bborder\b/,
];

const VARIANTS: { name: Variant; props: { hideOnMobile?: boolean }; expectHidden: boolean }[] = [
  { name: "desktop", props: { hideOnMobile: true }, expectHidden: true },
  { name: "mobile", props: {}, expectHidden: false },
];

describe("RoleBadge token contract", () => {
  for (const role of Object.keys(TOKENS) as BadgeRole[]) {
    for (const variant of VARIANTS) {
      describe(`${role} (${variant.name})`, () => {
        const renderBadge = () =>
          render(<RoleBadge role={role} {...variant.props} />).container.querySelector("span")!;

        it("renders shared base classes", () => {
          const cls = renderBadge().className;
          for (const re of SHARED_BASE) expect(cls).toMatch(re);
        });

        it("renders the correct background token", () => {
          expect(renderBadge().className).toMatch(TOKENS[role].bg);
        });

        it("renders the correct foreground (text) token", () => {
          expect(renderBadge().className).toMatch(TOKENS[role].text);
        });

        it("renders the correct border token", () => {
          expect(renderBadge().className).toMatch(TOKENS[role].border);
        });

        it(`is ${variant.expectHidden ? "hidden on small screens" : "visible on small screens"}`, () => {
          const cls = renderBadge().className;
          if (variant.expectHidden) {
            expect(cls).toContain("hidden");
            expect(cls).toContain("md:inline-flex");
          } else {
            expect(cls).not.toMatch(/\bhidden\b/);
          }
        });

        it("exposes accessible role label", () => {
          expect(renderBadge().getAttribute("aria-label")).toBe(`Active role: ${role}`);
        });

        it("renders the role text", () => {
          expect(renderBadge().textContent).toBe(role);
        });
      });
    }
  }

  it("does NOT leak Admin tokens onto Provider or Client (desktop & mobile)", () => {
    for (const variant of VARIANTS) {
      for (const role of ["Provider", "Client"] as BadgeRole[]) {
        const { container } = render(<RoleBadge role={role} {...variant.props} />);
        const cls = container.querySelector("span")!.className;
        expect(cls).not.toMatch(/\btext-primary-foreground\b/);
      }
    }
  });

  it("does NOT leak Client neutral tokens onto Admin/Provider", () => {
    for (const variant of VARIANTS) {
      for (const role of ["Admin", "Provider"] as BadgeRole[]) {
        const { container } = render(<RoleBadge role={role} {...variant.props} />);
        const cls = container.querySelector("span")!.className;
        expect(cls).not.toMatch(/\btext-muted-foreground\b/);
      }
    }
  });
});
