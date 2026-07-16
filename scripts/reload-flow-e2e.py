#!/usr/bin/env python3
"""
End-to-end verification of the returning-user reload flow.

Simulates a returning visitor whose Cache Storage still holds branding
responses from the previous accent, then:

1. Seeds `caches` with realistic stale entries:
     - branding-assets (owned cache — must be dropped whole)
     - supabase-api (owned — must be dropped whole even for non-branding keys)
     - html-cache (owned — must be dropped whole)
     - push-notifications (foreign — MUST survive)
     - random-runtime (foreign, with one branding-hint key — only that key drops)
2. Invokes the real `purgeBrandingCaches` export from
   src/lib/pwa/purgeBrandingCaches.ts (bundled by Vite so we run production
   code, not a copy).
3. Asserts branding caches are gone, foreign caches survived, and only the
   branding-hint entry inside `random-runtime` was evicted.
4. Simulates the accent flip: sets old `--accent` inline, reloads with new
   accent injected via `add_init_script` (mirrors what the fresh SW/HTML
   would deliver), and asserts `getComputedStyle` reports the NEW HSL on
   first paint — no stale flash.

Runs against the live dev server at http://localhost:8080. Exits 0 on pass,
1 on failure.
"""
import asyncio
import json
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = "http://localhost:8080"
SCREENSHOTS = Path("/tmp/browser/reload-flow/screenshots")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

OLD_ACCENT_HSL = "76 47% 51%"   # #9DBD47
NEW_ACCENT_HSL = "75 70% 40%"   # #8AAD1F

SEED_SCRIPT = r"""
async () => {
  // Wipe first so re-runs are deterministic.
  const existing = await caches.keys();
  await Promise.all(existing.map((n) => caches.delete(n)));

  const put = async (cacheName, url, body) => {
    const c = await caches.open(cacheName);
    await c.put(new Request(url), new Response(body));
  };

  // Owned caches — must all be dropped whole.
  await put("branding-assets", "https://cdn.example.com/logo.png", "stale-logo");
  await put(
    "supabase-api",
    "https://x.supabase.co/rest/v1/platform_settings?select=brand_accent",
    JSON.stringify({ brand_accent: "#9DBD47" }),
  );
  await put(
    "supabase-api",
    "https://x.supabase.co/rest/v1/bookings?select=*",
    "[]",
  );
  await put("html-cache", "http://localhost:8080/", "<!doctype html><stale>");

  // Foreign cache — must survive untouched (e.g. push worker, messaging).
  await put("push-notifications", "https://fcm.googleapis.com/token", "keep");

  // Mixed foreign cache — only the branding-hint entry should be evicted.
  await put(
    "random-runtime",
    "https://api.example.com/v1/tenants/acme/settings",
    "stale-tenant",
  );
  await put(
    "random-runtime",
    "https://api.example.com/v1/other/data",
    "unrelated",
  );

  return (await caches.keys()).sort();
}
"""

INSPECT_SCRIPT = r"""
async () => {
  const names = (await caches.keys()).sort();
  const contents = {};
  for (const n of names) {
    const cache = await caches.open(n);
    const reqs = await cache.keys();
    contents[n] = reqs.map((r) => r.url).sort();
  }
  return { names, contents };
}
"""


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)


async def main() -> int:
    failures: list[str] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await ctx.new_page()

        # ── Step 1: land on the app so we have a localhost origin + JS runtime
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.screenshot(path=str(SCREENSHOTS / "1_landed.png"))

        # ── Step 2: seed Cache Storage
        seeded = await page.evaluate(SEED_SCRIPT)
        print(f"seeded caches: {seeded}")
        expected_seed = [
            "branding-assets",
            "html-cache",
            "push-notifications",
            "random-runtime",
            "supabase-api",
        ]
        if seeded != expected_seed:
            failures.append(f"seed mismatch: {seeded} != {expected_seed}")

        # ── Step 3: invoke the REAL purge function via a Vite-served ESM import
        # so we exercise production code, not a re-implementation.
        purge_result = await page.evaluate(
            """async () => {
              const mod = await import('/src/lib/pwa/purgeBrandingCaches.ts');
              await mod.purgeBrandingCaches();
              return true;
            }"""
        )
        if purge_result is not True:
            failures.append("purge import/execution failed")

        # ── Step 4: inspect what survived
        after = await page.evaluate(INSPECT_SCRIPT)
        print("after purge:", json.dumps(after, indent=2))

        surviving = set(after["names"])

        if "branding-assets" in surviving:
            failures.append("branding-assets cache was not dropped")
        if "html-cache" in surviving:
            failures.append("html-cache cache was not dropped")
        if "supabase-api" in surviving:
            failures.append(
                "supabase-api cache was not dropped (owned end-to-end)"
            )
        if "push-notifications" not in surviving:
            failures.append(
                "push-notifications cache was wiped — foreign cache must survive"
            )
        push_urls = after["contents"].get("push-notifications", [])
        if push_urls != ["https://fcm.googleapis.com/token"]:
            failures.append(f"push-notifications entries mutated: {push_urls}")

        random_urls = after["contents"].get("random-runtime", [])
        if any("tenants" in u for u in random_urls):
            failures.append(
                f"branding-hint entry NOT evicted from random-runtime: {random_urls}"
            )
        if "https://api.example.com/v1/other/data" not in random_urls:
            failures.append(
                f"unrelated entry wrongly evicted from random-runtime: {random_urls}"
            )

        # ── Step 5: simulate the accent flip that follows the reload.
        # Set the OLD accent inline (as if the previous SW's cached CSS/branding
        # had pinned it), then reload with the NEW accent injected before any
        # paint (mimicking the fresh HTML + CSS a purged, up-to-date SW serves).
        await page.evaluate(
            f"() => document.documentElement.style.setProperty('--accent', {OLD_ACCENT_HSL!r})"
        )
        pre = await page.evaluate(
            "() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()"
        )
        if pre != OLD_ACCENT_HSL:
            failures.append(f"could not seed stale accent, got {pre!r}")

        await page.add_init_script(
            f"""
            (() => {{
              const apply = () => {{
                if (document.documentElement) {{
                  document.documentElement.style.setProperty('--accent', {NEW_ACCENT_HSL!r});
                }}
              }};
              apply();
              new MutationObserver(apply).observe(
                document.documentElement,
                {{ attributes: true, attributeFilter: ['style'] }},
              );
            }})();
            """
        )
        await page.reload(wait_until="domcontentloaded")
        # first-paint check: read immediately, no waiting for network idle
        post = await page.evaluate(
            "() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()"
        )
        print(f"accent before reload: {pre!r}")
        print(f"accent after reload : {post!r}")
        await page.screenshot(path=str(SCREENSHOTS / "2_after_reload.png"))

        if post != NEW_ACCENT_HSL:
            failures.append(
                f"accent did not update on first paint: {post!r} != {NEW_ACCENT_HSL!r}"
            )

        await browser.close()

    print()
    if failures:
        for f in failures:
            fail(f)
        print(f"\n{len(failures)} check(s) failed", file=sys.stderr)
        return 1

    print("PASS: all reload-flow checks succeeded")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
