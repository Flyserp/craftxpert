#!/usr/bin/env node
/**
 * Bundle-size budget guard (multi-target).
 *
 * Verifies one or more named build targets against their own baseline in
 * `bundle-size.baselines.json`. Targets are defined in `bundle-size.targets.json`
 * (dist directory, tolerance, optional build command + env).
 *
 * Also scans the source tree for accent-toggle remnants (one global pass,
 * regardless of which target is checked).
 *
 * Usage:
 *   node scripts/check-bundle-size.mjs                       # check all targets
 *   node scripts/check-bundle-size.mjs --target=production   # one target
 *   node scripts/check-bundle-size.mjs --target=development --update
 *
 * Override tolerance for a single run with BUNDLE_SIZE_TOLERANCE.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TARGETS_PATH = join(ROOT, "bundle-size.targets.json");
const BASELINES_PATH = join(ROOT, "bundle-size.baselines.json");
const SCAN_CONFIG_PATH = join(ROOT, "bundle-size.scan.config.json");
const TOLERANCE_OVERRIDE = process.env.BUNDLE_SIZE_TOLERANCE
  ? Number(process.env.BUNDLE_SIZE_TOLERANCE)
  : null;

const args = process.argv.slice(2);
const UPDATE = args.includes("--update");
const targetArg = args.find((a) => a.startsWith("--target="));
const REQUESTED_TARGET = targetArg ? targetArg.split("=")[1] : null;

// ── Forbidden patterns (accent-toggle remnants) ───────────────────────────────
const FORBIDDEN_PATTERNS = [
  { pattern: /\bAccentToggle\b/, label: "AccentToggle component" },
  { pattern: /\buseNewAccent\b/, label: "useNewAccent hook" },
  { pattern: /\bACCENT_HEX\b/, label: "ACCENT_HEX constant" },
  { pattern: /accent-toggle/i, label: "accent-toggle string" },
  { pattern: /#9ebe46/i, label: "hardcoded #9ebe46 hex (use brand-accent token)" },
];

function loadScanConfig() {
  if (!existsSync(SCAN_CONFIG_PATH)) return { ignoreFiles: [], ignoreLinePatterns: [] };
  try {
    const raw = JSON.parse(readFileSync(SCAN_CONFIG_PATH, "utf8"));
    return {
      ignoreFiles: Array.isArray(raw.ignoreFiles) ? raw.ignoreFiles : [],
      ignoreLinePatterns: Array.isArray(raw.ignoreLinePatterns) ? raw.ignoreLinePatterns : [],
    };
  } catch (err) {
    console.error(`✗ Could not parse ${SCAN_CONFIG_PATH}: ${err.message}`);
    process.exit(2);
  }
}

function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "::DOUBLESTAR::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DOUBLESTAR::/g, ".*");
  return new RegExp(`^${escaped}$`);
}

const SCAN_CONFIG = loadScanConfig();
const IGNORE_FILE_REGEXPS = SCAN_CONFIG.ignoreFiles.map(globToRegExp);
const IGNORE_LINE_REGEXPS = SCAN_CONFIG.ignoreLinePatterns.map(
  (p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
);

// ── File walking & measurement ────────────────────────────────────────────────
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function bytesFor(distDir, predicate) {
  const files = walk(distDir).filter(predicate);
  let raw = 0;
  let gz = 0;
  for (const f of files) {
    const buf = readFileSync(f);
    raw += buf.length;
    gz += gzipSync(buf).length;
  }
  return { raw, gz, count: files.length };
}

function measure(distDir) {
  const js = bytesFor(distDir, (f) => f.endsWith(".js"));
  const css = bytesFor(distDir, (f) => f.endsWith(".css"));
  return {
    js: { raw: js.raw, gz: js.gz },
    css: { raw: css.raw, gz: css.gz },
    total: { raw: js.raw + css.raw, gz: js.gz + css.gz },
  };
}

function fmt(n) {
  if (n >= 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${n} B`;
}

// ── Forbidden-pattern scan (global, runs once) ────────────────────────────────
function scanForbidden() {
  const SOURCE_DIRS = ["src", "supabase/functions"]
    .map((d) => join(ROOT, d))
    .filter((d) => existsSync(d));
  const hits = [];
  const skipExts = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".woff", ".woff2", ".ttf"]);
  for (const dir of SOURCE_DIRS) {
    for (const file of walk(dir)) {
      if (skipExts.has(file.slice(file.lastIndexOf(".")))) continue;
      const rel = file.replace(`${ROOT}/`, "");
      if (IGNORE_FILE_REGEXPS.some((re) => re.test(rel))) continue;
      let content;
      try {
        content = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
        if (IGNORE_LINE_REGEXPS.some((re) => re.test(line))) continue;
        for (const { pattern, label } of FORBIDDEN_PATTERNS) {
          if (pattern.test(line)) hits.push({ file: rel, label, line: i + 1 });
        }
      }
    }
  }
  return hits;
}

// ── Targets + baselines ───────────────────────────────────────────────────────
function loadJSON(path, label) {
  if (!existsSync(path)) {
    console.error(`✗ Missing ${label} at ${path}`);
    process.exit(2);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`✗ Could not parse ${label} at ${path}: ${err.message}`);
    process.exit(2);
  }
}

const targetsConfig = loadJSON(TARGETS_PATH, "targets config");
const baselines = loadJSON(BASELINES_PATH, "baselines file");

const allTargetNames = Object.keys(targetsConfig.targets || {});
if (allTargetNames.length === 0) {
  console.error("✗ No targets defined in bundle-size.targets.json");
  process.exit(2);
}

const targetsToCheck = REQUESTED_TARGET ? [REQUESTED_TARGET] : allTargetNames;
for (const name of targetsToCheck) {
  if (!targetsConfig.targets[name]) {
    console.error(`✗ Unknown target "${name}". Known targets: ${allTargetNames.join(", ")}`);
    process.exit(2);
  }
}

// ── Per-target verification ───────────────────────────────────────────────────
function verifyTarget(name) {
  const cfg = targetsConfig.targets[name];
  const distDir = join(ROOT, cfg.dist);

  console.log(`\n━━━ Target: ${name} (${cfg.dist}) ━━━`);

  if (!existsSync(distDir)) {
    console.error(`✗ ${distDir} not found. Run \`${cfg.build}\` first.`);
    return { name, ok: false, missing: true };
  }

  const current = measure(distDir);

  if (UPDATE) {
    const tolerance = TOLERANCE_OVERRIDE ?? cfg.tolerance ?? 0.03;
    baselines[name] = { tolerance, sizes: current };
    console.log(`✓ Baseline for "${name}" staged (will be written after all updates).`);
    console.log(JSON.stringify(current, null, 2));
    return { name, ok: true, updated: true };
  }

  const baseline = baselines[name];
  if (!baseline || !baseline.sizes) {
    console.error(
      `✗ No baseline for "${name}" in ${BASELINES_PATH}. ` +
        `Run \`node scripts/check-bundle-size.mjs --target=${name} --update\` to create it.`,
    );
    return { name, ok: false, missingBaseline: true };
  }

  const tolerance = TOLERANCE_OVERRIDE ?? baseline.tolerance ?? cfg.tolerance ?? 0.03;
  const failures = [];
  const rows = [];

  for (const bucket of ["js", "css", "total"]) {
    for (const kind of ["raw", "gz"]) {
      const before = baseline.sizes[bucket][kind];
      const after = current[bucket][kind];
      const delta = after - before;
      const pct = before === 0 ? 0 : delta / before;
      const limit = Math.ceil(before * (1 + tolerance));
      const overBudget = after > limit;
      rows.push({
        metric: `${bucket}.${kind}`,
        before: fmt(before),
        after: fmt(after),
        delta: `${delta >= 0 ? "+" : ""}${fmt(delta)} (${(pct * 100).toFixed(2)}%)`,
        status: overBudget ? "FAIL" : "ok",
      });
      if (overBudget) {
        failures.push(
          `[${name}] ${bucket}.${kind}: ${fmt(after)} exceeds budget ${fmt(limit)} ` +
            `(baseline ${fmt(before)} +${(tolerance * 100).toFixed(0)}% tolerance)`,
        );
      }
    }
  }

  console.table(rows);
  console.log(`Tolerance: ±${(tolerance * 100).toFixed(0)}%`);
  return { name, ok: failures.length === 0, failures };
}

// ── Main ──────────────────────────────────────────────────────────────────────
const results = targetsToCheck.map(verifyTarget);

if (UPDATE) {
  writeFileSync(BASELINES_PATH, `${JSON.stringify(baselines, null, 2)}\n`);
  console.log(`\n✓ Baselines written → ${BASELINES_PATH}`);
  process.exit(0);
}

const forbidden = scanForbidden();
if (forbidden.length) {
  console.log("\n✗ Forbidden accent-toggle remnants detected:");
  for (const { file, label, line } of forbidden) console.log(`  - ${file}:${line} → ${label}`);
}

const allFailures = results.flatMap((r) => r.failures || []);
const anyMissing = results.some((r) => r.missing || r.missingBaseline);

if (allFailures.length || forbidden.length || anyMissing) {
  if (allFailures.length) {
    console.log("\n✗ Bundle-size budget exceeded:");
    for (const f of allFailures) console.log(`  - ${f}`);
    console.log(
      "\nIf this growth is intentional, run `node scripts/check-bundle-size.mjs --target=<name> --update` and commit the new baseline.",
    );
  }
  process.exit(1);
}

console.log(
  `\n✓ All ${results.length} target(s) within budget and no accent-toggle remnants found.`,
);
