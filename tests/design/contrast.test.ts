import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const css = read("src/app/globals.css");
const token = (name: string) => {
  const hex = new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i").exec(css)?.[1];
  if (!hex) throw new Error(`missing token ${name}`);
  return hex;
};

/** WCAG 2.x contrast ratio between two `#rrggbb` colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("text contrast (WCAG AA, 4.5:1 for body-size text)", () => {
  it("muted text reads on white and canvas", () => {
    expect(contrast(token("--color-muted"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("--color-muted"), token("--color-canvas"))).toBeGreaterThanOrEqual(4.5);
  });

  it("placeholders use muted at full opacity (muted/70 was 2.9:1)", () => {
    expect(read("src/components/ui/Field.tsx")).toMatch(/placeholder:text-muted(?!\/)/);
  });

  it("tools footnotes are ≥ 12 px and ≥ 4.5:1 on white and canvas", () => {
    const footnote = /export function Footnote[\s\S]*?className="([^"]+)"/.exec(
      read("src/features/tools/components/parts.tsx"),
    )?.[1];
    expect(footnote).toContain("text-xs");
    const color = /text-\[(#[0-9a-f]{6})\]/i.exec(footnote ?? "")?.[1] ?? "";
    expect(contrast(color, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color, token("--color-canvas"))).toBeGreaterThanOrEqual(4.5);
  });
});

/** Every `.tsx` file under `dir`. */
const tsxFiles = (dir: string): string[] =>
  readdirSync(join(root, dir)).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(join(root, path)).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });

describe("tools privacy note (X-10)", () => {
  it("reads at ≥ 4.5:1 on canvas (the teal was 3.96:1; v1.8 used #587083)", () => {
    const note = /className="([^"]+)">\{t\("privacyNote"\)\}/.exec(
      read("src/features/tools/components/ToolsHome.tsx"),
    )?.[1];
    const color = /text-\[(#[0-9a-f]{6})\]/i.exec(note ?? "")?.[1] ?? "";
    expect(contrast(color, token("--color-canvas"))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("buttons (X-01)", () => {
  it("white «Iniciar sesión» on the navy landing (was bg-white under text-white, 1:1)", () => {
    expect(contrast("#ffffff", token("--color-navy"))).toBeGreaterThanOrEqual(4.5);
    expect(read("src/app/page.tsx")).toMatch(/href="\/login" variant="inverse"/);
  });

  it("no caller overrides a variant's colour or size through className (stylesheet order wins)", () => {
    const tag = /<(?:Button|ButtonLink|ConfirmButton)\b(?:[^<>]|=>)*?className=\{?["`]([^"`]*)/g;
    const offenders = tsxFiles("src").flatMap((path) =>
      [...read(path).matchAll(tag)]
        .filter((m) => /(?:^|\s)(?:hover:)?(?:bg|text|border|min-h|px|py)-/.test(m[1]!))
        .map((m) => `${path}: ${m[1]}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe("reduced motion", () => {
  it("no animation in src/ runs without `motion-safe:` (prefers-reduced-motion)", () => {
    const offenders = tsxFiles("src").filter((path) =>
      /(?<!motion-safe:)\banimate-(?!none)/.test(read(path)),
    );
    expect(offenders).toEqual([]);
  });
});

describe("type scale", () => {
  it("11 px only in the V1.8 micro-labels DESIGN_SYSTEM lists (X-20)", () => {
    const allowed = [
      "src/app/app/admin/verifications/page.tsx", // table header
      "src/components/layout/AppShell.tsx", // «AVIATION» brand tag
      "src/components/layout/ViewSwitcher.tsx", // sidebar section titles, «Ver como»
      "src/features/availability/components/AvailabilityManager.tsx", // day-cell state label
      "src/features/availability/components/AvailabilityMonth.tsx", // mini calendar weekdays
      "src/features/matching/components/MatchList.tsx", // table header
      "src/features/requirements/components/RequirementsList.tsx", // table header
    ];
    expect(tsxFiles("src").filter((path) => read(path).includes("text-[11px]"))).toEqual(allowed);
  });

  it("tools text is never below 12 px (DESIGN_SYSTEM «never below 12px», NX-05)", () => {
    const dir = "src/features/tools/components";
    const offenders = readdirSync(join(root, dir))
      .filter((name) => name.endsWith(".tsx"))
      .filter((name) => /text-\[(?:[0-9]|1[01])px\]/.test(read(`${dir}/${name}`)));
    expect(offenders).toEqual([]);
  });
});
