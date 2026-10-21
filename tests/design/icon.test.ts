import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const token = (css: string, name: string) =>
  new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i").exec(css)?.[1]?.toLowerCase();

// NX-06: the favicon used #f59e0b / #0f172a, outside the palette. It mirrors the sidebar mark.
describe("favicon", () => {
  it("uses the brand tokens: accent square, navy «CF»", () => {
    const css = read("src/app/globals.css");
    const icon = read("src/app/icon.svg").toLowerCase();
    expect(icon).toContain(
      `<rect width="64" height="64" rx="14" fill="${token(css, "--color-accent")}"`,
    );
    expect(icon).toMatch(new RegExp(`fill="${token(css, "--color-navy")}">cf</text>`));
  });
});
