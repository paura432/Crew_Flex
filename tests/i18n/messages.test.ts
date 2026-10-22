import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { LOCALES } from "@/i18n/config";

const root = join(import.meta.dirname, "..", "..");

type Tree = { [key: string]: string | Tree };
function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === "string") acc[prefix + key] = value;
    else Object.assign(acc, flatten(value, `${prefix}${key}.`));
    return acc;
  }, {});
}
const placeholders = (text: string) =>
  [...text.matchAll(/\{\s*([a-zA-Z0-9_]+)/g)].map((m) => m[1]).sort();
const tags = (text: string) => [...text.matchAll(/<([a-z]+)>/g)].map((m) => m[1]).sort();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const flatEn = flatten(en as Tree);
const flatEs = flatten(es as Tree);

describe("i18n catalogs (es/en)", () => {
  it("cover exactly the same keys", () => {
    expect(LOCALES).toEqual(["es", "en"]);
    expect(Object.keys(flatEs).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it("have no empty strings", () => {
    for (const [key, value] of [...Object.entries(flatEn), ...Object.entries(flatEs)]) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("use the same interpolation placeholders and rich tags in both languages", () => {
    for (const [key, value] of Object.entries(flatEn)) {
      expect(placeholders(flatEs[key]!), key).toEqual(placeholders(value));
      expect(tags(flatEs[key]!), key).toEqual(tags(value));
    }
  });

  it("every validation key (`v.*`) used in schemas and functions exists in both catalogs", () => {
    const used = new Set<string>();
    for (const file of [
      ...sourceFiles(join(root, "src", "lib", "validation")),
      ...sourceFiles(join(root, "supabase", "functions")),
    ]) {
      for (const m of readFileSync(file, "utf8").matchAll(/"(v\.[a-zA-Z0-9_.]+)"/g))
        used.add(m[1]!);
    }
    expect(used.size).toBeGreaterThan(30);
    for (const key of used) {
      expect(flatEn[key], key).toBeDefined();
      expect(flatEs[key], key).toBeDefined();
    }
  });

  it("every structured matching explanation key exists", () => {
    const explain = readFileSync(join(root, "src", "features", "matching", "explain.ts"), "utf8");
    const keys = [...explain.matchAll(/key: "([a-zA-Z.]+)"/g)].map((m) => `matching.${m[1]}`);
    expect(keys.length).toBeGreaterThan(10);
    for (const key of keys) expect(flatEn[key], key).toBeDefined();
  });

  it("every domain enum value has a label in both catalogs", () => {
    const expected = {
      "domain.shift": ["day", "night", "split", "flexible"],
      "domain.urgency": ["planned", "urgent", "aog"],
      "domain.requirementStatus": ["draft", "open", "paused", "covered", "cancelled", "closed"],
      "domain.verification": ["pending", "verified", "rejected", "expired"],
      "domain.held": ["active", "withdrawn"],
      "domain.mobility": ["local", "national", "international"],
      "domain.technicianStatus": ["employed", "contractor", "between_contracts"],
      "domain.category": ["LICENSE", "TYPE_RATING", "TRAINING", "APPROVAL", "SKILL"],
      "domain.role": ["member", "manager", "admin"],
      api: [
        "UNAUTHORIZED",
        "FORBIDDEN",
        "VALIDATION_ERROR",
        "NOT_FOUND",
        "METHOD_NOT_ALLOWED",
        "CONFLICT",
        "PAYLOAD_TOO_LARGE",
        "NETWORK_ERROR",
        "INTERNAL_ERROR",
      ],
    };
    for (const [prefix, values] of Object.entries(expected)) {
      for (const value of values) {
        const key = prefix === "api" ? `${prefix}.${value}.title` : `${prefix}.${value}`;
        expect(flatEn[key], key).toBeDefined();
        expect(flatEs[key], key).toBeDefined();
      }
    }
    for (const v of ["private", "anonymous", "open"]) {
      expect(flatEs[`domain.visibility.${v}.label`]).toBeDefined();
    }
  });

  it("keeps aviation vocabulary untranslated in Spanish (glossary)", () => {
    // Codes and acronyms are never localized: they must not appear translated in es.json.
    for (const term of [
      "AOG",
      "MRO",
      "Type rating",
      "EWIS",
      "HF",
      "FTS",
      "SMS",
      "Part-66",
      "B1.1",
    ]) {
      const enUses = Object.values(flatEn).filter((v) => v.includes(term)).length;
      const esUses = Object.values(flatEs).filter((v) => v.includes(term)).length;
      expect(esUses, term).toBeGreaterThanOrEqual(Math.min(enUses, 1));
    }
  });
});
