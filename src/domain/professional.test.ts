import { describe, expect, it } from "vitest";
import {
  COMPLETENESS_ITEMS,
  futureAvailabilityCount,
  profileCompleteness,
  type CompletenessInput,
} from "./professional";

const full: CompletenessInput = {
  profile: {
    displayName: "Technician Delta",
    baseLocation: "Barcelona (BCN)",
    yearsExperience: 12,
    primaryCategory: "B1.1",
    aircraft: ["A320 Family"],
    workPermits: ["ES"],
    minRate: 45,
  },
  qualifications: [
    { category: "LICENSE", status: "active" },
    { category: "TRAINING", status: "active" },
  ],
  futureAvailableWindows: 1,
  documents: 1,
};

describe("profileCompleteness (BR-11, T-36: the ten v1.8 items)", () => {
  it("lists the v1.8 connected items in their order", () => {
    expect(COMPLETENESS_ITEMS).toEqual([
      "display_name",
      "base_location",
      "primary_category",
      "aircraft",
      "years_experience",
      "min_rate",
      "work_permits",
      "availability",
      "courses",
      "document",
    ]);
  });

  it("is 100 % when every item is done", () => {
    expect(profileCompleteness(full)).toEqual({
      percent: 100,
      items: [...COMPLETENESS_ITEMS],
      missing: [],
    });
  });

  it("is 0 % for an empty profile and lists every item in order", () => {
    expect(
      profileCompleteness({
        profile: {
          displayName: " ",
          baseLocation: null,
          yearsExperience: null,
          primaryCategory: null,
          aircraft: [],
          workPermits: [],
          minRate: null,
        },
        qualifications: [],
        futureAvailableWindows: 0,
        documents: 0,
      }),
    ).toEqual({ percent: 0, items: [...COMPLETENESS_ITEMS], missing: [...COMPLETENESS_ITEMS] });
  });

  it("v1.8 steps of ten: one item missing is 90 %", () => {
    const result = profileCompleteness({ ...full, profile: { ...full.profile, minRate: null } });
    expect(result).toMatchObject({ percent: 90, missing: ["min_rate"] });
  });

  it("without the wallet the document item is left out (nine items, still 100 % reachable)", () => {
    const result = profileCompleteness({ ...full, documents: null });
    expect(result.items).not.toContain("document");
    expect(result.items).toHaveLength(9);
    expect(result.percent).toBe(100);
    expect(
      profileCompleteness({ ...full, documents: null, futureAvailableWindows: 0 }).percent,
    ).toBe(89);
  });

  it("a course is a held TRAINING qualification; verification and visibility are not items", () => {
    expect(
      profileCompleteness({
        ...full,
        qualifications: [
          { category: "TRAINING", status: "withdrawn" },
          { category: "LICENSE", status: "active" },
        ],
      }).missing,
    ).toEqual(["courses"]);
    // A profile with nothing verified can be complete (v1.8 does not count the review; OD-3).
    expect(profileCompleteness(full).missing).toEqual([]);
  });
});

describe("futureAvailabilityCount (v1.8 «Disponibilidad futura»)", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  it("counts only windows that publish availability and have not ended", () => {
    expect(
      futureAvailabilityCount(
        [
          { endsAt: "2026-10-01T00:00:00Z", status: "available" }, // ended
          { endsAt: "2026-10-22T12:00:00Z", status: "available" }, // ends now: not future
          { endsAt: "2026-10-23T00:00:00Z", status: "available" },
          { endsAt: "2026-11-01T00:00:00Z", status: "aog_only" }, // BR-4.8: published too
          { endsAt: "2026-12-01T00:00:00Z", status: "unavailable" },
        ],
        now,
      ),
    ).toBe(2);
  });
});
