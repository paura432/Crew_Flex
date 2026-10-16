import { describe, expect, it } from "vitest";
import { evaluateMatch } from "@/domain/matching";
import { candidate, FULL_HARD_SET, madRequirement, QT } from "../../../fixtures/domain";
import { explainAvailability, explainBlocker, explainCheck } from "./explain";

describe("match explanations (structured, locale-independent)", () => {
  it("explains a verified, valid qualification with its expiry", () => {
    const result = evaluateMatch(madRequirement(), candidate("c"));
    const b11 = result.qualificationChecks.find((c) => c.code === "B1.1");
    expect(explainCheck(b11!)).toEqual({
      label: "B1.1",
      detail: { key: "check.metVerifiedUntil", params: { date: "2028-12-31" } },
      tone: "ok",
      met: true,
    });
  });

  it("explains blockers as keys with the data the copy needs", () => {
    const result = evaluateMatch(
      madRequirement(),
      candidate("c", {
        qualifications: FULL_HARD_SET.filter((q) => q.qualificationTypeId !== QT.B11),
        availability: [],
      }),
    );
    expect(result.blockers.map(explainBlocker)).toEqual([
      { key: "blocker.missing", params: { code: "B1.1" } },
      { key: "blocker.notAvailable" },
    ]);
  });

  it("explains partial availability with the covered percent", () => {
    expect(explainAvailability(48.78).detail).toEqual({
      key: "availability.partial",
      params: { percent: 48.78 },
    });
    expect(explainAvailability(100).met).toBe(true);
  });
});
