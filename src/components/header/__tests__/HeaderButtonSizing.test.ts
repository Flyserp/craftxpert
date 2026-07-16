/**
 * Regression guard: the main header's right-side controls must all render at
 * h-10 (40px) so the theme toggle, notification bell and profile menu trigger
 * stay visually aligned. Historically these drifted to h-8 / h-9 which broke
 * the row alignment — this test greps the source for the offending sizes.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("Header button sizing — h-10 contract", () => {
  it("HeaderIconButton renders at h-10 w-10", () => {
    const src = read("src/components/header/HeaderIconButton.tsx");
    expect(src).toMatch(/h-10\s+w-10/);
    expect(src).not.toMatch(/\bh-9\s+w-9\b/);
    expect(src).not.toMatch(/\bh-8\s+w-8\b/);
  });

  it("ProfileMenu trigger uses h-10", () => {
    const src = read("src/components/header/ProfileMenu.tsx");
    expect(src).toMatch(/rounded-full[^"'`]*\bh-10\b/);
    expect(src).not.toMatch(/rounded-full[^"'`]*\bh-9\b/);
    expect(src).not.toMatch(/rounded-full[^"'`]*\bh-8\b/);
  });

  it("UnifiedHeader ThemeToggle uses h-10 w-10", () => {
    const src = read("src/components/header/UnifiedHeader.tsx");
    expect(src).toMatch(/<ThemeToggle[^/]*className="h-10 w-10"/);
    expect(src).not.toMatch(/<ThemeToggle[^/]*className="h-(?:8|9) w-(?:8|9)"/);
  });
});
