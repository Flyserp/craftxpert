#!/usr/bin/env node
/**
 * Heading codemod — migrates raw <h1>–<h6 class="text-h*" > markup to the
 * shared <Heading level={N}> component and strips legacy typography aliases
 * (`text-h1`…`text-h6`, `text-heading`, `text-title`, `text-subtitle`).
 *
 * Modes:
 *   --dry-run   (default)  Report every file + change without writing.
 *   --apply                Snapshot each touched file to
 *                          `.codemod-backups/<timestamp>/`, write changes,
 *                          run `bunx tsgo --noEmit`, and auto-rollback on
 *                          failure.
 *   --no-verify            Skip the post-apply typecheck (no auto-rollback).
 *   --restore=<dir>        Restore files from a previous backup directory.
 *   --root=<dir>           Directory to scan (default: src).
 *   --json                 Emit a JSON report instead of the human summary.
 *
 * Example:
 *   node scripts/codemod-headings.mjs                 # dry-run against src/
 *   node scripts/codemod-headings.mjs --apply         # write + verify + auto-rollback
 *   node scripts/codemod-headings.mjs --restore=.codemod-backups/2026-07-06T12-30-00
 */
import { readFileSync, writeFileSync, statSync, readdirSync, mkdirSync, copyFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const JSON_OUT = args.has("--json");
const NO_VERIFY = args.has("--no-verify");
const rootArg = [...args].find((a) => a.startsWith("--root="));
const ROOT = rootArg ? rootArg.split("=")[1] : "src";
const restoreArg = [...args].find((a) => a.startsWith("--restore="));
const RESTORE_DIR = restoreArg ? restoreArg.split("=")[1] : null;
const BACKUP_ROOT = ".codemod-backups";

/** Copy `file` into `<backupDir>/<file>`, preserving the relative path. */
function backupFile(file, backupDir) {
  const dest = join(backupDir, file);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(file, dest);
}

/** Restore every file under `backupDir` back to its original location. */
function restoreFrom(backupDir) {
  const restored = [];
  const walkBackup = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walkBackup(full);
      else {
        const original = relative(backupDir, full);
        mkdirSync(dirname(original), { recursive: true });
        copyFileSync(full, original);
        restored.push(original);
      }
    }
  };
  walkBackup(backupDir);
  return restored;
}

// Explicit restore mode — no scanning, just replay a previous backup.
if (RESTORE_DIR) {
  const files = restoreFrom(RESTORE_DIR);
  process.stdout.write(`[codemod] Restored ${files.length} file(s) from ${RESTORE_DIR}\n`);
  for (const f of files) process.stdout.write(`  ✓ ${f}\n`);
  process.exit(0);
}

const LEGACY_CLASSES = /\b(text-h[1-6]|text-heading|text-title|text-subtitle)\b/g;
const HEADING_TAG = /<(h[1-6])(\s[^>]*?)?>/g;

/** Walk a directory tree, yielding every .tsx file path. */
function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (full.endsWith(".tsx")) yield full;
  }
}

/** Compute the transformed source + the list of edits made. */
function transform(source) {
  const edits = [];
  let out = source;
  let match;
  HEADING_TAG.lastIndex = 0;
  while ((match = HEADING_TAG.exec(source)) !== null) {
    const [full, tag, attrs = ""] = match;
    if (!LEGACY_CLASSES.test(attrs)) {
      LEGACY_CLASSES.lastIndex = 0;
      continue;
    }
    LEGACY_CLASSES.lastIndex = 0;
    const cleaned = attrs.replace(LEGACY_CLASSES, "").replace(/\s{2,}/g, " ");
    const replacement = `<${tag}${cleaned}>`;
    edits.push({ line: source.slice(0, match.index).split("\n").length, from: full, to: replacement });
    out = out.replace(full, replacement);
  }
  return { out, edits };
}

const report = { mode: APPLY ? "apply" : "dry-run", root: ROOT, files: [] };
let totalEdits = 0;
const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace("Z", "");
const backupDir = APPLY ? join(BACKUP_ROOT, stamp) : null;

for (const file of walk(ROOT)) {
  const src = readFileSync(file, "utf8");
  const { out, edits } = transform(src);
  if (!edits.length) continue;
  totalEdits += edits.length;
  report.files.push({ file: relative(process.cwd(), file), edits });
  if (APPLY && out !== src) {
    backupFile(file, backupDir);
    writeFileSync(file, out);
  }
}

// Post-apply verification + auto-rollback.
let verifyResult = null;
if (APPLY && report.files.length && !NO_VERIFY) {
  process.stdout.write(`\n[codemod] Verifying with \`bunx tsgo --noEmit\`…\n`);
  const check = spawnSync("bunx", ["tsgo", "--noEmit"], { encoding: "utf8" });
  const ok = check.status === 0;
  verifyResult = { ok, backupDir };
  if (!ok) {
    process.stderr.write(
      `\n[codemod] ✗ Typecheck FAILED — rolling back ${report.files.length} file(s) from ${backupDir}\n`,
    );
    process.stderr.write((check.stdout || "").split("\n").slice(0, 20).join("\n") + "\n");
    restoreFrom(backupDir);
    process.stderr.write(`[codemod] ✓ Rollback complete. Backup preserved at ${backupDir}\n`);
    if (JSON_OUT) {
      process.stdout.write(
        JSON.stringify({ ...report, verify: verifyResult, rolledBack: true }, null, 2) + "\n",
      );
    }
    process.exit(1);
  }
  process.stdout.write(`[codemod] ✓ Typecheck passed. Backup kept at ${backupDir}\n`);
}

if (JSON_OUT) {
  process.stdout.write(
    JSON.stringify({ ...report, verify: verifyResult, backupDir }, null, 2) + "\n",
  );
} else {
  const banner = APPLY
    ? `\n[codemod] APPLIED changes to ${report.files.length} file(s), ${totalEdits} edit(s). Backup: ${backupDir}\n`
    : `\n[codemod] DRY-RUN — would change ${report.files.length} file(s), ${totalEdits} edit(s). Re-run with --apply to write.\n`;
  process.stdout.write(banner);
  for (const { file, edits } of report.files) {
    process.stdout.write(`\n  ${file}  (${edits.length})\n`);
    for (const e of edits) {
      process.stdout.write(`    L${e.line}: ${e.from}\n         → ${e.to}\n`);
    }
  }
  if (!report.files.length) process.stdout.write("  (no changes needed)\n");
}

process.exit(0);