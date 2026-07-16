#!/usr/bin/env python3
"""
Visual regression check for `brand_accent` changes.

For one tenant, screenshots key pages under an "old" accent, then re-applies a
"new" accent at runtime (mirroring what `applyBrandColors` writes to
`<html>.style`) and screenshots the same pages again. Produces a pixel diff per
route and a summary report.

This does NOT mutate the database — the new accent is injected as inline HSL
tokens on the `<html>` element, exactly the same surface `PwaBrandingApplier`
uses. That keeps the run non-destructive and reproducible.

Usage:
    BASE_URL=http://localhost:8080 \
    TENANT_SLUG=demo \
    OLD_ACCENT=#9DBD47 \
    NEW_ACCENT=#8AAD1F \
    python3 scripts/accent-visual-regression.py

Env:
  BASE_URL      default http://localhost:8080
  TENANT_SLUG   optional — prepended as `/{slug}` to each route
  OLD_ACCENT    hex, default #9DBD47 (previous lime)
  NEW_ACCENT    hex, default #8AAD1F (current lime, matches --accent token)
  OUT_DIR       default /tmp/browser/accent-regression
  DIFF_THRESHOLD  per-pixel channel delta considered "changed" (default 12)
  FAIL_PCT      fail run if any route's changed-pixel % exceeds this (default 15.0)

Exits 0 on pass, 1 if any route exceeds FAIL_PCT, 2 on setup error.
"""
import asyncio
import os
import sys
from pathlib import Path

from PIL import Image, ImageChops

try:
    from playwright.async_api import async_playwright
except Exception as exc:  # pragma: no cover
    print(f"playwright not available: {exc}", file=sys.stderr)
    sys.exit(2)

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8080").rstrip("/")
TENANT_SLUG = os.environ.get("TENANT_SLUG", "").strip().strip("/")
OLD_ACCENT = os.environ.get("OLD_ACCENT", "#9DBD47")
NEW_ACCENT = os.environ.get("NEW_ACCENT", "#8AAD1F")
OUT_DIR = Path(os.environ.get("OUT_DIR", "/tmp/browser/accent-regression"))
DIFF_THRESHOLD = int(os.environ.get("DIFF_THRESHOLD", "12"))
FAIL_PCT = float(os.environ.get("FAIL_PCT", "15.0"))

ROUTES = [
    ("landing", ""),
    ("browse", "/browse-services"),
    ("providers", "/providers"),
    ("login", "/login"),
    ("client-dashboard", "/client-dashboard"),
    ("provider-dashboard", "/provider-dashboard"),
    ("admin", "/admin"),
]


def hex_to_hsl_triplet(hex_str: str) -> str:
    """Mirror of `hexToHslTriplet` in src/hooks/usePwaBranding.ts."""
    h = hex_str.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        raise ValueError(f"invalid hex: {hex_str!r}")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2
    if mx == mn:
        hue = sat = 0.0
    else:
        d = mx - mn
        sat = d / (2 - mx - mn) if l > 0.5 else d / (mx + mn)
        if mx == r:
            hue = ((g - b) / d + (6 if g < b else 0))
        elif mx == g:
            hue = (b - r) / d + 2
        else:
            hue = (r - g) / d + 4
        hue *= 60
    return f"{round(hue)} {round(sat * 100)}% {round(l * 100)}%"


def readable_fg(hsl_triplet: str) -> str:
    """Pick a near-black or near-white foreground for a given HSL triplet."""
    # crude: lightness threshold at 55%
    try:
        lightness = int(hsl_triplet.split()[-1].rstrip("%"))
    except Exception:
        return "0 0% 9%"
    return "0 0% 9%" if lightness > 55 else "0 0% 100%"


async def apply_accent(page, hex_value: str) -> None:
    triplet = hex_to_hsl_triplet(hex_value)
    fg = readable_fg(triplet)
    await page.evaluate(
        """({accent, fg}) => {
            const root = document.documentElement;
            root.style.setProperty('--accent', accent);
            root.style.setProperty('--accent-foreground', fg);
        }""",
        {"accent": triplet, "fg": fg},
    )


