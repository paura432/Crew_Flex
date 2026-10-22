import { describe, expect, it } from "vitest";
import type { MatchResult } from "@/domain/matching";
import { opportunitiesHref, opportunityVerdict } from "./view";

const match = (eligible: boolean, codes: string[]) =>
  ({
    eligible,
    blockers: codes.map((code) => ({ code, qualification: "B1.1" })),
  }) as unknown as MatchResult;

describe("opportunityVerdict (v1.8 card line)", () => {
  it("eligible, hard qualifications pending (counted), or dates only", () => {
    expect(opportunityVerdict(match(true, []))).toEqual({ kind: "eligible" });
    expect(
      opportunityVerdict(
        match(false, ["MISSING_HARD_QUALIFICATION", "HARD_QUALIFICATION_EXPIRED", "NOT_AVAILABLE"]),
      ),
    ).toEqual({ kind: "qualifications", count: 2 });
    expect(opportunityVerdict(match(false, ["PARTIAL_AVAILABILITY"]))).toEqual({
      kind: "availability",
    });
  });
});

describe("opportunitiesHref", () => {
  const base = { page: 3, q: "A320", urgency: "aog" as const, eligible: undefined };
  it("keeps the filters, resets to page 1 on a filter change, drops empty values", () => {
    expect(opportunitiesHref(base, { page: 3 })).toBe(
      "/app/professional/opportunities?q=A320&urgency=aog&page=3",
    );
    expect(opportunitiesHref(base, { eligible: "1" })).toBe(
      "/app/professional/opportunities?q=A320&urgency=aog&eligible=1",
    );
    expect(opportunitiesHref({ page: 1 })).toBe("/app/professional/opportunities");
  });
});
