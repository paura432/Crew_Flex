import { describe, expect, it } from "vitest";
import {
  directoryHref,
  EMPTY_DIRECTORY_QUERY,
  hasDirectoryFilters,
  parseDirectoryQuery,
  toDirectorySearchParams,
} from "./query";

const TODAY = "2026-10-23";

describe("parseDirectoryQuery", () => {
  it("reads the seven filters and the page; unknown catalog values fall back", () => {
    const { query, errors } = parseDirectoryQuery(
      {
        category: "B1.1",
        aircraft: "A320 Family",
        englishLevel: "B2",
        minYears: "5",
        country: "ES",
        base: "  Madrid ",
        from: "2026-11-01",
        to: "2026-11-10",
        page: "3",
      },
      TODAY,
    );
    expect(query).toEqual({
      category: "B1.1",
      aircraft: "A320 Family",
      englishLevel: "B2",
      minYears: 5,
      country: "ES",
      base: "Madrid",
      from: "2026-11-01",
      to: "2026-11-10",
      page: 3,
    });
    expect(errors).toEqual({ window: false, minYears: false });
    const fallback = parseDirectoryQuery(
      { category: "B9", aircraft: "Concorde", englishLevel: "D1", country: "UK", page: "-2" },
      TODAY,
    ).query;
    expect(fallback).toEqual(EMPTY_DIRECTORY_QUERY);
    expect(parseDirectoryQuery({}, TODAY).query).toEqual(EMPTY_DIRECTORY_QUERY);
    expect(parseDirectoryQuery({ page: "9999" }, TODAY).query.page).toBe(500);
    expect(parseDirectoryQuery({ base: "x".repeat(100) }, TODAY).query.base).toHaveLength(80);
  });

  it("flags v1.8's errors: half a window, reversed, longer than a year, in the past; years out of range", () => {
    const windowError = (from: string, to: string) =>
      parseDirectoryQuery({ from, to }, TODAY).errors.window;
    expect(windowError("2026-11-01", "")).toBe(true);
    expect(windowError("", "2026-11-01")).toBe(true);
    expect(windowError("2026-11-10", "2026-11-01")).toBe(true);
    expect(windowError("2026-11-01", "2027-11-02")).toBe(true);
    expect(windowError("2026-10-22", "2026-10-30")).toBe(true); // yesterday
    expect(windowError("2026-10-23", "2027-10-23")).toBe(false); // today, exactly a year
    expect(windowError("2026-13-01", "2026-13-02")).toBe(true);
    for (const bad of ["61", "-1", "five", "1.5"]) {
      const { query, errors } = parseDirectoryQuery({ minYears: bad }, TODAY);
      expect(errors.minYears, bad).toBe(true);
      expect(query.minYears, bad).toBeNull();
    }
    expect(parseDirectoryQuery({ minYears: "0" }, TODAY)).toMatchObject({
      query: { minYears: 0 },
      errors: { minYears: false },
    });
    // An invalid window is kept so the form can show it for correction.
    expect(parseDirectoryQuery({ from: "2026-11-01" }, TODAY).query.from).toBe("2026-11-01");
  });
});

describe("toDirectorySearchParams / directoryHref", () => {
  it("send only the set filters; a half window never travels; defaults are omitted from links", () => {
    const { query } = parseDirectoryQuery({ category: "B2", from: "2026-11-01" }, TODAY);
    expect(toDirectorySearchParams("org", query)).toEqual({
      organizationId: "org",
      category: "B2",
    });
    expect(directoryHref(EMPTY_DIRECTORY_QUERY)).toBe("/app/organization/candidates");
    expect(directoryHref(EMPTY_DIRECTORY_QUERY, { page: 2 })).toBe(
      "/app/organization/candidates?page=2",
    );
    // The parked employer block: `blocked` is not URL state any more.
    expect(parseDirectoryQuery({ blocked: "1" }, TODAY).query).toEqual(EMPTY_DIRECTORY_QUERY);
    expect(directoryHref({ ...EMPTY_DIRECTORY_QUERY, minYears: 0, base: "Lisboa (LIS)" })).toBe(
      "/app/organization/candidates?minYears=0&base=Lisboa+%28LIS%29",
    );
    expect(hasDirectoryFilters(EMPTY_DIRECTORY_QUERY)).toBe(false);
    expect(hasDirectoryFilters({ ...EMPTY_DIRECTORY_QUERY, base: "x" })).toBe(false); // the main field
    expect(hasDirectoryFilters({ ...EMPTY_DIRECTORY_QUERY, minYears: 0 })).toBe(true);
  });
});