async def screenshot_route(page, url: str, out_path: Path) -> None:
    await page.goto(url, wait_until="domcontentloaded")
    # let fonts/images/branding paint
    try:
        await page.wait_for_load_state("networkidle", timeout=4000)
    except Exception:
        pass
    await page.wait_for_timeout(400)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    await page.screenshot(path=str(out_path))


def diff_images(before: Path, after: Path, diff_out: Path) -> tuple[float, tuple[int, int]]:
    a = Image.open(before).convert("RGB")
    b = Image.open(after).convert("RGB")
    if a.size != b.size:
        # normalise
        b = b.resize(a.size)
    d = ImageChops.difference(a, b)
    # per-pixel max channel delta > threshold ⇒ changed
    gray = d.convert("L")
    px = gray.load()
    w, h = gray.size
    changed = 0
    for y in range(h):
        for x in range(w):
            if px[x, y] >= DIFF_THRESHOLD:
                changed += 1
    total = w * h
    pct = changed * 100 / total if total else 0.0
    # write an amplified diff for humans
    amplified = ImageChops.multiply(d, Image.new("RGB", d.size, (6, 6, 6)))
    diff_out.parent.mkdir(parents=True, exist_ok=True)
    amplified.save(diff_out)
    return pct, (w, h)


async def run() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    prefix = f"/{TENANT_SLUG}" if TENANT_SLUG else ""

    # sanity-check hex conversions up front
    try:
        old_triplet = hex_to_hsl_triplet(OLD_ACCENT)
        new_triplet = hex_to_hsl_triplet(NEW_ACCENT)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    print(f"tenant  : {TENANT_SLUG or '(none)'}")
    print(f"old     : {OLD_ACCENT} -> {old_triplet}")
    print(f"new     : {NEW_ACCENT} -> {new_triplet}")
    print(f"out dir : {OUT_DIR}")
    print()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        results: list[tuple[str, float]] = []
        for label, path in ROUTES:
            url = f"{BASE_URL}{prefix}{path}"
            print(f"→ {label:22s} {url}")

            for phase, accent in (("before", OLD_ACCENT), ("after", NEW_ACCENT)):
                ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
                page = await ctx.new_page()
                # inject accent BEFORE any React paint reads the token
                await page.add_init_script(
                    f"""
                    (() => {{
                      const apply = () => {{
                        const root = document.documentElement;
                        if (!root) return;
                        root.style.setProperty('--accent', {hex_to_hsl_triplet(accent)!r});
                        root.style.setProperty('--accent-foreground', {readable_fg(hex_to_hsl_triplet(accent))!r});
                      }};
                      apply();
                      new MutationObserver(apply).observe(document.documentElement, {{ attributes: true, attributeFilter: ['style'] }});
                    }})();
                    """
                )
                out = OUT_DIR / phase / f"{label}.png"
                try:
                    await screenshot_route(page, url, out)
                except Exception as exc:
                    print(f"   ! {phase} failed: {exc}", file=sys.stderr)
                await ctx.close()

            before = OUT_DIR / "before" / f"{label}.png"
            after = OUT_DIR / "after" / f"{label}.png"
            diff = OUT_DIR / "diff" / f"{label}.png"
            if not (before.exists() and after.exists()):
                print(f"   ! missing screenshots, skipping diff")
                continue
            pct, size = diff_images(before, after, diff)
            results.append((label, pct))
            flag = "FAIL" if pct > FAIL_PCT else "ok  "
            print(f"   {flag}  changed {pct:5.2f}%  ({size[0]}x{size[1]})")

        await browser.close()

    print()
    print("=" * 56)
    print(f"{'route':22s}  {'changed %':>10s}  status")
    print("-" * 56)
    failed = 0
    for label, pct in results:
        status = "FAIL" if pct > FAIL_PCT else "ok"
        if status == "FAIL":
            failed += 1
        print(f"{label:22s}  {pct:>9.2f}%  {status}")
    print("=" * 56)
    print(f"threshold: pixels with channel delta ≥ {DIFF_THRESHOLD}, fail if > {FAIL_PCT}%")
    print(f"artifacts: {OUT_DIR}/{{before,after,diff}}/*.png")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
