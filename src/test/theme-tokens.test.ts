/**
 * Theme token contract — regression guard.
 *
 * Rating stars, badges and cards rely on a small set of semantic HSL tokens
 * defined in `src/index.css`. If any of these disappear or drift back to a
 * hard-coded palette, the whole dark-mode experience regresses silently.
 *
 * This test asserts:
 *  1. Every required token is defined in BOTH `:root` and `.dark` blocks.
 *  2. `--accent` is locked to the shared lime value the design system agreed on.
 *  3. StarRating never falls back to hard-coded amber/yellow fills.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

// Extract the raw contents of the `:root { ... }` block (first occurrence).
function block(selector: string): string {
  // Anchor to `<selector> {` at start of a line to avoid matching nested rules.
  const re = new RegExp(`(?:^|\\n)\\s*${selector}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, "m");
  const m = css.match(re);
  if (!m) throw new Error(`Selector block not found in index.css: ${selector}`);
  return m[1];
}

const rootVars = block(":root");
const darkVars = block("\\.dark");

const REQUIRED_TOKENS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--border",
  "--ring",
] as const;

describe("Theme tokens — light + dark parity", () => {
  for (const token of REQUIRED_TOKENS) {
    it(`defines ${token} in :root`, () => {
      expect(rootVars).toMatch(new RegExp(`${token}\\s*:`));
    });
    it(`defines ${token} in .dark`, () => {
      expect(darkVars).toMatch(new RegExp(`${token}\\s*:`));
    });
  }

  it("locks --accent to the shared lime value in both themes (75 70% 40%)", () => {
    expect(rootVars).toMatch(/--accent:\s*75\s+70%\s+40%/);
    expect(darkVars).toMatch(/--accent:\s*75\s+70%\s+40%/);
  });
});

describe("StarRating — uses semantic primary token only", () => {
  const star = readFileSync(
    resolve(process.cwd(), "src/components/ui/StarRating.tsx"),
    "utf8",
  );

  it("does not fall back to hard-coded amber/yellow colors", () => {
    expect(star).not.toMatch(/fill-(amber|yellow)-\d+/);
    expect(star).not.toMatch(/text-(amber|yellow)-\d+/);
  });

  it("filled stars use fill-primary + text-primary", () => {
    expect(star).toMatch(/fill-primary\s+text-primary/);
  });

  it("empty stars use a contrast-safe outline (not the faint --border token)", () => {
    // Empty stars must NOT collapse back to `text-border` (fails WCAG 1.4.11).
    expect(star).not.toMatch(/["'`\s]text-border["'`\s]/);
    expect(star).toMatch(/text-muted-foreground\/\d+/);
    expect(star).toMatch(/strokeWidth=\{[\d.]+\}/);
  });
});
