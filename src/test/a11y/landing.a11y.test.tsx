/**
 * Accessibility audit — Landing page.
 *
 * Renders the public landing page (no auth required) and runs axe-core
 * against the rendered DOM. Fails on any WCAG 2.1 A/AA violation.
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { TestProviders } from "./_providers";

vi.mock("@/integrations/supabase/client", async () => {
  const { makeSupabaseMock } = await import("./_supabaseMock");
  return { supabase: makeSupabaseMock() };
});

vi.mock("@/contexts/AuthContext", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    AuthProvider: ({ children }: { children: React.ReactNode }) =>
      actual.createElement(actual.Fragment, null, children),
    useAuth: () => ({
      user: null,
      profile: null,
      session: null,
      loading: false,
      hasRole: () => false,
      signOut: () => Promise.resolve(),
    }),
  };
});

import Index from "@/pages/Index";

describe("a11y: Landing page", () => {
  it("has no detectable WCAG violations", async () => {
    const { container } = render(
      <TestProviders>
        <Index />
      </TestProviders>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 30000);
});
