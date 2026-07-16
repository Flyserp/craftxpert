import { test, expect } from "@playwright/test";

/**
 * Asserts that Inter is the resolved primary font on key public pages.
 *
 * Guards against regressions where Inter fails to load (network/CSP) or where
 * a stylesheet reorders the font stack so Geist or a system font wins.
 */

const PAGES = ["/", "/login", "/signup"] as const;

// Parse the first quoted or bare family from a computed font-family string.
function firstFamily(fontFamily: string): string {
  const first = fontFamily.split(",")[0]?.trim() ?? "";
  return first.replace(/^["']|["']$/g, "");
}

for (const path of PAGES) {
  test(`typography uses Inter on ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });

    // Wait for the Inter web font to actually be available before measuring.
    const interAvailable = await page.evaluate(async () => {
      await document.fonts.ready;
      await document.fonts.load("16px Inter");
      return document.fonts.check("16px Inter");
    });
    expect(interAvailable, "Inter web font must be loaded").toBe(true);

    // Body computed font stack must start with Inter (Geist is fallback only).
    const bodyFont = await page.evaluate(
      () => getComputedStyle(document.body).fontFamily,
    );
    expect(firstFamily(bodyFont).toLowerCase()).toBe("inter");
    expect(bodyFont.toLowerCase()).toContain("geist");
    expect(bodyFont.toLowerCase().indexOf("inter")).toBeLessThan(
      bodyFont.toLowerCase().indexOf("geist"),
    );

    // A visible heading and paragraph must also resolve to Inter first.
    const sampleFonts = await page.evaluate(() => {
      const pick = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).fontFamily : null;
      };
      return {
        h1: pick("h1"),
        p: pick("p"),
      };
    });

    for (const [tag, family] of Object.entries(sampleFonts)) {
      if (!family) continue; // page may not render this tag
      expect(
        firstFamily(family).toLowerCase(),
        `${tag} on ${path} should render with Inter (got: ${family})`,
      ).toBe("inter");
    }
  });
}