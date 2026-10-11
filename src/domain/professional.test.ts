import { describe, expect, it } from "vitest";
import { profileCompleteness, type CompletenessInput } from "./professional";

const full: CompletenessInput = {
  profile: {
    displayName: "Technician Delta",
    baseLocation: "Barcelona (BCN)",
    yearsExperience: 12,
    visibility: "anonymous",
  },
  qualifications: [
    { category: "LICENSE", verificationStatus: "verified", status: "active" },
    { category: "TRAINING", verificationStatus: "pending", status: "active" },
  ],
  availableWindows: 1,
};

describe("profileCompleteness (BR-11)", () => {
  it("is 100 % when every item is done", () => {
    expect(profileCompleteness(full)).toEqual({ percent: 100, missing: [] });
  });

  it("is 0 % for an empty private profile and lists every item in order", () => {
    expect(
      profileCompleteness({
        profile: {
          displayName: " ",
          baseLocation: null,
          yearsExperience: null,
          visibility: "private",
        },
        qualifications: [],
        availableWindows: 0,
      }),
    ).toEqual({
      percent: 0,
      missing: [
        "display_name",
        "base_location",
        "years_experience",
        "licence_or_rating",
        "verified_qualification",
        "availability",
        "visibility",
      ],
    });
  });

  it("ignores withdrawn qualifications and pending ones for the verified item", () => {
    const result = profileCompleteness({
      ...full,
      qualifications: [
        { category: "LICENSE", verificationStatus: "verified", status: "withdrawn" },
        { category: "TRAINING", verificationStatus: "pending", status: "active" },
      ],
    });
    expect(result.missing).toEqual(["licence_or_rating", "verified_qualification"]);
    expect(result.percent).toBe(71);
  });

  it("a type rating counts as the licence/rating item; a training course does not", () => {
    const rating = profileCompleteness({
      ...full,
      qualifications: [
        { category: "TYPE_RATING", verificationStatus: "pending", status: "active" },
      ],
    });
    expect(rating.missing).toEqual(["verified_qualification"]);
  });
});
