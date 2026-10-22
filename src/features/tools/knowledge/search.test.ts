import { describe, expect, it } from "vitest";
import { ATA, ENTRIES, KNOWLEDGE_GROUPS, KNOWLEDGE_SOURCES, PRACTICE_CARDS } from "./data";
import { filterAta, normalizeText, searchKnowledge } from "./search";

describe("editorial bank (v1.8 knowledge.js 2026-10-13.1)", () => {
  it("has 102 entries, 46 ATA chapters, 21 practice cards and 4 sources", () => {
    expect(ENTRIES).toHaveLength(102);
    expect(ATA).toHaveLength(46);
    expect(PRACTICE_CARDS).toHaveLength(21);
    expect(KNOWLEDGE_SOURCES).toHaveLength(4);
    expect(new Set(ENTRIES.map((e) => e.id)).size).toBe(102);
    expect(ENTRIES[0]!.id).toBe("term-1");
    expect(ENTRIES.at(-1)!.id).toBe("term-102");
  });

  it("lists the 13 areas in the prototype's order, with its per-area counts", () => {
    expect(KNOWLEDGE_GROUPS).toEqual([
      "Mecánica",
      "Verbos",
      "Dirección",
      "Electricidad",
      "Fluidos",
      "Estado",
      "Estructuras",
      "Materiales",
      "Inspección",
      "Combustible",
      "Medición",
      "Documentación",
      "Siglas",
    ]);
    const count = (g: string) => ENTRIES.filter((e) => e.group === g).length;
    expect([count("Siglas"), count("Mecánica"), count("Verbos"), count("Fluidos")]).toEqual([
      38, 11, 10, 7,
    ]);
  });

  it("ATA covers 00, 05-12, 20-36, 38, 49, 51-57 and 70-80", () => {
    const codes = ATA.map((a) => a.code).join(" ");
    expect(codes).toBe(
      "00 05 06 07 08 09 10 11 12 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 38 49 51 52 53 54 55 56 57 70 71 72 73 74 75 76 77 78 79 80",
    );
  });
});

describe("normalizeText", () => {
  it("drops accents, lower-cases and trims", () => {
    expect(normalizeText("  Energía HIDRÁULICA ")).toBe("energia hidraulica");
    expect(normalizeText("Ñ")).toBe("n");
  });
});

describe("searchKnowledge", () => {
  it("an empty query lists the whole area", () => {
    expect(searchKnowledge("")).toHaveLength(102);
    expect(searchKnowledge("", "Siglas")).toHaveLength(38);
  });

  it("matches term, translation or definition, without accents or surrounding spaces", () => {
    expect(searchKnowledge("torque").map((e) => e.term)).toEqual(["Torque"]);
    expect(searchKnowledge(" torque ").map((e) => e.term)).toEqual(["Torque"]);
    expect(searchKnowledge("holgura").map((e) => e.term)).toEqual(["Clearance"]);
    expect(searchKnowledge("calibracion").map((e) => e.term)).toEqual(["Calibration"]);
    expect(searchKnowledge("AMM", "Siglas").map((e) => e.term)).toEqual(["AMM"]);
  });

  it("does not search the examples, and filters by area", () => {
    // «specified» only appears in examples
    expect(searchKnowledge("specified")).toEqual([]);
    expect(searchKnowledge("torque", "Siglas")).toEqual([]);
    expect(searchKnowledge("zzzz")).toEqual([]);
  });
});

describe("filterAta", () => {
  it("finds a chapter without its accent (v1.8 did not, ✗ TOOL-05 #14)", () => {
    expect(filterAta("hidraulica")).toEqual([{ code: "29", label: "Energía hidráulica" }]);
    expect(filterAta("hidráulica")).toEqual([{ code: "29", label: "Energía hidráulica" }]);
  });

  it("by number or system, and empty for no match", () => {
    expect(filterAta("28").map((a) => a.label)).toEqual(["Combustible"]);
    expect(filterAta("combustible").map((a) => a.code)).toEqual(["28", "73"]);
    expect(filterAta("")).toHaveLength(46);
    expect(filterAta("zzzz")).toEqual([]);
  });
});
