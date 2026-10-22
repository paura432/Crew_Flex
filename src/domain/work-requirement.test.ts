import { describe, expect, it } from "vitest";
import {
  canChangeRequirementStatus,
  isEvaluable,
  isExpired,
  REQUIREMENT_STATUSES,
} from "./work-requirement";

describe("isExpired (V1.8 «Vencida», display only)", () => {
  const endsAt = "2026-10-20T18:00:00.000Z";
  const at = (iso: string) => Date.parse(iso);
  it("an open requirement expires at the instant its period ends", () => {
    expect(isExpired({ status: "open", endsAt }, at("2026-10-20T17:59:59.999Z"))).toBe(false);
    expect(isExpired({ status: "open", endsAt }, at(endsAt))).toBe(true);
  });
  it("only open requirements: closed, cancelled, draft and covered keep their own status", () => {
    for (const status of ["closed", "cancelled", "draft", "covered", "paused"] as const) {
      expect(isExpired({ status, endsAt }, at("2027-01-01T00:00:00Z"))).toBe(false);
    }
  });
});

describe("requirement status changes (M05, owner 2026-10-22)", () => {
  it("allows exactly open ↔ paused, draft → open and anything-but-closed → closed", () => {
    const allowed = REQUIREMENT_STATUSES.flatMap((from) =>
      REQUIREMENT_STATUSES.filter((to) => canChangeRequirementStatus(from, to)).map(
        (to) => `${from}→${to}`,
      ),
    );
    expect(allowed.sort()).toEqual(
      [
        "draft→open",
        "open→paused",
        "paused→open",
        "draft→closed",
        "open→closed",
        "paused→closed",
        "covered→closed",
        "cancelled→closed",
      ].sort(),
    );
  });

  it("closed is terminal and nothing moves into cancelled or covered by hand", () => {
    for (const to of REQUIREMENT_STATUSES)
      expect(canChangeRequirementStatus("closed", to)).toBe(false);
    for (const from of REQUIREMENT_STATUSES) {
      expect(canChangeRequirementStatus(from, "cancelled")).toBe(false);
      expect(canChangeRequirementStatus(from, "covered")).toBe(false);
    }
  });

  it("paused and closed needs are not evaluated (no candidate pool)", () => {
    expect(REQUIREMENT_STATUSES.filter((status) => !isEvaluable({ status }))).toEqual([
      "paused",
      "closed",
    ]);
  });
});
