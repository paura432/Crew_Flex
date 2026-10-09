import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..", "..");

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

function isIgnored(path: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "-q", path], { cwd: root });
    return true;
  } catch {
    return false;
  }
}

describe("F. frontend contains no privileged credentials", () => {
  it("src/ never references service role or secret keys", () => {
    // src/lib/env.ts may name the `sb_secret_` prefix only to REJECT such keys.
    const offenders = filesUnder(join(root, "src")).filter((file) => {
      const text = readFileSync(file, "utf8");
      if (/service_role|SERVICE_ROLE/.test(text)) return true;
      return file.endsWith(join("src", "lib", "env.ts")) ? false : /sb_secret_/.test(text);
    });
    expect(offenders).toEqual([]);
  });

  it("no tracked file defines a NEXT_PUBLIC_ service role variable", () => {
    const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
      .split("\n")
      // Markdown may name the forbidden variable to prohibit it; code and config may not.
      .filter((file) => file && !file.startsWith("tests/security/") && !file.endsWith(".md"));
    const offenders = tracked.filter((file) => {
      try {
        return /NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE/.test(readFileSync(join(root, file), "utf8"));
      } catch {
        return false;
      }
    });
    expect(offenders).toEqual([]);
  });
});

describe("G. environment files", () => {
  it(".env.local and other env files are ignored; .env.example is tracked", () => {
    expect(isIgnored(".env.local")).toBe(true);
    expect(isIgnored(".env")).toBe(true);
    expect(isIgnored(".env.production.local")).toBe(true);
    expect(isIgnored(".env.example")).toBe(false);
  });

  it(".env.example contains variable names only, no values", () => {
    const lines = readFileSync(join(root, ".env.example"), "utf8")
      .split("\n")
      .filter((line) => line && !line.startsWith("#"));
    for (const line of lines) expect(line).toMatch(/^[A-Z_]+=$/);
  });
});
