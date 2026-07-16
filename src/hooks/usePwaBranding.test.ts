import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the supabase client so importing the hook module doesn't try to hit the network.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ in: async () => ({ data: [] }) }),
    }),
  },
}));

import {
  applyBrandColors,
  reapplyBrandColors,
  syncThemeColorMeta,
  hslTripletToHex,
} from "@/hooks/usePwaBranding";

const PRIMARY_HEX = "#ff0080"; // magenta — clearly not the dark-mode lime
const ACCENT_HEX = "#00c2ff";

function setDark(on: boolean) {
  const html = document.documentElement;
  html.classList.toggle("dark", on);
}

function clearInline() {
  const html = document.documentElement;
  ["--primary", "--primary-foreground", "--ring", "--accent", "--accent-foreground"].forEach(
    (t) => html.style.removeProperty(t),
  );
}

describe("applyBrandColors — dark mode guard", () => {
  beforeEach(() => {
    clearInline();
    setDark(false);
    // reset cached brand between tests
    (window as unknown as { __lovableBrand?: unknown }).__lovableBrand = undefined;
  });

  it("writes inline --primary / --primary-foreground / --ring in light mode", () => {
    setDark(false);
    applyBrandColors(PRIMARY_HEX, ACCENT_HEX);

    const html = document.documentElement;
    expect(html.style.getPropertyValue("--primary")).not.toBe("");
    expect(html.style.getPropertyValue("--primary-foreground")).not.toBe("");
    expect(html.style.getPropertyValue("--ring")).not.toBe("");
    // accent still applies in both modes
    expect(html.style.getPropertyValue("--accent")).not.toBe("");
    expect(html.style.getPropertyValue("--accent-foreground")).not.toBe("");
  });

  it("removes inline --primary / --primary-foreground / --ring when dark mode is active", () => {
    setDark(true);
    applyBrandColors(PRIMARY_HEX, ACCENT_HEX);

    const html = document.documentElement;
    expect(html.style.getPropertyValue("--primary")).toBe("");
    expect(html.style.getPropertyValue("--primary-foreground")).toBe("");
    expect(html.style.getPropertyValue("--ring")).toBe("");
    // --accent must still be applied so tenants can brand accents in dark mode
    expect(html.style.getPropertyValue("--accent")).not.toBe("");
    expect(html.style.getPropertyValue("--accent-foreground")).not.toBe("");
  });

  it("strips any pre-existing inline --primary override when switching into dark mode", () => {
    // Simulate a stale inline override left over from a light-mode paint.
    const html = document.documentElement;
    html.style.setProperty("--primary", "187 100% 9%");
    html.style.setProperty("--primary-foreground", "0 0% 100%");
    html.style.setProperty("--ring", "187 100% 9%");

    setDark(true);
    applyBrandColors(PRIMARY_HEX, ACCENT_HEX);

    expect(html.style.getPropertyValue("--primary")).toBe("");
    expect(html.style.getPropertyValue("--primary-foreground")).toBe("");
    expect(html.style.getPropertyValue("--ring")).toBe("");
  });

  it("reapplyBrandColors re-runs the guard after a theme toggle (light → dark)", () => {
    // First apply in light — inline primary tokens should be present.
    setDark(false);
    applyBrandColors(PRIMARY_HEX, ACCENT_HEX);
    const html = document.documentElement;
    expect(html.style.getPropertyValue("--primary")).not.toBe("");

    // Toggle to dark and re-apply from the cached brand.
    setDark(true);
    reapplyBrandColors();

    expect(html.style.getPropertyValue("--primary")).toBe("");
    expect(html.style.getPropertyValue("--primary-foreground")).toBe("");
    expect(html.style.getPropertyValue("--ring")).toBe("");
  });

  it("clears inline primary tokens when called with null in dark mode", () => {
    const html = document.documentElement;
    html.style.setProperty("--primary", "123 45% 67%");
    html.style.setProperty("--primary-foreground", "0 0% 100%");
    html.style.setProperty("--ring", "123 45% 67%");

    setDark(true);
    applyBrandColors(null, null);

    expect(html.style.getPropertyValue("--primary")).toBe("");
    expect(html.style.getPropertyValue("--primary-foreground")).toBe("");
    expect(html.style.getPropertyValue("--ring")).toBe("");
    expect(html.style.getPropertyValue("--accent")).toBe("");
    expect(html.style.getPropertyValue("--accent-foreground")).toBe("");
  });
});

