import { describe, expect, it } from "vitest";
import { calendarDays, type CalendarDay, type CalendarWindow } from "./calendar";
import {
  cycleDay,
  cycleStates,
  emptyPreviewReason,
  planChanges,
  planCycle,
  RotationError,
  ROTATIONS,
} from "./rotation";

const W = "working";
const O = "off";

describe("cycleStates (V1.8 planning.js table)", () => {
  it("expands NxM blocks: work first, then rest", () => {
    expect(cycleStates("7x3")).toEqual([W, W, W, W, W, W, W, O, O, O]);
    expect(cycleStates("4x4")).toEqual([W, W, W, W, O, O, O, O]);
    expect(cycleStates("5x2")).toHaveLength(7);
    expect(cycleStates("15x15")).toHaveLength(30);
  });

  it("7-3 / 7-4 alternates 7 work, 3 rest, 7 work, 4 rest (21-day cycle)", () => {
    const cycle = cycleStates("7x3/7x4");
    expect(cycle).toHaveLength(21);
    expect(cycle.join(",")).toBe(
      [...Array(7).fill(W), ...Array(3).fill(O), ...Array(7).fill(W), ...Array(4).fill(O)].join(
        ",",
      ),
    );
  });

  it("named patterns match the prototype", () => {
    expect(cycleStates("2D2N4OFF")).toEqual([W, W, W, W, O, O, O, O]);
    expect(cycleStates("night")).toEqual([W, W, W, W, W, O, O]);
    expect(cycleStates("split")).toEqual([W, W, W, W, W, O, O]);
    expect(cycleStates("flexible")).toEqual([O]);
  });

  it("custom cycles take 1–31 days", () => {
    expect(cycleStates("custom", [W, O, O])).toEqual([W, O, O]);
    expect(() => cycleStates("custom", [])).toThrow(RotationError);
    expect(() => cycleStates("custom", Array(32).fill(O))).toThrow(RotationError);
  });

  it("every listed rotation fits in 31 days", () => {
    for (const r of ROTATIONS) {
      if (r === "custom") continue;
      expect(cycleStates(r).length).toBeLessThanOrEqual(31);
    }
  });
});

describe("cycleDay", () => {
  it("day 1 is the anchor; wraps forwards and backwards without UTC drift", () => {
    expect(cycleDay("7x3", "2026-11-01", "2026-11-01")).toBe(W);
    expect(cycleDay("7x3", "2026-11-01", "2026-11-08")).toBe(O);
    expect(cycleDay("7x3", "2026-11-01", "2026-11-11")).toBe(W); // day 11 = new cycle
    expect(cycleDay("7x3", "2026-11-01", "2026-10-31")).toBe(O); // the day before is the last rest day
    // Across the end of DST in Europe (2026-10-25) and a leap day.
    expect(cycleDay("4x4", "2026-10-20", "2026-10-28")).toBe(W);
    expect(cycleDay("4x4", "2028-02-27", "2028-03-01")).toBe(W); // 27, 28, 29 Feb, 1 Mar
    expect(cycleDay("4x4", "2028-02-27", "2028-03-02")).toBe(O);
  });

  it("rejects impossible dates", () => {
    expect(() => cycleDay("7x3", "2026-02-30", "2026-03-01")).toThrow(RotationError);
    expect(() => cycleDay("7x3", "2026-11-01", "1/11/2026")).toThrow(RotationError);
  });
});

describe("planCycle", () => {
  const month = "2026-11";
  const empty = calendarDays([], month);

  it("working → unavailable, rest → empty unless published; past days skipped", () => {
    const plan = planCycle(empty, "7x3", {
      anchor: "2026-11-01",
      publishRest: false,
      replace: false,
      today: "2026-11-03",
    });
    expect(plan["2026-11-01"]).toBeUndefined();
    expect(plan["2026-11-03"]).toEqual({ cycle: W, status: "unavailable" });
    expect(plan["2026-11-08"]).toEqual({ cycle: O, status: null });
    expect(Object.keys(plan)).toHaveLength(28);
    // Rest days on empty days change nothing → not sent.
    expect(planChanges(empty, plan).every((c) => c.status === "unavailable")).toBe(true);

    const published = planCycle(empty, "7x3", {
      anchor: "2026-11-01",
      publishRest: true,
      replace: false,
      today: "2026-11-01",
    });
    expect(published["2026-11-08"]).toEqual({ cycle: O, status: "available" });
    expect(planChanges(empty, published)).toHaveLength(30);
  });

  it("keeps days that already have windows unless replace is chosen", () => {
    const windows: CalendarWindow[] = [
      {
        id: "a",
        startsAt: "2026-11-08T00:00:00Z",
        endsAt: "2026-11-09T00:00:00Z",
        status: "available",
      },
      {
        id: "b",
        startsAt: "2026-11-20T08:00:00Z",
        endsAt: "2026-11-20T16:00:00Z",
        status: "available",
      },
    ];
    const days = calendarDays(windows, month);
    const opts = { anchor: "2026-11-01", publishRest: false, today: "2026-11-01" };
    const kept = planCycle(days, "7x3", { ...opts, replace: false });
    expect(kept["2026-11-08"]).toBeUndefined();
    expect(kept["2026-11-20"]).toBeUndefined();

    const replaced = planCycle(days, "7x3", { ...opts, replace: true });
    expect(replaced["2026-11-08"]).toEqual({ cycle: O, status: null });
    // A rest day over an existing window clears it → it is a real change.
    expect(planChanges(days, replaced)).toContainEqual({ date: "2026-11-08", status: null });
  });

  it("BR-4.9 / N-04: the days of a confirmed assignment are never generated, even with replace", () => {
    const windows: CalendarWindow[] = [
      {
        id: "a",
        startsAt: "2026-11-08T00:00:00Z",
        endsAt: "2026-11-11T00:00:00Z",
        status: "available",
      },
    ];
    const days = calendarDays(windows, month);
    const assigned = new Set(["2026-11-09", "2026-11-10"]);
    const opts = { anchor: "2026-11-01", publishRest: true, today: "2026-11-01", assigned };
    for (const replace of [false, true]) {
      const plan = planCycle(days, "7x3", { ...opts, replace });
      expect([replace, plan["2026-11-09"], plan["2026-11-10"]]).toEqual([
        replace,
        undefined,
        undefined,
      ]);
      expect(planChanges(days, plan).some((c) => assigned.has(c.date))).toBe(false);
    }
    // The other days of the window are still replaced (v1.8 «Reemplazar…» skips only assigned days).
    expect(planCycle(days, "7x3", { ...opts, replace: true })["2026-11-08"]).toBeDefined();
  });
});

describe("emptyPreviewReason (X-15)", () => {
  const day = (date: string) => ({ date, windows: [] }) as unknown as CalendarDay;
  it("a month entirely in the past says so; otherwise the days are already taken", () => {
    expect(emptyPreviewReason([day("2026-09-29"), day("2026-09-30")], "2026-10-22")).toBe(
      "pastMonth",
    );
    expect(emptyPreviewReason([day("2026-10-21"), day("2026-10-22")], "2026-10-22")).toBe(
      "nothingGenerated",
    );
  });
});
