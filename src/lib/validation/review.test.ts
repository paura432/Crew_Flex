import { describe, expect, it } from "vitest";
import { reviewQualificationInput } from "./review";

const id = "6f1c2a52-7b8e-4c1e-9a3f-0d2b5e8c4a11";
const v = "2026-10-15T10:30:00.000Z"; // the version the reviewer looked at

describe("reviewQualificationInput", () => {
  it("trims the evidence note", () => {
    expect(
      reviewQualificationInput.parse({
        qualificationId: id,
        decision: "verified",
        expectedUpdatedAt: v,
        note: "  ok  ",
      }).note,
    ).toBe("ok");
  });
  it("requires evidence for every decision (v1.8, T-170): a verification without a note and a blank reason are refused", () => {
    for (const body of [
      { qualificationId: id, decision: "verified", expectedUpdatedAt: v },
      { qualificationId: id, decision: "rejected", expectedUpdatedAt: v, note: "  " },
    ]) {
      const result = reviewQualificationInput.safeParse(body);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]).toMatchObject({
        path: ["note"],
        message: "v.review.evidenceRequired",
      });
    }
  });
  it("rejects pending as a decision, unknown fields and reviewer identity in the payload", () => {
    expect(
      reviewQualificationInput.safeParse({
        qualificationId: id,
        decision: "pending",
        expectedUpdatedAt: v,
      }).success,
    ).toBe(false);
    expect(
      reviewQualificationInput.safeParse({
        qualificationId: id,
        decision: "verified",
        reviewerId: id,
      }).success,
    ).toBe(false);
  });
  it("caps the note at 500 characters", () => {
    expect(
      reviewQualificationInput.safeParse({
        qualificationId: id,
        decision: "rejected",
        note: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
  it("requires the version the reviewer looked at (independent review M1)", () => {
    expect(
      reviewQualificationInput.safeParse({ qualificationId: id, decision: "verified" }).success,
    ).toBe(false);
  });
});
