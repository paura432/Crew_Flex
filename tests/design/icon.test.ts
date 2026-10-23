import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLANE_PATH } from "@/components/layout/BrandMark";

const root = join(import.meta.dirname, "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const token = (css: string, name: string) =>
  new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i").exec(css)?.[1]?.toLowerCase();

// NX-06: the favicon used #f59e0b / #0f172a, outside the palette. v1.8 brand (T-140): navy square,
// orange plane — the same plane the sidebar mark draws.
describe("favicon", () => {
  it("uses the brand tokens: navy square, orange plane", () => {
    const css = read("src/app/globals.css");
    const icon = read("src/app/icon.svg").toLowerCase();
    expect(icon).toContain(
      `<rect width="64" height="64" rx="14" fill="${token(css, "--color-navy")}"`,
    );
    expect(icon).toContain(`stroke="${token(css, "--color-accent")}"`);
    expect(icon).toContain(`aria-label="crewflex"`);
  });

  it("draws the same plane path as the sidebar mark (one isotype)", () => {
    expect(read("src/app/icon.svg")).toContain(`<path d="${PLANE_PATH}"/>`);
  });
});
