#!/usr/bin/env python3
"""
Dark-mode regression test.

Boots headless Chromium against a running dev/preview server, visits key
routes and asserts theme tokens are correct in BOTH modes and remain
correct after toggling dark ↔ light ↔ dark.

Per route we assert:
  * `<html>` .dark class matches the active theme
  * no inline `--primary` override is written on `<html>` in dark mode
    (tenant branding must skip primary in dark — see usePwaBranding.ts)
  * computed tokens match the expected set for the active mode:
      --primary, --primary-foreground, --ring,
      --background, --foreground, --card, --card-foreground,
      --muted-foreground, --secondary, --secondary-foreground,
      --destructive, --destructive-foreground
  * --destructive stays red-ish (badges / unread pills)

Also opens the reschedule modal on /my-bookings and audits it in dark mode.

Usage:
    BASE_URL=http://localhost:8080 python3 scripts/dark-mode-regression.py

Requires Python `playwright` with Chromium available.
Exits 0 on pass, 1 on failure, 2 on setup error.
"""
import asyncio
import os
import re
import sys

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8080")

# --- Expected token values (must match src/index.css) -----------------------
DARK_TOKENS: dict[str, str] = {
    "--primary": "75 70% 40%",
    "--primary-foreground": "186 100% 9%",
    "--ring": "75 70% 40%",  # --ring is defined as var(--primary)
    "--background": "150 12% 8%",
    "--foreground": "46 8% 90%",
    "--card": "150 10% 11%",
    "--card-foreground": "46 8% 90%",
    "--secondary": "150 10% 16%",
    "--secondary-foreground": "46 8% 92%",
    "--muted-foreground": "120 6% 70%",
    "--destructive": "0 75% 62%",
    "--destructive-foreground": "0 0% 100%",
    # NOTE: --accent / --accent-foreground are intentionally omitted — tenants
    # override them via brand_accent, so they're not regression-testable against
    # the CSS defaults.
}
LIGHT_TOKENS: dict[str, str] = {
    "--primary": "187 100% 9%",
    "--primary-foreground": "0 0% 100%",
    "--ring": "187 100% 9%",
    "--background": "0 0% 96%",
    "--foreground": "0 0% 9%",
    "--card": "0 0% 100%",
    "--card-foreground": "0 0% 9%",
    "--secondary": "0 0% 96%",
    "--secondary-foreground": "0 0% 9%",
    "--muted-foreground": "0 0% 38%",
    "--destructive": "355 85% 40%",
    "--destructive-foreground": "0 0% 100%",
}

ROUTES = [
    ("landing", "/"),
    ("browse", "/browse-services"),
    ("booking-flow", "/book"),
    ("client-dashboard", "/client-dashboard"),
    ("my-bookings", "/my-bookings"),
    ("provider-dashboard", "/provider-dashboard"),
    ("provider-bookings", "/provider-bookings"),
    ("admin-dashboard", "/admin"),
    ("notifications", "/notifications"),
    ("chat", "/chat"),
]

_HSL = re.compile(r"^\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%\s*$")

failures: list[str] = []


def _pass(label: str, msg: str) -> None:
    print(f"  \u2713 [{label}] {msg}")


def _fail(label: str, msg: str) -> None:
    failures.append(f"[{label}] {msg}")
    print(f"  \u2717 [{label}] {msg}")


def _is_red(hsl: str) -> bool:
    m = _HSL.match(hsl)
    if not m:
        return False
    h = float(m.group(1))
    return (0 <= h <= 20) or (h >= 340)


async def read_tokens(page, extra_props: list[str]) -> dict:
    return await page.evaluate(
        """(props) => {
          const html = document.documentElement;
          const cs = getComputedStyle(html);
          const out = {
            darkClass: html.classList.contains('dark'),
            inlinePrimary: html.style.getPropertyValue('--primary'),
            inlineRing: html.style.getPropertyValue('--ring'),
            tokens: {},
            themeColorMeta: (document.head.querySelector('meta[name="theme-color"]') || {}).content || '',
          };
          for (const p of props) out.tokens[p] = cs.getPropertyValue(p).trim();
          return out;
        }""",
        extra_props,
    )


def hsl_triplet_to_hex(triplet: str) -> str | None:
    m = _HSL.match(triplet)
    if not m:
        return None
    h = float(m.group(1)) / 360
    s = float(m.group(2)) / 100
    l = float(m.group(3)) / 100

    def hue2rgb(p: float, q: float, t: float) -> float:
        if t < 0:
            t += 1
        if t > 1:
            t -= 1
        if t < 1 / 6:
            return p + (q - p) * 6 * t
        if t < 1 / 2:
            return q
        if t < 2 / 3:
            return p + (q - p) * (2 / 3 - t) * 6
        return p

    if s == 0:
        r = g = b = l
    else:
        q = l * (1 + s) if l < 0.5 else l + s - l * s
        p = 2 * l - q
        r = hue2rgb(p, q, h + 1 / 3)
        g = hue2rgb(p, q, h)
        b = hue2rgb(p, q, h - 1 / 3)
    return "#{:02x}{:02x}{:02x}".format(round(r * 255), round(g * 255), round(b * 255))


