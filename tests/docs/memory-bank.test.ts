import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

// Light integrity checks for the agent context layer (memory-bank/, AGENTS.md, .claude/agents/).
// They keep the memory bank pointing at things that exist; they do not judge its content.

const root = join(import.meta.dirname, "..", "..");
const bank = join(root, "memory-bank");

const REQUIRED = [
  "README.md",
  "00-project-context.md",
  "01-current-state.md",
  "02-architecture-map.md",
  "03-domain-map.md",
  "04-security-invariants.md",
  "05-agent-workflows.md",
  "06-active-context.md",
  "07-decisions-index.md",
  "08-validation-gates.md",
];

const STATUSES = new Set([
  "VERIFIED_PRODUCTION",
  "VERIFIED_LOCAL",
  "IMPLEMENTED_UNVERIFIED",
  "PARTIAL",
  "PLANNED",
  "BLOCKED",
  "OUT_OF_SCOPE",
  "NEEDS_DECISION",
]);
// Vocabulary of the V1.3 parity matrix, quoted by the completeness audit.
const MATRIX_STATUSES = new Set(["IMPLEMENTED_AND_VERIFIED", "BLOCKED_BY_DECISION"]);

const bankFiles = readdirSync(bank)
  .filter((f) => f.endsWith(".md"))
  .map((f) => join(bank, f));
const agentFiles = readdirSync(join(root, ".claude", "agents"))
  .filter((f) => f.endsWith(".md"))
  .map((f) => join(root, ".claude", "agents", f));
const contextFiles = [...bankFiles, ...agentFiles, join(root, "AGENTS.md")];
const read = (file: string) => readFileSync(file, "utf8");
const rel = (file: string) => file.slice(root.length + 1);

/** Repo paths quoted in backticks, e.g. `src/domain/matching.ts` or `docs/qa/QUALITY_GATES.md` §5. */
function quotedPaths(text: string): string[] {
  const paths = [
    ...text.matchAll(
      /`((?:docs|src|supabase|tests|scripts|memory-bank|messages|\.claude)\/[^`\s]*)`/g,
    ),
  ]
    .map((m) => m[1]!.replace(/:\d+(-\d+)?$/, ""))
    // Templates and globs (`<name>`, `*`, `…`, `{a,b}`) describe a family, not a file.
    .filter((p) => !/[<>*…{}]/.test(p));
  return [...new Set(paths)];
}

describe("memory bank", () => {
  it("has every required file, none empty", () => {
    for (const name of REQUIRED) {
      const file = join(bank, name);
      expect(existsSync(file), name).toBe(true);
      expect(read(file).trim().length, name).toBeGreaterThan(200);
    }
  });

  it("relative Markdown links resolve", () => {
    const broken: string[] = [];
    for (const file of contextFiles) {
      for (const [, target] of read(file).matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
        if (/^[a-z]+:/i.test(target!)) continue; // http(s), mailto
        if (!existsSync(join(dirname(file), target!))) broken.push(`${rel(file)} → ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("quoted repository paths exist", () => {
    const missing: string[] = [];
    for (const file of contextFiles) {
      for (const path of quotedPaths(read(file))) {
        if (!existsSync(join(root, path))) missing.push(`${rel(file)} → ${path}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("uses only the agreed status vocabulary", () => {
    const files = [...bankFiles, join(root, "docs", "audit", "CREWFLEX_COMPLETENESS_AUDIT.md")];
    const unknown: string[] = [];
    for (const file of files) {
      for (const [token] of read(file).matchAll(
        /\b(?:VERIFIED|IMPLEMENTED|NEEDS|OUT_OF|BLOCKED_BY)_[A-Z_]+\b/g,
      )) {
        if (!STATUSES.has(token) && !MATRIX_STATUSES.has(token))
          unknown.push(`${rel(file)}: ${token}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it("every decision id it cites exists in a canonical decision document", () => {
    const canonical = [
      "docs/product/OPEN_DECISIONS.md",
      "docs/integration/crewflex-v13/08-product-decisions.md",
      "docs/integration/crewflex-v13/03-business-rule-conflicts.md",
    ]
      .map((p) => read(join(root, p)))
      .join("\n");
    const adrs = readdirSync(join(root, "docs", "architecture")).join(" ");
    const unknown: string[] = [];
    for (const file of bankFiles) {
      for (const [id] of read(file).matchAll(
        /\b(?:OD-\d+|R-D\d+|D-\d{2}|C-\d+|T-\d{2}|R-\d{2}|ADR-\d{3})\b/g,
      )) {
        const known = id.startsWith("ADR-")
          ? adrs.includes(id)
          : new RegExp(`\\b${id}\\b`).test(canonical);
        if (!known) unknown.push(`${rel(file)}: ${id}`);
      }
    }
    expect([...new Set(unknown)]).toEqual([]);
  });

  it("states are dated: current state and active context carry a date and a commit", () => {
    for (const name of ["01-current-state.md", "06-active-context.md"]) {
      const text = read(join(bank, name));
      expect(text, name).toMatch(/\b20\d{2}-\d{2}-\d{2}\b/);
      expect(text, name).toMatch(/`[0-9a-f]{7,40}`/);
    }
  });

  it("contains no secret-looking values", () => {
    const patterns = [
      /sb_secret_[A-Za-z0-9_-]{8,}/,
      /sb_publishable_[A-Za-z0-9_-]{8,}/,
      /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, // JWT
      /postgres(?:ql)?:\/\/[^:\s]+:(?!<|\*|postgres@)[^@\s]+@/, // URL with a real password
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    ];
    const hits = contextFiles.filter((file) => patterns.some((p) => p.test(read(file))));
    expect(hits.map(rel)).toEqual([]);
  });
});

describe("project subagents", () => {
  it("each brief has a name matching its file and a description", () => {
    for (const file of agentFiles) {
      const front = /^---\n([\s\S]*?)\n---\n/.exec(read(file))?.[1] ?? "";
      const name = /^name:\s*(\S+)$/m.exec(front)?.[1];
      expect(name, rel(file)).toBe(file.split("/").pop()!.replace(/\.md$/, ""));
      expect(/^description:\s*\S.{40,}$/m.test(front), rel(file)).toBe(true);
    }
  });

  it("reviewer roles are read-only", () => {
    for (const name of ["security-reviewer", "product-guardian"]) {
      const text = read(join(root, ".claude", "agents", `${name}.md`));
      expect(text).toMatch(/^tools: Read, Grep, Glob, Bash$/m);
    }
  });
});
