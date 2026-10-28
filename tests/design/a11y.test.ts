import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

// P15 (A11Y-01, A11Y-02, A11Y-05): the static side of what `PKG P15` measures in the browser.
const root = join(import.meta.dirname, "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("focus ring (A11Y-02 #1, A11Y-06 #15)", () => {
  const rule = /:focus-visible\s*\{([^}]*)\}/.exec(read("src/app/globals.css"))?.[1] ?? "";

  it("is the double ring: 3 px accent outline, 2 px offset, 2 px navy box-shadow", () => {
    expect(rule).toMatch(/outline:\s*3px solid var\(--color-accent\)/);
    expect(rule).toMatch(/outline-offset:\s*2px/);
    expect(rule).toMatch(/box-shadow:\s*0 0 0 2px var\(--color-navy\)/);
  });

  it("survives a `shadow-*` utility (Tailwind composes `--tw-ring-shadow` into its box-shadow)", () => {
    // The pressed tools toggle (`aria-[pressed=true]:shadow-sm`) lost the navy ring: only the 2.15:1
    // orange outline on white remained.
    expect(rule).toMatch(/--tw-ring-shadow:\s*0 0 0 2px var\(--color-navy\)/);
    expect(read("src/features/tools/components/parts.tsx")).toContain(
      "aria-[pressed=true]:shadow-sm",
    );
  });

  it("turns today's accent ring navy while the mini-calendar day is focused (`ring-*` overrides the variable)", () => {
    expect(read("src/features/availability/components/AvailabilityMonth.tsx")).toContain(
      'isToday ? "ring-2 ring-accent focus-visible:ring-navy"',
    );
  });
});

describe("landmark names (A11Y-01 #4)", () => {
  // Two visible `nav` landmarks with the same name (dock + dashboard quick links below `lg`) read as one.
  it("the mobile dock and the organization dashboard quick links have distinct names in both catalogs", () => {
    expect(es.shell.dock.label).not.toBe(es.hiring.dashboard.quickLinks);
    expect(en.shell.dock.label).not.toBe(en.hiring.dashboard.quickLinks);
    expect(es.shell.breadcrumb).not.toBe(es.shell.dock.label);
    expect(read("src/features/requirements/components/CoverageGuide.tsx")).toContain(
      '<nav aria-label={t("quickLinks")}>',
    );
  });
});

describe("touch targets on a coarse pointer (A11Y-05 #11, WCAG 2.5.5 44 px)", () => {
  it("linked list titles reserve 44 px: block + py-2.5 on a ≥ 15 px line or inline-flex + min-h-11", () => {
    const links: Array<[string, RegExp]> = [
      [
        "src/features/opportunities/components/OpportunityCard.tsx",
        /<Link href=\{href\} className="block text-blue hover:underline pointer-coarse:py-2\.5">/,
      ],
      [
        "src/app/app/professional/applications/page.tsx",
        /className="inline-flex items-center text-blue hover:underline pointer-coarse:min-h-11"/,
      ],
      [
        "src/features/requirements/components/RequirementsList.tsx",
        /className="inline-flex items-center font-semibold text-blue hover:underline pointer-coarse:min-h-11"/,
      ],
      [
        "src/features/requirements/components/RequirementsList.tsx",
        /className="block font-semibold text-blue hover:underline pointer-coarse:py-2\.5"/,
      ],
    ];
    for (const [path, pattern] of links) expect(read(path), path).toMatch(pattern);
  });

  it("the compact brand link of the navy bar is 44 × 44 (the mark alone is 36 px wide)", () => {
    expect(read("src/components/layout/AppShell.tsx")).toMatch(
      /<Link\s+href="\/app"\s+className="flex items-center pointer-coarse:min-h-11 pointer-coarse:min-w-11"\s*>/,
    );
  });
});
