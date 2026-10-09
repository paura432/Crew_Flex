import { describe, expect, it } from "vitest";
import { validityForPeriod } from "./qualification.ts";

const start = "2026-10-18T20:00:00Z";
const end = "2026-10-22T06:00:00Z";

describe("validityForPeriod", () => {
  it.each([
    [null, "valid"],
    ["2026-10-17", "expired"],
    ["2026-10-18", "expires_during"],
    ["2026-10-21", "expires_during"],
    ["2026-10-22", "valid"],
    ["2030-01-01", "valid"],
  ] as const)("expiresAt %s → %s", (expiresAt, expected) => {
    expect(validityForPeriod(expiresAt, start, end)).toBe(expected);
  });

  it("an end at exactly midnight does not require the following day", () => {
    expect(validityForPeriod("2026-10-21", start, "2026-10-22T00:00:00Z")).toBe("valid");
  });
});
