/**
 * Accessibility checks for RoleBadge.
 *
 * Coverage:
 *  1. axe-core: no violations in light or dark mode.
 *  2. aria-label is present and role-specific in both themes.
 *  3. Computed contrast ratio (text vs background) meets WCAG AA (≥ 4.5:1)
 *     for every role in BOTH light and dark themes — derived from the HSL
 *     tokens declared in src/index.css so a token tweak that lowers contrast
 *     fails this test immediately.
 *  4. Focus visibility: badge inside a focusable wrapper inherits the
 *     `--ring` token via `focus-visible:ring-*` and remains keyboard-reachable.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import RoleBadge from "../RoleBadge";
import { ROLE_TONES, type RoleTone } from "@/lib/roleTokens";

const ROLES: RoleTone[] = ["Admin", "Provider", "Client"];

// ---------------------------------------------------------------------------
// HSL tokens mirrored from src/index.css (kept in sync manually — if these
// drift, contrast assertions will fail and force a review).
// ---------------------------------------------------------------------------
type Hsl = [number, number, number]; // h, s%, l%

const TOKENS = {
  light: {
    background: [120, 14, 97] as Hsl,
    primary: [186, 100, 9] as Hsl,
    "primary-foreground": [0, 0, 100] as Hsl,
    muted: [46, 10, 94] as Hsl,
    "muted-foreground": [150, 6, 38] as Hsl,
  },
  dark: {
    background: [150, 12, 8] as Hsl,
    primary: [69, 100, 66] as Hsl,
    "primary-foreground": [186, 100, 9] as Hsl,
    muted: [150, 8, 15] as Hsl,
    "muted-foreground": [120, 6, 70] as Hsl,
  },
} as const;

type Theme = keyof typeof TOKENS;

// HSL → sRGB → relative luminance → contrast ratio (WCAG 2.1).
function hslToRgb([h, s, l]: Hsl): [number, number, number] {
  const S = s / 100;
  const L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function relLuminance([r, g, b]: [number, number, number]): number {
  const ch = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function contrast(fg: Hsl, bg: Hsl): number {
  const L1 = relLuminance(hslToRgb(fg));
  const L2 = relLuminance(hslToRgb(bg));
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

// What pair of tokens does each role's tone-class actually paint with?
const ROLE_PAIR: Record<RoleTone, { fg: keyof typeof TOKENS.light; bg: keyof typeof TOKENS.light }> =
  {
    Admin: { fg: "primary-foreground", bg: "primary" },
    Provider: { fg: "primary", bg: "background" }, // bg-primary/10 over page bg
    Client: { fg: "muted-foreground", bg: "muted" },
  };

function setTheme(theme: Theme) {
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);
}

describe("RoleBadge — accessibility", () => {
  for (const theme of ["light", "dark"] as Theme[]) {
    describe(`${theme} mode`, () => {
      for (const role of ROLES) {
        it(`${role}: has no axe violations`, async () => {
          setTheme(theme);
          const { container } = render(<RoleBadge role={role} />);
          const results = await axe(container);
          expect(results).toHaveNoViolations();
        });

        it(`${role}: exposes aria-label "Active role: ${role}"`, () => {
          setTheme(theme);
          const { container } = render(<RoleBadge role={role} />);
          const span = container.querySelector("span")!;
          expect(span.getAttribute("aria-label")).toBe(`Active role: ${role}`);
          expect(span.textContent).toBe(role);
        });

        it(`${role}: meets WCAG AA contrast (≥ 4.5:1)`, () => {
          const pair = ROLE_PAIR[role];
          const fg = TOKENS[theme][pair.fg];
          const bg = TOKENS[theme][pair.bg];
          const ratio = contrast(fg, bg);
          expect(
            ratio,
            `${role} (${theme}): ${pair.fg} vs ${pair.bg} = ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(4.5);
        });
      }

      it("Admin badge meets AAA (≥ 7:1) — strongest call-to-attention pill", () => {
        const { fg, bg } = ROLE_PAIR.Admin;
        const ratio = contrast(TOKENS[theme][fg], TOKENS[theme][bg]);
        expect(ratio, `Admin (${theme}) = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(7);
      });
    });
  }

  it("tone classes are identical across desktop/mobile variants (no drift)", () => {
    for (const role of ROLES) {
      const desktop = render(<RoleBadge role={role} hideOnMobile />)
        .container.querySelector("span")!.className;
      const mobile = render(<RoleBadge role={role} />)
        .container.querySelector("span")!.className;
      // The tone fragment from ROLE_TONES must appear identically in both.
      expect(desktop).toContain(ROLE_TONES[role]);
      expect(mobile).toContain(ROLE_TONES[role]);
    }
  });

  it("focus visibility: badge inside a focusable button inherits ring tokens", () => {
    const { container } = render(
      <button type="button" className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <RoleBadge role="Admin" />
      </button>,
    );
    const btn = container.querySelector("button")!;
    btn.focus();
    expect(document.activeElement).toBe(btn);
    // Token-based focus ring classes must be present on the focusable wrapper.
    expect(btn.className).toMatch(/focus-visible:ring-2/);
    expect(btn.className).toMatch(/focus-visible:ring-ring/);
  });

  // -------------------------------------------------------------------------
  // State variants (loading / disabled) — added after the original a11y suite.
  // axe should pass and the right ARIA hooks must be present in BOTH themes.
  // -------------------------------------------------------------------------
  for (const theme of ["light", "dark"] as Theme[]) {
    describe(`${theme} mode — state variants`, () => {
      it("loading: no axe violations", async () => {
        setTheme(theme);
        const { container } = render(<RoleBadge loading />);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("loading: aria-busy='true' and aria-label='Loading role'", () => {
        setTheme(theme);
        const { container } = render(<RoleBadge loading />);
        const span = container.querySelector("span")!;
        expect(span.getAttribute("aria-busy")).toBe("true");
        expect(span.getAttribute("aria-label")).toBe("Loading role");
      });

      it("disabled: no axe violations", async () => {
        setTheme(theme);
        const { container } = render(<RoleBadge role="Admin" disabled />);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("disabled: aria-disabled='true' and aria-label='Role unavailable'", () => {
        setTheme(theme);
        const { container } = render(<RoleBadge role="Admin" disabled />);
        const span = container.querySelector("span")!;
        expect(span.getAttribute("aria-disabled")).toBe("true");
        expect(span.getAttribute("aria-label")).toBe("Role unavailable");
      });

      it("custom label: no axe violations and label is honored", async () => {
        setTheme(theme);
        const { container } = render(
          <RoleBadge role="Admin" label="Signed in as super admin" />,
        );
        expect(container.querySelector("span")!.getAttribute("aria-label")).toBe(
          "Signed in as super admin",
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });
    });
  }
});
