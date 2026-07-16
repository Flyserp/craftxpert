/**
 * Accessibility audit — Client / Provider / Admin dashboard layouts.
 *
 * Renders the layout shells (which contain the nav/sidebar/header chrome
 * shared by every dashboard page) with auth + Supabase mocked, and asserts
 * no WCAG 2.1 A/AA violations.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Routes, Route } from "react-router-dom";
import { TestProviders } from "./_providers";
import React from "react";

vi.mock("@/integrations/supabase/client", async () => {
  const { makeSupabaseMock } = await import("./_supabaseMock");
  return { supabase: makeSupabaseMock() };
});

let mockRole: "customer" | "provider" | "admin" = "customer";
const setMockRole = (r: typeof mockRole) => { mockRole = r; };

vi.mock("@/contexts/AuthContext", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    AuthProvider: ({ children }: { children: React.ReactNode }) =>
      actual.createElement(actual.Fragment, null, children),
    useAuth: () => ({
      user: { id: "test-user", email: `${mockRole}@test.com` },
      profile: { display_name: "Test User", user_id: "test-user" },
      session: { access_token: "test" },
      loading: false,
      hasRole: (role: string) => role === mockRole,
      signOut: () => Promise.resolve(),
    }),
  };
});

vi.mock("@/hooks/useUnreadMessages", () => ({ useUnreadMessages: () => 0 }));
vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markAsRead: () => {},
    markAllAsRead: () => {},
  }),
}));

describe("a11y: Dashboard layouts", () => {
  beforeEach(() => cleanup());

  it("Client dashboard layout has no WCAG violations", async () => {
    setMockRole("customer");
    const { default: DashboardLayout } = await import("@/components/DashboardLayout");
    const { container } = render(
      <TestProviders initialEntries={["/client-dashboard"]}>
        <DashboardLayout title="Dashboard" subtitle="Welcome back">
          <section aria-label="Overview">
            <h2>Recent activity</h2>
            <p>No recent activity yet.</p>
          </section>
        </DashboardLayout>
      </TestProviders>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 30000);

  it("Provider dashboard layout has no WCAG violations", async () => {
    setMockRole("provider");
    const { default: DashboardLayout } = await import("@/components/DashboardLayout");
    const { container } = render(
      <TestProviders initialEntries={["/provider-dashboard"]}>
        <DashboardLayout title="Dashboard" subtitle="Your business at a glance">
          <section aria-label="Overview">
            <h2>Today's bookings</h2>
            <p>No bookings scheduled.</p>
          </section>
        </DashboardLayout>
      </TestProviders>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 30000);

  it("Admin dashboard layout has no WCAG violations", async () => {
    setMockRole("admin");
    const { default: AdminLayout } = await import("@/components/admin/AdminLayout");
    const { container } = render(
      <TestProviders initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route
              index
              element={
                <section aria-label="Overview">
                  <h2>Platform stats</h2>
                  <p>All systems normal.</p>
                </section>
              }
            />
          </Route>
        </Routes>
      </TestProviders>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 30000);
});
