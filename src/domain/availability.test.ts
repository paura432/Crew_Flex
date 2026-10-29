import { describe, expect, it } from "vitest";
import {
  AVAILABILITY_CONFLICTS,
  availabilityCoverage,
  effectiveStatus,
  possibleOnRest,
  type AvailabilityWindow,
} from "./availability.ts";

const S = "2026-11-01T00:00:00Z";
const MID = "2026-11-03T00:00:00Z";
const E = "2026-11-05T00:00:00Z";
const w = (startsAt: string, endsAt: string, status: AvailabilityWindow["status"]) => ({
  startsAt,
  endsAt,
  status,
});

describe("BR-4.8 effectiveStatus: aog_only depends on the DECLARED urgency", () => {
  it("counts as available only for AOG and blocks every other urgency", () => {
    expect(effectiveStatus("aog_only", "aog")).toBe("available");
    expect(effectiveStatus("aog_only", "urgent")).toBe("unavailable");
    expect(effectiveStatus("aog_only", "planned")).toBe("unavailable");
    for (const u of ["planned", "urgent", "aog"] as const) {
      expect(effectiveStatus("available", u)).toBe("available");
      expect(effectiveStatus("unavailable", u)).toBe("unavailable");
    }
  });
});

describe("availabilityCoverage with aog_only (precedence unavailable > aog_only > available)", () => {
  it("aog_only alone covers an AOG need, never a planned or urgent one", () => {
    const windows = [w(S, E, "aog_only")];
    expect(availabilityCoverage(windows, S, E, "aog").fullyCovered).toBe(true);
    expect(availabilityCoverage(windows, S, E, "urgent").coveredPercent).toBe(0);
    expect(availabilityCoverage(windows, S, E, "planned").coveredPercent).toBe(0);
  });

  it("an overlapping aog_only period takes that part out of ordinary availability", () => {
    const windows = [w(S, E, "available"), w(MID, E, "aog_only")];
    expect(availabilityCoverage(windows, S, E, "urgent")).toEqual({
      coveredPercent: 50,
      fullyCovered: false,
    });
    expect(availabilityCoverage(windows, S, E, "aog").fullyCovered).toBe(true);
  });

  it("unavailable overrides aog_only even for AOG", () => {
    const windows = [w(S, E, "aog_only"), w(MID, E, "unavailable")];
    expect(availabilityCoverage(windows, S, E, "aog").coveredPercent).toBe(50);
  });

  it("available + adjacent aog_only covers an AOG need end to end", () => {
    const windows = [w(S, MID, "available"), w(MID, E, "aog_only")];
    expect(availabilityCoverage(windows, S, E, "aog").fullyCovered).toBe(true);
    expect(availabilityCoverage(windows, S, E, "planned").coveredPercent).toBe(50);
  });

  it("windows without aog_only behave exactly as before for every urgency", () => {
    const windows = [w(S, E, "available"), w(MID, "2026-11-04T00:00:00Z", "unavailable")];
    for (const u of ["planned", "urgent", "aog"] as const) {
      expect(availabilityCoverage(windows, S, E, u).coveredPercent).toBe(75);
    }
  });
});

describe("BR-4.9 conflict reasons", () => {
  it("one stable reason, raised by the SQL as CFV01", () => {
    expect(AVAILABILITY_CONFLICTS).toEqual(["ASSIGNMENT_PROTECTED"]);
  });
});

describe("BR-14.1 possibleOnRest (v1.8 «Posible en descanso»)", () => {
  const period = (urgency: "planned" | "aog" = "planned") => ({ startsAt: S, endsAt: E, urgency });
  const missing = { eligible: false, blockers: [{ code: "PARTIAL_AVAILABILITY" }] };
  const none = { eligible: false, blockers: [{ code: "NOT_AVAILABLE" }] };

  it("rest days (no window) would be published: possible when nothing in the period is blocked", () => {
    expect(possibleOnRest(none, [], period())).toBe(true);
    expect(possibleOnRest(missing, [w(S, MID, "available")], period())).toBe(true);
  });

  it("a blocked day is work, not rest: never possible", () => {
    expect(
      possibleOnRest(missing, [w(S, MID, "available"), w(MID, E, "unavailable")], period()),
    ).toBe(false);
    // «AOG only» blocks a planned need (BR-4.8) and is published availability for an AOG one.
    expect(possibleOnRest(missing, [w(MID, E, "aog_only")], period())).toBe(false);
    expect(possibleOnRest(missing, [w(MID, E, "aog_only")], period("aog"))).toBe(true);
  });

  it("windows outside the period do not matter (half-open, UTC)", () => {
    expect(possibleOnRest(none, [w(E, "2026-11-09T00:00:00Z", "unavailable")], period())).toBe(
      true,
    );
  });

  it("only availability blockers: an eligible match or a qualification blocker is never «possible»", () => {
    expect(possibleOnRest({ eligible: true, blockers: [] }, [], period())).toBe(false);
    const qualification = {
      eligible: false,
      blockers: [{ code: "MISSING_HARD_QUALIFICATION" }, { code: "NOT_AVAILABLE" }],
    };
    expect(possibleOnRest(qualification, [], period())).toBe(false);
    expect(possibleOnRest({ eligible: false, blockers: [] }, [], period())).toBe(false);
  });
});
