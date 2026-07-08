import { test, expect, type Page } from "../playwright-fixture";
import {
  ROLE_TONES,
  ROLE_BADGE_BASE,
  ADMIN_PANEL_BUTTON_CLASSES,
} from "../src/lib/roleTokens";

/**
 * Visual + contrast regression for the Admin badge and Admin Panel button in
 * dark mode.
 *
 * Strategy
 * --------
 * We mount a self-contained harness inside the running app's `<body>` so we
 * inherit the *real* `index.css` HSL token system (including the `.dark`
 * overrides) without coupling to auth, routing, or seed data. We then:
 *   1. Pixel-snapshot each surface (Playwright's toHaveScreenshot baseline).
 *   2. Compute WCAG 2.1 contrast ratio between the rendered foreground and
 *      background, asserting AA (>= 4.5:1 for the badge text and button label).
 *
 * If the dark-mode tokens regress (e.g. someone removes `dark:border-background`
 * or the HSL primary flip drifts), one of the two assertions will fail.
 */

// ---------- Color math (sRGB → relative luminance → contrast) ----------

function parseRgb(input: string): [number, number, number] {
  // Accepts "rgb(r, g, b)" or "rgba(r, g, b, a)".
  const m = input.match(/rgba?\(([^)]+)\)/i);
  if (!m) throw new Error(`Cannot parse color: ${input}`);
  const parts = m[1].split(",").map((p) => parseFloat(p.trim()));
  return [parts[0], parts[1], parts[2]];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

function contrastRatio(fg: string, bg: string): number {
  const L1 = relativeLuminance(parseRgb(fg));
  const L2 = relativeLuminance(parseRgb(bg));
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

// ---------- Harness ----------

async function mountDarkHarness(page: Page) {
  // Boot the SPA so `index.css` (with all `.dark` HSL overrides) is loaded.
  await page.goto("/");
  // Wait for stylesheet evaluation by checking that a token resolves to HSL.
  await page.waitForFunction(() => {
    const probe = getComputedStyle(document.documentElement)
      .getPropertyValue("--background")
      .trim();
    return probe.length > 0;
  });

  // Force dark mode + replace the page body with our isolated harness so we
  // don't fight the live header layout.
  await page.evaluate(
    ({ tones, base, btn }) => {
      document.documentElement.classList.add("dark");
      document.body.innerHTML = `
        <main style="min-height:100vh;display:flex;flex-direction:column;align-items:flex-start;gap:24px;padding:48px;background:hsl(var(--background));color:hsl(var(--foreground));font-family:system-ui,sans-serif">
          <span data-testid="admin-badge" class="${base} ${tones.Admin}">Admin</span>
          <button data-testid="admin-panel-btn" class="inline-flex items-center justify-center rounded-md px-3 ${btn}">
            <span>Admin Panel</span>
          </button>
        </main>
      `;
    },
    {
      tones: ROLE_TONES,
      base: ROLE_BADGE_BASE,
      btn: ADMIN_PANEL_BUTTON_CLASSES,
    },
  );

  // Allow Tailwind JIT in dev to register any newly-seen utilities.
  await page.waitForTimeout(150);
}

// ---------- Tests ----------

test.describe("Role surfaces — dark mode visual regression", () => {
  test("Admin badge: snapshot + AA contrast", async ({ page }) => {
    await mountDarkHarness(page);
    const badge = page.getByTestId("admin-badge");
    await expect(badge).toBeVisible();

    // Pixel snapshot (baseline auto-created on first run).
    await expect(badge).toHaveScreenshot("admin-badge-dark.png", {
      maxDiffPixelRatio: 0.02,
    });

    // Computed-style contrast assertion.
    const { fg, bg } = await badge.evaluate((el) => {
      const cs = getComputedStyle(el as HTMLElement);
      return { fg: cs.color, bg: cs.backgroundColor };
    });
    const ratio = contrastRatio(fg, bg);
    expect(
      ratio,
      `Admin badge contrast ${ratio.toFixed(2)}:1 (fg=${fg} bg=${bg}) must meet WCAG AA (>= 4.5)`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  test("Admin Panel button: snapshot + AA contrast (idle & hover)", async ({ page }) => {
    await mountDarkHarness(page);
    const btn = page.getByTestId("admin-panel-btn");
    await expect(btn).toBeVisible();

    // Idle snapshot.
    await expect(btn).toHaveScreenshot("admin-panel-btn-dark.png", {
      maxDiffPixelRatio: 0.02,
    });

    // Idle contrast.
    const idle = await btn.evaluate((el) => {
      const cs = getComputedStyle(el as HTMLElement);
      return { fg: cs.color, bg: cs.backgroundColor };
    });
    const idleRatio = contrastRatio(idle.fg, idle.bg);
    expect(
      idleRatio,
      `Admin Panel button idle contrast ${idleRatio.toFixed(2)}:1 must meet WCAG AA (>= 4.5)`,
    ).toBeGreaterThanOrEqual(4.5);

    // Hover snapshot + contrast (dark:hover:bg-primary/85 must stay legible).
    await btn.hover();
    await page.waitForTimeout(100);
    await expect(btn).toHaveScreenshot("admin-panel-btn-dark-hover.png", {
      maxDiffPixelRatio: 0.02,
    });
    const hover = await btn.evaluate((el) => {
      const cs = getComputedStyle(el as HTMLElement);
      return { fg: cs.color, bg: cs.backgroundColor };
    });
    const hoverRatio = contrastRatio(hover.fg, hover.bg);
    expect(
      hoverRatio,
      `Admin Panel button hover contrast ${hoverRatio.toFixed(2)}:1 must meet WCAG AA (>= 4.5)`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  test("Separation tokens are present on rendered DOM", async ({ page }) => {
    // Catches regressions where someone removes `dark:border-background` etc.
    await mountDarkHarness(page);

    const badgeClasses = await page.getByTestId("admin-badge").getAttribute("class");
    expect(badgeClasses).toContain("dark:border-background");
    expect(badgeClasses).toContain("dark:ring-1");
    expect(badgeClasses).toContain("dark:ring-primary/40");

    const btnClasses = await page.getByTestId("admin-panel-btn").getAttribute("class");
    expect(btnClasses).toContain("dark:border-background");
    expect(btnClasses).toContain("dark:ring-1");
    expect(btnClasses).toContain("dark:ring-primary/50");
    expect(btnClasses).toContain("dark:hover:bg-primary/85");
  });
});
