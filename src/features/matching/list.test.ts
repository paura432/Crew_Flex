import { describe, expect, it } from "vitest";
import type { EvaluatedCandidate } from "@/types/api";
import { listMatches, MATCH_PAGE_SIZE, parseMatchListQuery } from "./list";

const item = (
  id: string,
  eligible: boolean,
  years: number | null,
  name: string | null = null,
  base: string | null = null,
): EvaluatedCandidate => ({
  candidate: {
    id,
    pool: "external",
    displayName: name,
    baseLocation: base,
    yearsExperience: years,
  },
  match: {
    candidateId: id,
    eligible,
    blockers: [],
    softScore: eligible ? 50 : 0,
    reasons: [],
    qualificationChecks: [],
    availability: { coveredPercent: 100 },
  },
});
const pool = [
  item("CF-A", true, 3, null, "Madrid (MAD)"),
  item("CF-B", false, 12, "Lucía Ruiz", "Barcelona"),
  item("CF-C", true, null, null, "Málaga"),
  item("CF-D", true, 12),
];
const q = (over: Record<string, string | string[]> = {}) => parseMatchListQuery(over);

describe("parseMatchListQuery", () => {
  it("defaults and rejects unknown values", () => {
    expect(q({ sort: "rate", page: "-2", eligible: "yes" })).toEqual({
      q: "",
      eligibleOnly: false,
      sort: "relevance",
      page: 1,
      compare: [],
    });
  });
  it("keeps distinct, well-formed compare ids", () => {
    expect(q({ compare: ["CF-A", "CF-A", "x'or 1=1", "CF-B"] }).compare).toEqual(["CF-A", "CF-B"]);
    expect(q({ compare: Array.from({ length: 500 }, (_, i) => `CF-${i}`) }).compare).toHaveLength(
      9,
    );
  });
});

describe("listMatches", () => {
  it("relevance keeps the engine order; eligible-only drops ineligible", () => {
    expect(listMatches(pool, q()).items.map((i) => i.candidate.id)).toEqual([
      "CF-A",
      "CF-B",
      "CF-C",
      "CF-D",
    ]);
    expect(listMatches(pool, q({ eligible: "1" })).items.map((i) => i.candidate.id)).toEqual([
      "CF-A",
      "CF-C",
      "CF-D",
    ]);
  });
  it("years: most experience first, unknown last, ties keep engine order", () => {
    expect(listMatches(pool, q({ sort: "years" })).items.map((i) => i.candidate.id)).toEqual([
      "CF-B",
      "CF-D",
      "CF-A",
      "CF-C",
    ]);
  });
  it("search is case- and accent-insensitive over ref, visible name and base", () => {
    expect(listMatches(pool, q({ q: "malaga" })).items.map((i) => i.candidate.id)).toEqual([
      "CF-C",
    ]);
    expect(listMatches(pool, q({ q: "LUCIA" })).items.map((i) => i.candidate.id)).toEqual(["CF-B"]);
    expect(listMatches(pool, q({ q: "cf-d" })).items.map((i) => i.candidate.id)).toEqual(["CF-D"]);
  });
  it("pages of 20, page clamped to the last one", () => {
    const many = Array.from({ length: 45 }, (_, i) => item(`CF-${i}`, true, i));
    const last = listMatches(many, q({ page: "9" }));
    expect([last.total, last.pages, last.page, last.items.length]).toEqual([
      45,
      3,
      3,
      45 - 2 * MATCH_PAGE_SIZE,
    ]);
  });
  it("compares at most 3 candidates from the whole pool, even outside the current filter", () => {
    const r = listMatches(pool, q({ eligible: "1", compare: ["CF-B", "CF-A", "CF-C", "CF-D"] }));
    expect(r.compared.map((i) => i.candidate.id)).toEqual(["CF-B", "CF-A", "CF-C"]);
    expect(r.compareTruncated).toBe(true);
    // Stale ids no longer in the pool do not trigger the "only 3 compared" notice.
    const stale = listMatches(pool, q({ compare: ["CF-B", "CF-A", "CF-C", "CF-GONE"] }));
    expect(stale.compared).toHaveLength(3);
    expect(stale.compareTruncated).toBe(false);
  });
});
