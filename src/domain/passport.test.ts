import { describe, expect, it } from "vitest";
import {
  AIRCRAFT,
  categoryKey,
  ENGINES,
  ENGLISH_LEVELS,
  EU_COUNTRIES,
  hasRestrictions,
  inCatalogOrder,
  LICENCE_CATEGORIES,
  meetsEnglishLevel,
  PHONE_PATTERN,
  PROFESSIONAL_CATEGORIES,
  RATE_UNITS,
  SKILLS,
} from "./passport";

describe("v1.8 passport catalogs (T-30…T-34)", () => {
  it("have the v1.8 sizes and no repeats", () => {
    for (const [list, size] of [
      [PROFESSIONAL_CATEGORIES, 12],
      [LICENCE_CATEGORIES, 8],
      [AIRCRAFT, 12],
      [ENGINES, 7],
      [SKILLS, 9],
      [ENGLISH_LEVELS, 6],
      [EU_COUNTRIES, 27],
      [RATE_UNITS, 2],
    ] as const) {
      expect(list).toHaveLength(size);
      expect(new Set(list).size).toBe(size);
    }
  });

  it("licence categories are the categories without the trades (v1.8 demo)", () => {
    expect(
      PROFESSIONAL_CATEGORIES.filter((c) => !(LICENCE_CATEGORIES as readonly string[]).includes(c)),
    ).toEqual(["MECHANIC", "SHEET-METAL", "NDT", "HELPER"]);
  });

  it("EU countries are ISO alpha-2 codes and exclude non-members v1.8 demo offered (UK)", () => {
    expect(EU_COUNTRIES.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
    expect(EU_COUNTRIES).not.toContain("GB");
  });
});

describe("helpers", () => {
  it("inCatalogOrder keeps the catalog order and drops repeats", () => {
    expect(inCatalogOrder(AIRCRAFT, ["B787", "A320 Family", "B787"])).toEqual([
      "A320 Family",
      "B787",
    ]);
  });

  it("categoryKey is a valid next-intl key (no dots or dashes)", () => {
    expect(PROFESSIONAL_CATEGORIES.map(categoryKey)).toEqual([
      "B1_1",
      "B1_2",
      "B1_3",
      "B1_4",
      "B2",
      "B3",
      "CAT_A",
      "CAT_C",
      "MECHANIC",
      "SHEET_METAL",
      "NDT",
      "HELPER",
    ]);
  });

  it("hasRestrictions: general text or any restricted rating; blanks are not restrictions", () => {
    const rating = { aircraft: "A320 Family", category: "B1.1", expiresAt: null } as const;
    expect(hasRestrictions({ generalRestrictions: null, typeRatings: [] })).toBe(false);
    expect(hasRestrictions({ generalRestrictions: "  ", typeRatings: [] })).toBe(false);
    expect(
      hasRestrictions({ generalRestrictions: "Engines under supervision", typeRatings: [] }),
    ).toBe(true);
    expect(
      hasRestrictions({
        generalRestrictions: null,
        typeRatings: [{ ...rating, restrictions: "No CFM56" }],
      }),
    ).toBe(true);
  });

  it("meetsEnglishLevel follows CEFR order; no declared level never meets", () => {
    expect(meetsEnglishLevel("C1", "B2")).toBe(true);
    expect(meetsEnglishLevel("B2", "B2")).toBe(true);
    expect(meetsEnglishLevel("B1", "B2")).toBe(false);
    expect(meetsEnglishLevel(null, "A1")).toBe(false);
  });

  it("PHONE_PATTERN accepts v1.8-style numbers and refuses text", () => {
    for (const ok of ["+34 600 000 001", "600000001", "+34 600-000.001", "+351 (21) 000 0000"]) {
      expect(PHONE_PATTERN.test(ok), ok).toBe(true);
    }
    for (const bad of ["call me", "12345", "+(351) 21 000", "+34 600 000 001 ext. 2"]) {
      expect(PHONE_PATTERN.test(bad), bad).toBe(false);
    }
  });
});
