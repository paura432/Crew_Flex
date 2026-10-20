import { describe, expect, it } from "vitest";
import { isExpired } from "./work-requirement";

describe("isExpired (V1.8 «Vencida», display only)", () => {
  const endsAt = "2026-10-20T18:00:00.000Z";
  const at = (iso: string) => Date.parse(iso);
  it("an open requirement expires at the instant its period ends", () => {
    expect(isExpired({ status: "open", endsAt }, at("2026-10-20T17:59:59.999Z"))).toBe(false);
    expect(isExpired({ status: "open", endsAt }, at(endsAt))).toBe(true);
  });
  it("only open requirements: closed, cancelled, draft and covered keep their own status", () => {
    for (const status of ["closed", "cancelled", "draft", "covered"] as const) {
      expect(isExpired({ status, endsAt }, at("2027-01-01T00:00:00Z"))).toBe(false);
    }
  });
});