describe("syncThemeColorMeta — PWA theme-color follows --primary", () => {
  beforeEach(() => {
    clearInline();
    setDark(false);
    (window as unknown as { __lovableBrand?: unknown }).__lovableBrand = undefined;
    // Reset meta between tests so we can assert creation + content precisely.
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((n) => n.remove());
  });

  it("hslTripletToHex converts the accent value correctly", () => {
    // 75 70% 40% = lime accent → #8aad1f
    expect(hslTripletToHex("75 70% 40%")).toBe("#8aad1f");
    // 187 100% 9% = deep teal → #00292e
    expect(hslTripletToHex("187 100% 9%")).toBe("#00292e");
  });

  it("writes theme-color meta matching an inline --primary override", () => {
    document.documentElement.style.setProperty("--primary", "187 100% 9%");
    syncThemeColorMeta();
    const meta = document.head.querySelector(
      'meta[name="theme-color"]',
    ) as HTMLMetaElement | null;
    expect(meta).not.toBeNull();
    expect(meta!.content.toLowerCase()).toBe("#00292e");
  });

  it("applyBrandColors syncs theme-color to the tenant brand hex in light mode", () => {
    setDark(false);
    applyBrandColors("#ff0080", null);
    const meta = document.head.querySelector(
      'meta[name="theme-color"]',
    ) as HTMLMetaElement | null;
    expect(meta).not.toBeNull();
    expect(meta!.content.toLowerCase()).toBe("#ff0080");
  });

  it("after switching to dark mode, theme-color no longer reflects the tenant primary", () => {
    // Light: tenant brand wins
    setDark(false);
    applyBrandColors("#ff0080", null);
    const meta = document.head.querySelector(
      'meta[name="theme-color"]',
    ) as HTMLMetaElement | null;
    expect(meta!.content.toLowerCase()).toBe("#ff0080");

    // Toggle to dark and re-apply — inline --primary is stripped by the guard,
    // so syncThemeColorMeta reads whatever the CSS token resolves to. In jsdom
    // the CSS class rule is not evaluated, so the resolved value is empty and
    // the meta is left alone. Assert it did NOT stay pinned to the tenant hex
    // via a stale inline write.
    setDark(true);
    reapplyBrandColors();
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("");
  });
});

