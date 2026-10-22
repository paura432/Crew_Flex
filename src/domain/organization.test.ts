import { describe, expect, it } from "vitest";
import { EU_COUNTRIES, isExternallyMatchable, reviewBlocker } from "./organization";
import { PROFILE_VISIBILITIES } from "./professional";

describe("isExternallyMatchable (BR-8)", () => {
  it("private never, anonymous/open always, verified_orgs only for a reviewed organization", () => {
    const table = PROFILE_VISIBILITIES.map((v) => [
      v,
      isExternallyMatchable(v, "pending"),
      isExternallyMatchable(v, "reviewed"),
    ]);
    expect(table).toEqual([
      ["private", false, false],
      ["anonymous", true, true],
      ["verified_orgs", false, true],
      ["open", true, true],
    ]);
  });
});

describe("reviewBlocker (BR-20)", () => {
  const complete = {
    country: "ES",
    taxId: "ESB0",
    taxAddress: "Calle 1",
    reviewStatus: "pending" as const,
  };

  it("a pending organization with complete fiscal data can be reviewed by a non-member", () => {
    expect(reviewBlocker(complete, false)).toBeNull();
  });

  it("own organization first, then already reviewed, then incomplete data", () => {
    expect(reviewBlocker({ ...complete, reviewStatus: "reviewed" }, true)).toBe("own");
    expect(reviewBlocker({ ...complete, reviewStatus: "reviewed" }, false)).toBe("reviewed");
    expect(reviewBlocker({ ...complete, taxId: null }, false)).toBe("incomplete");
    expect(reviewBlocker({ ...complete, taxAddress: "  " }, false)).toBe("incomplete");
    expect(reviewBlocker({ ...complete, country: null }, false)).toBe("incomplete");
  });
});

describe("EU_COUNTRIES (OD-6 default, v1.8 rules.mjs)", () => {
  it("are the 27 member states, ISO 3166-1 alpha-2, no duplicates", () => {
    expect(EU_COUNTRIES).toHaveLength(27);
    expect(new Set(EU_COUNTRIES).size).toBe(27);
    for (const code of EU_COUNTRIES) expect(code).toMatch(/^[A-Z]{2}$/);
  });
});
