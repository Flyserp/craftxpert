import { describe, it, expect, beforeEach } from "vitest";
import {
  hexToHslTriplet,
  pickReadableForeground,
  applyBrandColors,
} from "@/hooks/usePwaBranding";

/** Parse "H S% L%" → [h, s, l]. */
function parseTriplet(t: string): [number, number, number] {
  const m = t.match(/^(\d+)\s+(\d+)%\s+(\d+)%$/);
  if (!m) throw new Error(`Bad triplet: ${t}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function relLum(hex: string): number {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const toLin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLin(parseInt(full.slice(0, 2), 16));
  const g = toLin(parseInt(full.slice(2, 4), 16));
  const b = toLin(parseInt(full.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hslTripletLuminance(t: string): number {
  // Convert HSL triplet → hex → luminance via a tiny helper.
  const [h, s, l] = parseTriplet(t).map((n, i) => (i === 0 ? n : n / 100)) as [number, number, number];
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const mm = l - c / 2;
  const to255 = (n: number) => Math.round((n + mm) * 255);
  const toHex = (n: number) => to255(n).toString(16).padStart(2, "0");
  return relLum(`#${toHex(r1)}${toHex(g1)}${toHex(b1)}`);
}

function contrast(a: number, b: number) {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

describe("hexToHslTriplet", () => {
  it("converts canonical brand colors", () => {
    expect(hexToHslTriplet("#00292E")).toBe("187 100% 9%");
    expect(hexToHslTriplet("#8AAD1F")).toBe("75 70% 40%");
  });

  it("handles shorthand #RGB", () => {
    // #f00 == #ff0000 == pure red
    expect(hexToHslTriplet("#f00")).toBe("0 100% 50%");
  });

  it("handles pure black / white / grey (no hue)", () => {
    expect(hexToHslTriplet("#000000")).toBe("0 0% 0%");
    expect(hexToHslTriplet("#ffffff")).toBe("0 0% 100%");
    expect(hexToHslTriplet("#808080")).toBe("0 0% 50%");
  });

  it("is case-insensitive and tolerates whitespace", () => {
    expect(hexToHslTriplet("  #FF0000 ")).toBe(hexToHslTriplet("#ff0000"));
  });

  it("rejects malformed input", () => {
    expect(hexToHslTriplet("red")).toBeNull();
    expect(hexToHslTriplet("#12")).toBeNull();
    expect(hexToHslTriplet("#zzzzzz")).toBeNull();
    expect(hexToHslTriplet("#12345")).toBeNull();
  });
});

describe("pickReadableForeground", () => {
  const cases: Array<[string, "light" | "dark"]> = [
    ["#000000", "light"],   // black bg → white fg
    ["#ffffff", "dark"],    // white bg → dark fg
    ["#00292E", "light"],   // brand primary deep teal
    ["#8AAD1F", "dark"],    // brand accent lime
    ["#ffff00", "dark"],    // pure yellow
    ["#0000ff", "light"],   // pure blue
    ["#808080", "dark"],    // mid grey resolves to dark for slightly better contrast
  ];

  it.each(cases)("picks readable fg for %s", (hex, expected) => {
    const fg = pickReadableForeground(hex);
    const expectedTriplet = expected === "light" ? "0 0% 100%" : "0 0% 9%";
    expect(fg).toBe(expectedTriplet);
  });

  it("always picks the option with the higher contrast ratio against the brand color", () => {
    const samples = [
      "#00292E", "#8AAD1F", "#ffffff", "#000000",
      "#ff0000", "#00ff00", "#0000ff", "#ffff00",
      "#123456", "#abcdef", "#7f7f7f",
    ];
    // The function returns near-black ("0 0% 9%"), not pure black, so compare
    // against the contrast each *actually returnable* option achieves.
    const whiteLum = hslTripletLuminance("0 0% 100%");
    const nearBlackLum = hslTripletLuminance("0 0% 9%");
    for (const hex of samples) {
      const fgLum = hslTripletLuminance(pickReadableForeground(hex));
      const bgLum = relLum(hex);
      const picked = contrast(fgLum, bgLum);
      const best = Math.max(contrast(whiteLum, bgLum), contrast(nearBlackLum, bgLum));
      // Tolerance for tiny rounding differences from hex round-tripping.
      expect(picked).toBeGreaterThanOrEqual(best - 0.01);
      // And in practice, the chosen pair must clear AA large-text (3:1).
      expect(picked).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("applyBrandColors", () => {
  beforeEach(() => {
    document.documentElement.style.cssText = "";
  });

  it("writes --primary, --primary-foreground, and --ring when given a primary hex", () => {
    applyBrandColors("#00292E", null);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--primary")).toBe("187 100% 9%");
    expect(root.style.getPropertyValue("--primary-foreground")).toBe("0 0% 100%");
    expect(root.style.getPropertyValue("--ring")).toBe("187 100% 9%");
  });

  it("writes --accent and --accent-foreground but NOT --ring for accent", () => {
    applyBrandColors(null, "#8AAD1F");
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--accent")).toBe("75 70% 40%");
    expect(root.style.getPropertyValue("--accent-foreground")).toBe("0 0% 9%");
    expect(root.style.getPropertyValue("--ring")).toBe("");
  });

  it("clears overrides when passed null", () => {
    applyBrandColors("#00292E", "#8AAD1F");
    applyBrandColors(null, null);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--primary")).toBe("");
    expect(root.style.getPropertyValue("--primary-foreground")).toBe("");
    expect(root.style.getPropertyValue("--ring")).toBe("");
    expect(root.style.getPropertyValue("--accent")).toBe("");
    expect(root.style.getPropertyValue("--accent-foreground")).toBe("");
  });

  it("ignores invalid hex without throwing or mutating tokens", () => {
    expect(() => applyBrandColors("not-a-color", "#zzz")).not.toThrow();
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("");
  });
});