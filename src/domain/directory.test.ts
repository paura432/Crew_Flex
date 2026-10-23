import { describe, expect, it } from "vitest";
import {
  avatarInitials,
  daysBetween,
  DIRECTORY_CONFLICTS,
  DIRECTORY_REF_PATTERN,
  isValidDirectoryWindow,
  medals,
  splitMedals,
  utcDay,
} from "./directory";

describe("directory window (v1.8 «intervalo válido de hasta un año», T-154)", () => {
  const today = "2026-10-23";
  it("accepts an empty window, today, and exactly a year; refuses half, reversed, longer and past windows", () => {
    expect(isValidDirectoryWindow(null, null, today)).toBe(true);
    expect(isValidDirectoryWindow("", undefined, today)).toBe(true);
    expect(isValidDirectoryWindow("2026-10-23", "2026-10-23", today)).toBe(true);
    expect(isValidDirectoryWindow("2026-10-23", "2027-10-23", today)).toBe(true);
    expect(isValidDirectoryWindow("2026-10-23", "2027-10-24", today)).toBe(false);
    expect(isValidDirectoryWindow("2026-10-22", "2026-10-25", today)).toBe(false);
    expect(isValidDirectoryWindow("2026-10-25", "2026-10-24", today)).toBe(false);
    expect(isValidDirectoryWindow("2026-10-25", null, today)).toBe(false);
    expect(isValidDirectoryWindow(null, "2026-10-25", today)).toBe(false);
    expect(isValidDirectoryWindow("2026-13-01", "2026-13-02", today)).toBe(false);
    expect(isValidDirectoryWindow("25/10/2026", "26/10/2026", today)).toBe(false);
  });
  it("counts whole UTC days and names the UTC day of an instant", () => {
    expect(daysBetween("2026-10-23", "2026-10-24")).toBe(1);
    expect(daysBetween("2026-10-24", "2026-10-23")).toBe(-1);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2); // across the DST change
    expect(utcDay(Date.UTC(2026, 9, 23, 23, 59))).toBe("2026-10-23");
    expect(utcDay(Date.UTC(2026, 9, 24, 0, 0))).toBe("2026-10-24");
  });
});

describe("medals (v1.8 MedalStrip)", () => {
  const candidate = {
    yearsExperience: 12,
    primaryCategory: "B2" as const,
    categories: ["B1.1", "B2"] as const,
    aircraft: ["A320 Family", "B737 NG"] as const,
  };
  it("lists years, the main category first, the other categories, then the aircraft", () => {
    expect(medals(candidate)).toEqual([
      { kind: "experience", years: 12 },
      { kind: "category", category: "B2" },
      { kind: "category", category: "B1.1" },
      { kind: "aircraft", aircraft: "A320 Family" },
      { kind: "aircraft", aircraft: "B737 NG" },
    ]);
    expect(
      medals({ yearsExperience: 0, primaryCategory: null, categories: [], aircraft: [] }),
    ).toEqual([]);
    expect(
      medals({ yearsExperience: null, primaryCategory: null, categories: ["NDT"], aircraft: [] }),
    ).toEqual([{ kind: "category", category: "NDT" }]);
  });
  it("shows one medal per kind and folds the rest behind «+N»", () => {
    const { shown, more } = splitMedals(medals(candidate));
    expect(shown).toEqual([
      { kind: "experience", years: 12 },
      { kind: "category", category: "B2" },
      { kind: "aircraft", aircraft: "A320 Family" },
    ]);
    expect(more).toEqual([
      { kind: "category", category: "B1.1" },
      { kind: "aircraft", aircraft: "B737 NG" },
    ]);
  });
});

describe("avatar and refs", () => {
  it("initials of the first two words, «CF» while anonymous or empty", () => {
    expect(avatarInitials("Technician Echo")).toBe("TE");
    expect(avatarInitials("  maría  del  carmen ")).toBe("MD");
    expect(avatarInitials("ñu")).toBe("Ñ");
    expect(avatarInitials(null)).toBe("CF");
    expect(avatarInitials("   ")).toBe("CF");
  });
  it("the ref shape and the CFD order", () => {
    expect("CF-0123ABCDEF").toMatch(DIRECTORY_REF_PATTERN);
    expect("cf-0123abcdef").not.toMatch(DIRECTORY_REF_PATTERN);
    expect("CF-0123ABCDE").not.toMatch(DIRECTORY_REF_PATTERN);
    expect(DIRECTORY_CONFLICTS).toEqual([
      "DIRECTORY_RATE_LIMITED",
      "DIRECTORY_CANDIDATE_NOT_FOUND",
    ]);
  });
});
