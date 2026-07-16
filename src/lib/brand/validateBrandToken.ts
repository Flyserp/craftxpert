import { hexToHslTriplet } from "@/hooks/usePwaBranding";

export interface BrandTokenCheck {
  /** The token being validated, e.g. "accent" or "primary". */
  token: string;
  /** Raw hex value read from platform_settings (or null when unset). */
  hex: string | null;
  /** Hex converted to space-separated HSL triplet (`H S% L%`), or null on parse failure. */
  expectedTriplet: string | null;
  /** Current CSS token value read from :root via getComputedStyle. */
  currentTriplet: string;
  /** True when the runtime CSS token matches the DB-derived expectation. */
  ok: boolean;
  /** True when the DB value is missing or malformed. */
  invalid: boolean;
}

/**
 * Verify that a runtime CSS design token (e.g. `--accent`) matches the
 * space-separated HSL triplet derived from a `brand_*` hex stored in
 * `platform_settings`.
 *
 * Returns a structured result and — when the app is running in the
 * browser and the check fails — logs a single grouped warning to the
 * console so drift is visible during development / QA. Silent in test
 * environments (vitest sets `import.meta.vitest`).
 */
export function validateBrandToken(
  token: string,
  hex: string | null,
): BrandTokenCheck {
  const currentTriplet =
    typeof document === "undefined"
      ? ""
      : getComputedStyle(document.documentElement)
          .getPropertyValue(`--${token}`)
          .trim();

  const expectedTriplet = hex ? hexToHslTriplet(hex) : null;
  const invalid = !!hex && expectedTriplet === null;
  const ok =
    !hex ||
    (expectedTriplet !== null && normalize(expectedTriplet) === normalize(currentTriplet));

  const result: BrandTokenCheck = {
    token,
    hex,
    expectedTriplet,
    currentTriplet,
    ok,
    invalid,
  };

  if (typeof window === "undefined") return result;
  if (import.meta.env?.MODE === "test") return result;

  if (invalid) {
    // eslint-disable-next-line no-console
    console.warn(
      `[brand] platform_settings.brand_${token} = "${hex}" is not a valid hex color — CSS token --${token} was not overridden.`,
    );
  } else if (!ok) {
    // eslint-disable-next-line no-console
    console.warn(
      `[brand] --${token} drift detected. platform_settings.brand_${token} = "${hex}" → expected "${expectedTriplet}", got "${currentTriplet}".`,
    );
  }

  return result;
}

/** Normalize triplet whitespace for tolerant comparison (`75  70%  40%` == `75 70% 40%`). */
function normalize(triplet: string): string {
  return triplet.replace(/\s+/g, " ").trim().toLowerCase();
}
