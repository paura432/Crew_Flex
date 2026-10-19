import { describe, expect, it } from "vitest";
import { availabilityCoverage, effectiveStatus, type AvailabilityWindow } from "./availability.ts";

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
