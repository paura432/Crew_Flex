import { describe, expect, it } from "vitest";
import { poolCompleteness } from "./pool";

describe("poolCompleteness (results are never presented as exhaustive when they are not)", () => {
  it("50 candidates, cap 100 → complete", () => {
    expect(poolCompleteness(50, { prefiltered: 50, hardEligible: 12, cap: 100 })).toBe("complete");
  });
  it("exactly 100 → complete", () => {
    expect(poolCompleteness(100, { prefiltered: 100, hardEligible: 100, cap: 100 })).toBe(
      "complete",
    );
  });
  it("101 candidates, 3 eligible → near misses trimmed, every eligible one evaluated", () => {
    expect(poolCompleteness(100, { prefiltered: 101, hardEligible: 3, cap: 100 })).toBe(
      "nearMissesTrimmed",
    );
  });
  it("500 candidates, 150 pass the hard filters → partial result", () => {
    expect(poolCompleteness(100, { prefiltered: 500, hardEligible: 150, cap: 100 })).toBe(
      "eligibleTruncated",
    );
  });
});