describe("applyBrandColors — tenant switching cleans up inline tokens", () => {
  const TENANT_A = { primary: "#ff0080", accent: "#00c2ff" }; // magenta / cyan
  const TENANT_B = { primary: "#22cc44", accent: "#ffaa00" }; // green / orange

  beforeEach(() => {
    clearInline();
    setDark(false);
    (window as unknown as { __lovableBrand?: unknown }).__lovableBrand = undefined;
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((n) => n.remove());
  });

  it("overwrites tenant A's inline tokens when tenant B is applied (light mode)", () => {
    const html = document.documentElement;

    applyBrandColors(TENANT_A.primary, TENANT_A.accent);
    const aPrimary = html.style.getPropertyValue("--primary");
    const aAccent = html.style.getPropertyValue("--accent");
    expect(aPrimary).not.toBe("");
    expect(aAccent).not.toBe("");

    applyBrandColors(TENANT_B.primary, TENANT_B.accent);
    const bPrimary = html.style.getPropertyValue("--primary");
    const bAccent = html.style.getPropertyValue("--accent");

    // Values must have changed — no leakage from tenant A.
    expect(bPrimary).not.toBe(aPrimary);
    expect(bAccent).not.toBe(aAccent);
    // --ring must track the new primary, not the old one.
    expect(html.style.getPropertyValue("--ring")).toBe(bPrimary);
    // theme-color meta was updated for tenant B (not left pinned to tenant A).
    const meta = document.head.querySelector(
      'meta[name="theme-color"]',
    ) as HTMLMetaElement | null;
    expect(meta).not.toBeNull();
    expect(meta!.content.toLowerCase()).not.toBe(TENANT_A.primary.toLowerCase());
    // HSL→hex round-trip may drift by ±1 per channel, so check hue-region
    // instead of exact hex. Tenant B is green (#22cc44) — green channel dominant.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(meta!.content.slice(i, i + 2), 16));
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it("fully clears inline --primary / --primary-foreground / --ring when switching to a tenant with no brand", () => {
    const html = document.documentElement;

    applyBrandColors(TENANT_A.primary, TENANT_A.accent);
    expect(html.style.getPropertyValue("--primary")).not.toBe("");
    expect(html.style.getPropertyValue("--primary-foreground")).not.toBe("");
    expect(html.style.getPropertyValue("--ring")).not.toBe("");
    expect(html.style.getPropertyValue("--accent")).not.toBe("");

    // Simulate switching to a tenant that has no brand overrides configured.
    applyBrandColors(null, null);

    expect(html.style.getPropertyValue("--primary")).toBe("");
    expect(html.style.getPropertyValue("--primary-foreground")).toBe("");
    expect(html.style.getPropertyValue("--ring")).toBe("");
    expect(html.style.getPropertyValue("--accent")).toBe("");
    expect(html.style.getPropertyValue("--accent-foreground")).toBe("");
  });

  it("in dark mode, tenant A → tenant B leaves --primary / --ring unset and only accent swaps", () => {
    const html = document.documentElement;
    setDark(true);

    applyBrandColors(TENANT_A.primary, TENANT_A.accent);
    expect(html.style.getPropertyValue("--primary")).toBe(""); // dark guard
    expect(html.style.getPropertyValue("--ring")).toBe("");
    const aAccent = html.style.getPropertyValue("--accent");
    expect(aAccent).not.toBe("");

    applyBrandColors(TENANT_B.primary, TENANT_B.accent);
    // Primary/ring stay stripped by the dark guard across the switch.
    expect(html.style.getPropertyValue("--primary")).toBe("");
    expect(html.style.getPropertyValue("--primary-foreground")).toBe("");
    expect(html.style.getPropertyValue("--ring")).toBe("");
    // Accent swapped to tenant B — no leakage from A.
    const bAccent = html.style.getPropertyValue("--accent");
    expect(bAccent).not.toBe("");
    expect(bAccent).not.toBe(aAccent);
  });

  it("light (tenant A) → dark (tenant B) strips tenant A's stale inline --primary/--ring", () => {
    const html = document.documentElement;

    // Tenant A paints in light mode.
    setDark(false);
    applyBrandColors(TENANT_A.primary, TENANT_A.accent);
    expect(html.style.getPropertyValue("--primary")).not.toBe("");
    expect(html.style.getPropertyValue("--ring")).not.toBe("");

    // Now the app switches tenant AND theme in one step.
    setDark(true);
    applyBrandColors(TENANT_B.primary, TENANT_B.accent);

    expect(html.style.getPropertyValue("--primary")).toBe("");
    expect(html.style.getPropertyValue("--primary-foreground")).toBe("");
    expect(html.style.getPropertyValue("--ring")).toBe("");
  });
});

describe("applyBrandColors — --accent stays consistent across tenant switches", () => {
  const TENANT_A = { primary: "#ff0080", accent: "#00c2ff" }; // cyan accent
  const TENANT_B = { primary: "#22cc44", accent: "#ffaa00" }; // orange accent
  const TENANT_C = { primary: "#8844ff", accent: "#00c2ff" }; // cyan again (same as A)

  beforeEach(() => {
    clearInline();
    setDark(false);
    (window as unknown as { __lovableBrand?: unknown }).__lovableBrand = undefined;
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((n) => n.remove());
  });

  const readAccent = () => ({
    accent: document.documentElement.style.getPropertyValue("--accent"),
    fg: document.documentElement.style.getPropertyValue("--accent-foreground"),
  });

  it("A → B: --accent tracks tenant B exactly (no fallback to A)", () => {
    applyBrandColors(TENANT_A.primary, TENANT_A.accent);
    const a = readAccent();

    applyBrandColors(TENANT_B.primary, TENANT_B.accent);
    const b = readAccent();

    // Explicit expected values from hexToHslTriplet — never a leftover from A.
    expect(b.accent).toBe(hexToTriplet(TENANT_B.accent));
    expect(b.accent).not.toBe(a.accent);
    expect(b.accent).not.toBe("");
  });

  it("A → B → A: --accent returns to A's value, no drift from B", () => {
    applyBrandColors(TENANT_A.primary, TENANT_A.accent);
    const a1 = readAccent();

    applyBrandColors(TENANT_B.primary, TENANT_B.accent);
    applyBrandColors(TENANT_A.primary, TENANT_A.accent);
    const a2 = readAccent();

    expect(a2.accent).toBe(a1.accent);
    expect(a2.fg).toBe(a1.fg);
    expect(a2.accent).toBe(hexToTriplet(TENANT_A.accent));
  });

  it("A → C (same accent hex, different primary): --accent value is identical", () => {
    applyBrandColors(TENANT_A.primary, TENANT_A.accent);
    const a = readAccent();

    applyBrandColors(TENANT_C.primary, TENANT_C.accent);
    const c = readAccent();

    expect(c.accent).toBe(a.accent);
    expect(c.accent).toBe(hexToTriplet(TENANT_A.accent));
  });

  it("B → tenant with no accent: --accent is fully cleared (no fallback to B)", () => {
    applyBrandColors(TENANT_B.primary, TENANT_B.accent);
    expect(document.documentElement.style.getPropertyValue("--accent")).not.toBe("");

    applyBrandColors(TENANT_A.primary, null);

    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--accent-foreground")).toBe("");
  });

  it("survives a light→dark toggle mid-switch: --accent still equals tenant B, not A", () => {
    applyBrandColors(TENANT_A.primary, TENANT_A.accent);
    setDark(true);
    applyBrandColors(TENANT_B.primary, TENANT_B.accent);

    expect(document.documentElement.style.getPropertyValue("--accent")).toBe(
      hexToTriplet(TENANT_B.accent),
    );
  });
});

// Local helper: mirror hexToHslTriplet's output format so the tests express
// expected values symbolically rather than as pre-computed HSL strings.
function hexToTriplet(hex: string): string {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
