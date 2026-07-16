/**
 * Accessible-name & semantics contract for `RoleBadge`.
 *
 * Verifies the badge exposes a correct accessible name (per ARIA's
 * accessible name computation) for every supported role × visibility
 * variant × state, plus the supporting ARIA attributes that screen
 * readers use to announce loading / disabled placeholders.
 *
 * What this guards against:
 *   - Dropping `aria-label` on a refactor (would leave SR users with
 *     just the visible "ADMIN" text — fine, but not role-prefixed).
 *   - Letting visible text and accessible name drift apart.
 *   - Forgetting `aria-busy` / `aria-disabled` on state variants.
 *   - Per-role label typos ("Active role: ADMIN" vs "Active role: Admin").
 *   - Custom `label` prop being silently ignored.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RoleBadge from "../RoleBadge";
import type { RoleTone } from "@/lib/roleTokens";

const ROLES: RoleTone[] = ["Admin", "Provider", "Client"];

const VARIANTS = [
  { name: "desktop", props: { hideOnMobile: true } as const },
  { name: "mobile", props: {} as const },
];

describe("RoleBadge — accessible name & semantics", () => {
  // ---------------------------------------------------------------------
  // Resolved-role variants
  // ---------------------------------------------------------------------
  for (const role of ROLES) {
    for (const variant of VARIANTS) {
      describe(`${role} (${variant.name})`, () => {
        it(`exposes accessible name "Active role: ${role}"`, () => {
          render(<RoleBadge role={role} {...variant.props} />);
          // Querying by accessible name is the highest-fidelity check —
          // it exercises ARIA's name-computation algorithm via the DOM
          // testing library's heuristic, not just the raw attribute.
          expect(
            screen.getByLabelText(`Active role: ${role}`),
          ).toBeInTheDocument();
        });

        it(`raw aria-label attribute matches "Active role: ${role}"`, () => {
          const { container } = render(<RoleBadge role={role} {...variant.props} />);
          expect(container.querySelector("span")!.getAttribute("aria-label")).toBe(
            `Active role: ${role}`,
          );
        });

        it("visible text equals the role label (no drift)", () => {
          const { container } = render(<RoleBadge role={role} {...variant.props} />);
          expect(container.querySelector("span")!.textContent).toBe(role);
        });

        it("data-state is 'ready' on a resolved role", () => {
          const { container } = render(<RoleBadge role={role} {...variant.props} />);
          expect(container.querySelector("span")!.getAttribute("data-state")).toBe("ready");
        });

        it("does NOT carry aria-busy or aria-disabled on a resolved role", () => {
          const { container } = render(<RoleBadge role={role} {...variant.props} />);
          const span = container.querySelector("span")!;
          expect(span.getAttribute("aria-busy")).toBeNull();
          expect(span.getAttribute("aria-disabled")).toBeNull();
        });
      });
    }
  }

  // ---------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------
  describe("loading state", () => {
    it('exposes accessible name "Loading role"', () => {
      render(<RoleBadge loading />);
      expect(screen.getByLabelText("Loading role")).toBeInTheDocument();
    });

    it("sets aria-busy='true' so SRs announce a pending state", () => {
      const { container } = render(<RoleBadge loading />);
      expect(container.querySelector("span")!.getAttribute("aria-busy")).toBe("true");
    });

    it("does not announce a stale/disabled role concurrently", () => {
      const { container } = render(<RoleBadge loading />);
      expect(container.querySelector("span")!.getAttribute("aria-disabled")).toBeNull();
    });

    it("data-state is 'loading'", () => {
      const { container } = render(<RoleBadge loading />);
      expect(container.querySelector("span")!.getAttribute("data-state")).toBe("loading");
    });

    it("loading wins over a passed `role` (precedence rule)", () => {
      // The component contract says loading > disabled > role.
      render(<RoleBadge role="Admin" loading />);
      expect(screen.getByLabelText("Loading role")).toBeInTheDocument();
      expect(screen.queryByLabelText("Active role: Admin")).toBeNull();
    });
  });

  // ---------------------------------------------------------------------
  // Disabled state
  // ---------------------------------------------------------------------
  describe("disabled state", () => {
    it('exposes accessible name "Role unavailable"', () => {
      render(<RoleBadge role="Admin" disabled />);
      expect(screen.getByLabelText("Role unavailable")).toBeInTheDocument();
    });

    it("sets aria-disabled='true'", () => {
      const { container } = render(<RoleBadge role="Admin" disabled />);
      expect(container.querySelector("span")!.getAttribute("aria-disabled")).toBe("true");
    });

    it("does not also set aria-busy", () => {
      const { container } = render(<RoleBadge role="Admin" disabled />);
      expect(container.querySelector("span")!.getAttribute("aria-busy")).toBeNull();
    });

    it("data-state is 'disabled'", () => {
      const { container } = render(<RoleBadge role="Admin" disabled />);
      expect(container.querySelector("span")!.getAttribute("data-state")).toBe("disabled");
    });

    it("does not leak the role text — visible content is the em-dash placeholder", () => {
      const { container } = render(<RoleBadge role="Admin" disabled />);
      expect(container.querySelector("span")!.textContent).toBe("—");
    });
  });

  // ---------------------------------------------------------------------
  // Custom label override
  // ---------------------------------------------------------------------
  describe("custom label prop", () => {
    it("overrides the default 'Active role: …' name on a resolved role", () => {
      render(<RoleBadge role="Admin" label="Signed in as super admin" />);
      expect(screen.getByLabelText("Signed in as super admin")).toBeInTheDocument();
      expect(screen.queryByLabelText("Active role: Admin")).toBeNull();
    });

    it("overrides the default 'Loading role' name", () => {
      render(<RoleBadge loading label="Resolving session…" />);
      expect(screen.getByLabelText("Resolving session…")).toBeInTheDocument();
    });

    it("overrides the default 'Role unavailable' name", () => {
      render(<RoleBadge role="Admin" disabled label="Impersonation paused" />);
      expect(screen.getByLabelText("Impersonation paused")).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Cross-role isolation: each role must have a UNIQUE accessible name
  // so SR users can disambiguate when several badges are on the page
  // (e.g. an admin/users table).
  // ---------------------------------------------------------------------
  it("renders unique accessible names when multiple roles coexist", () => {
    render(
      <div>
        <RoleBadge role="Admin" />
        <RoleBadge role="Provider" />
        <RoleBadge role="Client" />
      </div>,
    );
    expect(screen.getByLabelText("Active role: Admin")).toBeInTheDocument();
    expect(screen.getByLabelText("Active role: Provider")).toBeInTheDocument();
    expect(screen.getByLabelText("Active role: Client")).toBeInTheDocument();
  });
});
