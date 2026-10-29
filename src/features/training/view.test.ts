import { describe, expect, it } from "vitest";
import {
  catalogHref,
  catalogQuery,
  formatSessionRange,
  isoToUtcInput,
  parseCatalogFilters,
  utcInputToIso,
} from "./view";

describe("training catalog filters", () => {
  it("keeps valid values, drops the rest", () => {
    const f = parseCatalogFilters({
      q: " motor ",
      family: "engines",
      mode: "nope",
      from: "2026-11-01",
      to: "bad",
      page: "0",
    });
    expect(f).toEqual({
      q: "motor",
      family: "engines",
      mode: "",
      language: "",
      country: "",
      from: "2026-11-01",
      to: "",
      page: 1,
    });
  });
  it("pages of 12 on the server and stable links", () => {
    const f = parseCatalogFilters({ family: "safety", page: "3" });
    expect(catalogQuery(f)).toEqual({ family: "safety", offset: 24, limit: 12 });
    expect(catalogHref(f, { page: 1 })).toBe("/app/training?family=safety");
    expect(catalogHref(f, { page: 2 })).toBe("/app/training?family=safety&page=2");
  });
});

describe("session times", () => {
  it("are shown in the edition's zone, across DST", () => {
    expect(
      formatSessionRange("en", "2026-10-24T06:00:00Z", "2026-10-24T10:00:00Z", "Europe/Madrid"),
    ).toBe("24 Oct 2026, 08:00–12:00");
    expect(
      formatSessionRange("en", "2026-10-26T06:00:00Z", "2026-10-26T10:00:00Z", "Europe/Madrid"),
    ).toBe("26 Oct 2026, 07:00–11:00");
  });
  it("UTC inputs round-trip", () => {
    expect(utcInputToIso("2026-11-02T08:30")).toBe("2026-11-02T08:30:00.000Z");
    expect(isoToUtcInput("2026-11-02T08:30:00.000Z")).toBe("2026-11-02T08:30");
    expect(utcInputToIso("")).toBeNull();
  });
});
