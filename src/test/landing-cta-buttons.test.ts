import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Visual-regression guard for landing-page CTA buttons.
 *
 * All primary CTA buttons on the landing page must keep the standardized
 * `h-12` and `px-4` sizing so the layout stays uniform. If you intentionally
 * change a button's size, update this test to match.
 */
const FILES = [
  "src/components/landing/TopProvidersSection.tsx",
  "src/components/landing/ServiceCategoriesSection.tsx",
  "src/components/landing/FeaturedServicesSection.tsx",
  "src/components/landing/CTASection.tsx",
  "src/components/landing/PostServiceBanner.tsx",
  "src/components/landing/ContactSection.tsx",
];

describe("landing CTA button sizing", () => {
  for (const file of FILES) {
    it(`${file} keeps h-12 and px-4 on every <Button>`, () => {
      const src = readFileSync(resolve(process.cwd(), file), "utf8");
      const buttons = src.match(/<Button\b[\s\S]*?>/g) ?? [];
      expect(buttons.length).toBeGreaterThan(0);
      for (const btn of buttons) {
        expect(btn, `Missing h-12 in ${file}:\n${btn}`).toMatch(/\bh-12\b/);
        expect(btn, `Missing px-4 in ${file}:\n${btn}`).toMatch(/\bpx-4\b/);
      }
    });
  }
});