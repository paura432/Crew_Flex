import { describe, expect, it } from "vitest";
import {
  confirmedCoverage,
  countStatuses,
  coveredShifts,
  requirementDays,
  seatsByRequirement,
  seatsTaken,
  sumCounts,
} from "./coverage";

describe("BR-23 confirmed coverage (v1.8 business.js coverage())", () => {
  it("counts confirmed and finished seats only", () => {
    expect(seatsTaken({ confirmed: 1, finished: 2, accepted: 4, received: 7 })).toBe(3);
    expect(seatsTaken({})).toBe(0);
    expect(
      countStatuses([{ status: "confirmed" }, { status: "received" }, { status: "confirmed" }]),
    ).toEqual({ confirmed: 2, received: 1 });
  });

  it("percent = round(filled / max(1, headcount) × 100), filled never above the headcount", () => {
    expect(confirmedCoverage(2, 1)).toEqual({ filled: 1, total: 2, percent: 50 });
    expect(confirmedCoverage(1, 1)).toEqual({ filled: 1, total: 1, percent: 100 });
    expect(confirmedCoverage(3, 1)).toEqual({ filled: 1, total: 3, percent: 33 });
    expect(confirmedCoverage(3, 2).percent).toBe(67);
    expect(confirmedCoverage(2, 5)).toEqual({ filled: 2, total: 2, percent: 100 });
    expect(confirmedCoverage(2, 0)).toEqual({ filled: 0, total: 2, percent: 0 });
    expect(confirmedCoverage(0, 0)).toEqual({ filled: 0, total: 0, percent: 0 });
  });

  it("days of a period: started 24-hour blocks, at least one (T-92)", () => {
    expect(requirementDays("2026-11-10T08:00:00.000Z", "2026-11-10T16:00:00.000Z")).toBe(1);
    expect(requirementDays("2026-11-10T08:00:00.000Z", "2026-11-12T16:00:00.000Z")).toBe(3);
    expect(requirementDays("2026-11-10T22:00:00.000Z", "2026-11-11T06:00:00.000Z")).toBe(1);
    expect(requirementDays("2026-11-10T00:00:00.000Z", "2026-11-11T00:00:00.000Z")).toBe(1);
    expect(requirementDays("2026-11-10T00:00:00.000Z", "2026-11-11T00:00:00.001Z")).toBe(2);
    // With shifts (v2-09) the shifts count, whatever the envelope.
    expect(requirementDays("2026-11-10T08:00:00.000Z", "2026-11-20T16:00:00.000Z", 3)).toBe(3);
    expect(requirementDays("2026-11-10T08:00:00.000Z", "2026-11-12T16:00:00.000Z", null)).toBe(3);
  });

  it("«Jornadas cubiertas» = Σ filled seats × days; organization counters are the sums", () => {
    const rows = [
      // 2 seats, 1 confirmed, 3 days → 3
      {
        requirementId: "a",
        headcount: 2,
        startsAt: "2026-11-10T08:00:00.000Z",
        endsAt: "2026-11-12T16:00:00.000Z",
        shiftCount: null,
        counts: { confirmed: 1, received: 2 },
      },
      // 1 seat, finished + an extra confirmed (never above the headcount), 1 day → 1
      {
        requirementId: "b",
        headcount: 1,
        startsAt: "2026-11-20T08:00:00.000Z",
        endsAt: "2026-11-20T16:00:00.000Z",
        shiftCount: null,
        counts: { finished: 1, confirmed: 1, accepted: 1 },
      },
      // nothing confirmed → 0
      {
        requirementId: "c",
        headcount: 4,
        startsAt: "2026-12-01T08:00:00.000Z",
        endsAt: "2026-12-05T16:00:00.000Z",
        shiftCount: null,
        counts: { accepted: 2 },
      },
      // 3 seats, 2 confirmed, 2 shifts over a long envelope → 4
      {
        requirementId: "d",
        headcount: 3,
        startsAt: "2026-12-01T08:00:00.000Z",
        endsAt: "2026-12-09T16:00:00.000Z",
        shiftCount: 2,
        counts: { confirmed: 2 },
      },
    ];
    expect(coveredShifts(rows)).toBe(8);
    expect(coveredShifts([])).toBe(0);
    expect(sumCounts(rows)).toEqual({ confirmed: 4, received: 2, finished: 1, accepted: 3 });
    expect([...seatsByRequirement(rows)]).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 0],
      ["d", 2],
    ]);
  });
});
