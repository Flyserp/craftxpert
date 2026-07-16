import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateBrandToken } from "./validateBrandToken";

describe("validateBrandToken", () => {
  const originalMode = import.meta.env.MODE;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Force "development" so the console.warn branch executes.
    // (In vitest, MODE defaults to "test" and warnings are suppressed.)
    (import.meta.env as Record<string, string>).MODE = "development";
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    document.documentElement.style.setProperty("--accent", "75 70% 40%");
    document.documentElement.style.setProperty("--primary", "187 100% 9%");
  });

  afterEach(() => {
    (import.meta.env as Record<string, string>).MODE = originalMode;
    warnSpy.mockRestore();
    document.documentElement.removeAttribute("style");
  });

  it("reports ok=true when hex converts to the currently-applied triplet", () => {
    const r = validateBrandToken("accent", "#8AAD1F");
    expect(r.ok).toBe(true);
    expect(r.invalid).toBe(false);
    expect(r.expectedTriplet).toBe("75 70% 40%");
    expect(r.currentTriplet).toBe("75 70% 40%");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("accepts short-form hex", () => {
    // #8a1 → #88aa11 ≈ 70 82% 37% (rough); we're only checking the parse path.
    const r = validateBrandToken("accent", "#8a1");
    expect(r.expectedTriplet).not.toBeNull();
  });

  it("returns ok=true when hex is null (no override configured)", () => {
    const r = validateBrandToken("accent", null);
    expect(r.ok).toBe(true);
    expect(r.invalid).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("flags drift when DB hex resolves to a different triplet than the CSS token", () => {
    // Old accent color, before the migration to #8AAD1F.
    const r = validateBrandToken("accent", "#e1ff51");
    expect(r.ok).toBe(false);
    expect(r.invalid).toBe(false);
    expect(r.expectedTriplet).toBe("70 100% 66%");
    expect(r.currentTriplet).toBe("75 70% 40%");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/drift detected/);
    expect(warnSpy.mock.calls[0][0]).toMatch(/--accent/);
  });

  it("flags invalid hex", () => {
    const r = validateBrandToken("accent", "not-a-hex");
    expect(r.invalid).toBe(true);
    expect(r.ok).toBe(false);
    expect(r.expectedTriplet).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/not a valid hex/);
  });

  it("tolerates whitespace differences in the CSS token value", () => {
    document.documentElement.style.setProperty("--accent", "  75   70%   40%  ");
    const r = validateBrandToken("accent", "#8AAD1F");
    expect(r.ok).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