async def set_theme(page, mode: str) -> None:
    """Set theme via localStorage and reload so ThemeContext + branding
    initialise from scratch with the guard active. This mirrors what
    the real theme toggle does (ThemeContext calls reapplyBrandColors)."""
    await page.evaluate(
        """(mode) => {
          try { localStorage.setItem('theme', mode); } catch (e) {}
        }""",
        mode,
    )
    await page.reload(wait_until="domcontentloaded")
    await page.wait_for_timeout(1200)


async def audit(page, route: str, mode: str) -> None:
    expected = DARK_TOKENS if mode == "dark" else LIGHT_TOKENS
    label = f"{route}:{mode}"
    info = await read_tokens(page, list(expected.keys()))

    # 1. .dark class matches mode
    expected_dark = mode == "dark"
    if info["darkClass"] is not expected_dark:
        _fail(label, f"html.dark = {info['darkClass']}, expected {expected_dark}")
    else:
        _pass(label, f"html.dark = {expected_dark}")

    # 2. In dark mode, no inline --primary / --ring override may be present.
    if mode == "dark":
        if info["inlinePrimary"].strip():
            _fail(label, f"inline --primary override present: '{info['inlinePrimary']}'")
        else:
            _pass(label, "no inline --primary override")
        if info["inlineRing"].strip():
            _fail(label, f"inline --ring override present: '{info['inlineRing']}'")

    # 3. Each expected token matches.
    for prop, want in expected.items():
        got = info["tokens"].get(prop, "")
        if got != want:
            _fail(label, f"{prop} = '{got}', expected '{want}'")
        # (skip individual pass logs to keep output readable)

    # 4. --destructive is red-ish (semantic sanity, independent of exact hue).
    dest = info["tokens"].get("--destructive", "")
    if not _is_red(dest):
        _fail(label, f"--destructive '{dest}' is not red-ish")

    # 5. <meta name="theme-color"> follows the resolved --primary in both modes
    #    (see syncThemeColorMeta in src/hooks/usePwaBranding.ts).
    resolved_primary = info["tokens"].get("--primary", "")
    expected_hex = hsl_triplet_to_hex(resolved_primary)
    meta = (info.get("themeColorMeta") or "").strip().lower()
    if not meta:
        _fail(label, "meta[name=theme-color] is missing")
    elif expected_hex and meta != expected_hex:
        _fail(
            label,
            f"meta theme-color '{meta}' does not match resolved --primary "
            f"'{resolved_primary}' (expected '{expected_hex}')",
        )
    else:
        _pass(label, f"meta theme-color = {meta} matches --primary")

    # Compact summary line when everything passed for this pane.
    if not any(f.startswith(f"[{label}]") for f in failures[-len(expected) - 6 :]):
        _pass(label, f"{len(expected)} tokens match expected {mode} set")


async def main() -> int:
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print(
            "playwright not installed. Run: pip install playwright && playwright install chromium",
            file=sys.stderr,
        )
        return 2

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            color_scheme="dark",
        )
        await context.add_init_script(
            "try { if (!localStorage.getItem('theme')) localStorage.setItem('theme', 'dark'); } catch (e) {}"
        )
        page = await context.new_page()

        for name, path in ROUTES:
            print(f"\n\u2192 {name}  {path}")
            try:
                await page.goto(
                    f"{BASE_URL}{path}", wait_until="domcontentloaded", timeout=20_000
                )
                await page.wait_for_timeout(1200)  # branding + ThemeContext settle

                # 1) dark (initial)
                await audit(page, name, "dark")
                # 2) toggle to light
                await set_theme(page, "light")
                await audit(page, name, "light")
                # 3) toggle back to dark — verify tokens fully restore
                await set_theme(page, "dark")
                await audit(page, name, "dark")
            except Exception as e:  # noqa: BLE001
                _fail(name, f"navigation error: {e}")

        # Modal audit: reschedule dialog on /my-bookings (dark only)
        print("\n\u2192 modal:reschedule-dialog")
        try:
            await page.goto(
                f"{BASE_URL}/my-bookings", wait_until="domcontentloaded", timeout=20_000
            )
            await set_theme(page, "dark")
            await page.wait_for_timeout(1200)
            btn = page.get_by_role("button", name=re.compile("reschedule", re.I)).first
            if await btn.count():
                try:
                    await btn.click(timeout=5_000)
                    await page.wait_for_timeout(600)
                    await audit(page, "reschedule-modal", "dark")
                except Exception as e:  # noqa: BLE001
                    print(f"  \u00b7 could not open reschedule modal: {e}")
            else:
                print("  \u00b7 no reschedule button visible (skipped modal audit)")
        except Exception as e:  # noqa: BLE001
            print(f"  \u00b7 modal audit skipped: {e}")

        await browser.close()

    print("\n" + "\u2500" * 40)
    if failures:
        print(f"FAIL \u2014 {len(failures)} issue(s):")
        for f in failures:
            print(" - " + f)
        return 1
    print("PASS \u2014 dark & light theme tokens consistent across all audited routes and toggles.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
