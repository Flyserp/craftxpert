/**
 * Dark-mode token contract for the Admin badge + Admin Panel button.
 *
 * These two surfaces are the platform's strongest "you have elevated
 * privileges" indicators. On the lime/teal dark palette they need
 * extra structural classes (separation ring/border, lifted hover) to
 * stay legible against the surrounding header chrome.
 *
 * This suite locks in those *specific* `dark:` tokens so a future
 * refactor that drops them (e.g. trimming a className string) fails
 * loudly instead of silently regressing contrast in dark mode.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import RoleBadge from "../RoleBadge";
import { ROLE_TONES, ADMIN_PANEL_BUTTON_CLASSES } from "@/lib/roleTokens";

describe("Admin badge — dark-mode tokens", () => {
  // The exact `dark:` utilities the Admin tone must keep.
  // Each entry is asserted independently so failures point at the
  // specific token that went missing.
  const REQUIRED_ADMIN_DARK_TOKENS = [
    /\bdark:border-background\b/, // separates the pill from sibling chrome
    /\bdark:ring-1\b/,             // soft glow for accent visibility
    /\bdark:ring-primary\/40\b/,   // ring uses the primary accent at 40% alpha
    /dark:shadow-\[0_0_0_1px_hsl\(var\(--background\)\)\]/, // outer hairline
  ];

  it("ROLE_TONES.Admin contains every required dark-mode token", () => {
    for (const token of REQUIRED_ADMIN_DARK_TOKENS) {
      expect(ROLE_TONES.Admin, `Missing token: ${token}`).toMatch(token);
    }
  });

  it("renders every required dark-mode token on the Admin badge element", () => {
    const { container } = render(<RoleBadge role="Admin" />);
    const cls = container.querySelector("span")!.className;
    for (const token of REQUIRED_ADMIN_DARK_TOKENS) {
      expect(cls, `Rendered className missing: ${token}`).toMatch(token);
    }
  });

  it("keeps the light-mode primary background so the badge never goes invisible", () => {
    const { container } = render(<RoleBadge role="Admin" />);
    const cls = container.querySelector("span")!.className;
    expect(cls).toMatch(/\bbg-primary\b/);
    expect(cls).toMatch(/\btext-primary-foreground\b/);
    expect(cls).toMatch(/\bborder-primary\b/);
  });

  it("does NOT silently drop dark tokens when `hideOnMobile` is set", () => {
    const { container } = render(<RoleBadge role="Admin" hideOnMobile />);
    const cls = container.querySelector("span")!.className;
    for (const token of REQUIRED_ADMIN_DARK_TOKENS) {
      expect(cls).toMatch(token);
    }
  });
});

describe("Admin Panel button — dark-mode tokens", () => {
  // The button is rendered inside a Link inside the (lazy) header.
  // Asserting on the *constant* directly is the most robust check —
  // it's the literal string applied to the rendered <button>.
  const REQUIRED_BUTTON_DARK_TOKENS = [
    /\bdark:border-background\b/,    // separates from page bg in dark
    /\bdark:ring-1\b/,                // soft glow
    /\bdark:ring-primary\/50\b/,      // primary accent at 50% alpha
    /\bdark:hover:bg-primary\/85\b/, // legible hover on lime/teal flip
  ];

  const REQUIRED_BUTTON_BASE_TOKENS = [
    /\bbg-primary\b/,
    /\btext-primary-foreground\b/,
    /\bborder-primary\b/,
    /\bhover:bg-primary\/90\b/,
    // Focus visibility is part of the dark-mode contract too: the ring
    // must stand off the background even on the darkest surface.
    /\bfocus-visible:ring-2\b/,
    /\bfocus-visible:ring-ring\b/,
    /\bfocus-visible:ring-offset-background\b/,
  ];

  it("exports every required dark-mode token", () => {
    for (const token of REQUIRED_BUTTON_DARK_TOKENS) {
      expect(
        ADMIN_PANEL_BUTTON_CLASSES,
        `ADMIN_PANEL_BUTTON_CLASSES missing: ${token}`,
      ).toMatch(token);
    }
  });

  it("preserves base + focus-visibility tokens alongside dark overrides", () => {
    for (const token of REQUIRED_BUTTON_BASE_TOKENS) {
      expect(
        ADMIN_PANEL_BUTTON_CLASSES,
        `ADMIN_PANEL_BUTTON_CLASSES missing base/focus token: ${token}`,
      ).toMatch(token);
    }
  });

  it("does not regress to plain primary without dark adjustments", () => {
    // A common refactor mistake is dropping the dark: prefix entirely.
    // Ensure at least one `dark:` utility is present.
    expect(ADMIN_PANEL_BUTTON_CLASSES).toMatch(/\bdark:/);
  });
});
