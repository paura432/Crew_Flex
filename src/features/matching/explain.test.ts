import { describe, expect, it } from "vitest";
import { evaluateMatch } from "@/domain/matching";
import { candidate, FULL_HARD_SET, madRequirement, QT } from "../../../fixtures/domain";
import { explainAvailability, explainBlocker, explainCheck } from "./explain";

describe("match explanations", () => {
  it("explains a verified, valid qualification", () => {
    const result = evaluateMatch(madRequirement(), candidate("c"));
    const b11 = result.qualificationChecks.find((c) => c.code === "B1.1");
    expect(explainCheck(b11!)).toEqual({
      label: "B1.1",
      detail: "Verified · valid until 31 Dec 2028",
      tone: "ok",
      met: true,
    });
  });

  it("explains blockers in plain language", () => {
    const result = evaluateMatch(
      madRequirement(),
      candidate("c", {
        qualifications: FULL_HARD_SET.filter((q) => q.qualificationTypeId !== QT.B11),
        availability: [],
      }),
    );
    expect(result.blockers.map(explainBlocker)).toEqual([
      "Missing B1.1",
      "Not available on the requirement dates",
    ]);
  });

  it("explains partial availability", () => {
    expect(explainAvailability(48.78).detail).toBe("Covers 48.78% of the period");
    expect(explainAvailability(100).met).toBe(true);
  });
});
