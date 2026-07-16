import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, extname } from "path";

const SRC = join(__dirname, "..");
const EXTS = new Set([".ts", ".tsx"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "test" || name === "__tests__" || name === "node_modules") continue;
      walk(full, out);
    } else if (EXTS.has(extname(name))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Catches <Button ... className="... text-accent ..."> and the variant
 * definitions in button.tsx. Filled button variants must use
 * text-primary-foreground so contrast stays AA-compliant.
 */
describe("button text color regression", () => {
  const files = walk(SRC);
  const offenders: string[] = [];

  for (const file of files) {
    const src = readFileSync(file, "utf8");

    // 1) <Button ...> and raw <button ...> tags whose className contains text-accent.
    //    Covers Button rendered via `asChild` that emits a native <button>, as well as
    //    plain <button> elements styled with the same token.
    const buttonTagRe = /<(Button|button)\b[^>]*className=(?:"([^"]*)"|{`([^`]*)`}|{"([^"]*)"})/g;
    let m: RegExpExecArray | null;
    while ((m = buttonTagRe.exec(src))) {
      const tag = m[1];
      const cls = m[2] ?? m[3] ?? m[4] ?? "";
      if (/\btext-accent\b/.test(cls)) offenders.push(`${file}: <${tag}> uses text-accent`);
    }

    // 2) buttonVariants definitions (filled variants only)
    if (file.endsWith("/ui/button.tsx")) {
      const variantRe = /(default|hero)\s*:\s*"([^"]*)"/g;
      let v: RegExpExecArray | null;
      while ((v = variantRe.exec(src))) {
        if (/\btext-accent\b/.test(v[2])) offenders.push(`${file}: variant ${v[1]} uses text-accent`);
      }
    }
  }

  it("no button uses text-accent for its label color", () => {
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});