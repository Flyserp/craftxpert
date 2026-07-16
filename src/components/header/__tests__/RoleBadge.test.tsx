import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import RoleBadge, { type BadgeRole } from "../RoleBadge";

/**
 * Snapshot tests for RoleBadge — the single source of truth for the
 * Admin / Provider / Client pill rendered in the header.
 *
 * Purpose: lock the className output so any future tweak to the role
 * tones (e.g. losing `text-primary-foreground` on the Admin badge or
 * dropping the dark-mode ring) shows up as a snapshot diff in PR review.
 *
 * If a change is intentional, re-run vitest with `-u` to update.
 */

const ROLES: BadgeRole[] = ["Admin", "Provider", "Client"];

describe("RoleBadge — visual regression snapshots", () => {
  for (const role of ROLES) {
    it(`renders ${role} with stable token classes`, () => {
      const { container } = render(<RoleBadge role={role} />);
      const span = container.querySelector("span")!;
      expect(span).toBeInTheDocument();
      expect(span.getAttribute("aria-label")).toBe(`Active role: ${role}`);
      expect(span.className).toMatchSnapshot();
    });

    it(`renders ${role} with hideOnMobile`, () => {
      const { container } = render(<RoleBadge role={role} hideOnMobile />);
      const span = container.querySelector("span")!;
      expect(span.className).toContain("hidden");
      expect(span.className).toContain("md:inline-flex");
      expect(span.className).toMatchSnapshot();
    });
  }

  it("Admin badge keeps high-contrast tokens (regression guard)", () => {
    const { container } = render(<RoleBadge role="Admin" />);
    const cls = container.querySelector("span")!.className;
    // These three tokens together guarantee deep-teal/lime contrast in
    // both themes. Removing any one would silently lower contrast.
    expect(cls).toMatch(/\bbg-primary\b/);
    expect(cls).toMatch(/\btext-primary-foreground\b/);
    expect(cls).toMatch(/\bborder-primary\b/);
    // Dark-mode separation ring must remain so the lime pill doesn't
    // bleed into the dark header chrome.
    expect(cls).toMatch(/dark:ring-primary\/40/);
    expect(cls).toMatch(/dark:border-background/);
  });

  it("Provider badge uses primary-tinted tokens", () => {
    const { container } = render(<RoleBadge role="Provider" />);
    const cls = container.querySelector("span")!.className;
    expect(cls).toMatch(/\btext-primary\b/);
    expect(cls).toMatch(/bg-primary\/10/);
    expect(cls).toMatch(/border-primary\/30/);
  });

  it("Client badge uses neutral muted tokens", () => {
    const { container } = render(<RoleBadge role="Client" />);
    const cls = container.querySelector("span")!.className;
    expect(cls).toMatch(/\bbg-muted\b/);
    expect(cls).toMatch(/\btext-muted-foreground\b/);
    expect(cls).toMatch(/\bborder-border\b/);
  });
});
