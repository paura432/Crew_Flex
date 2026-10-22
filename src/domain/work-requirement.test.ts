import { describe, expect, it } from "vitest";
import {
  baseAmount,
  canArchive,
  canChangeRequirementStatus,
  dayRate,
  duplicateSchedule,
  isEvaluable,
  isExpired,
  localDate,
  periodDays,
  requiredShiftDays,
  REQUIREMENT_STATUSES,
  shiftEnvelope,
  shiftIssues,
  totalBaseHours,
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

  it("drafts (v2-14), paused and closed needs are not evaluated (no candidate pool)", () => {
    expect(REQUIREMENT_STATUSES.filter((status) => !isEvaluable({ status }))).toEqual([
      "draft",
      "paused",
      "closed",
    ]);
  });
});

// --- Requirement builder (v2-09 shifts, v2-12 terms, v2-14 archive and duplicate) ----------------------

const shift = (startsAt: string, endsAt: string, baseHours: number) => ({
  startsAt,
  endsAt,
  baseHours,
});
// v2-09 acceptance: 10, 11 and 12 November 08–16 UTC (Europe/Madrid).
const NOV = [10, 11, 12].map((d) =>
  shift(`2026-11-${d}T08:00:00.000Z`, `2026-11-${d}T16:00:00.000Z`, 8),
);
const NOV_PERIOD = { startsAt: "2026-11-10T08:00:00.000Z", endsAt: "2026-11-12T16:00:00.000Z" };

describe("shifts (v1.8 ShiftEditor / validateJob)", () => {
  it("three days 08–16 are valid: 24 base hours in 3 shifts, the period is their envelope", () => {
    expect(shiftIssues(NOV, "Europe/Madrid")).toEqual([]);
    expect(totalBaseHours(NOV)).toBe(24);
    expect(shiftEnvelope([...NOV].reverse())).toEqual(NOV_PERIOD);
    expect(shiftEnvelope([])).toBeNull();
  });

  it("refuses overlaps, a second shift on one local date, > 24 h and base hours above the duration", () => {
    const first = NOV[0]!;
    expect(
      shiftIssues([first, shift("2026-11-10T15:00:00.000Z", "2026-11-10T20:00:00.000Z", 5)], "UTC"),
    ).toEqual([{ index: 1, issue: "overlap" }]);
    expect(
      shiftIssues([first, shift("2026-11-10T17:00:00.000Z", "2026-11-10T20:00:00.000Z", 3)], "UTC"),
    ).toEqual([{ index: 1, issue: "sameLocalDay" }]);
    expect(
      shiftIssues([shift("2026-11-10T08:00:00.000Z", "2026-11-11T09:00:00.000Z", 8)], "UTC"),
    ).toEqual([{ index: 0, issue: "tooLong" }]);
    expect(
      shiftIssues([shift("2026-11-10T08:00:00.000Z", "2026-11-10T12:00:00.000Z", 5)], "UTC"),
    ).toEqual([{ index: 0, issue: "hoursExceed" }]);
    expect(
      shiftIssues([shift("2026-11-10T08:00:00.000Z", "2026-11-10T12:00:00.000Z", 0.2)], "UTC"),
    ).toEqual([{ index: 0, issue: "hours" }]);
    expect(
      shiftIssues([shift("2026-11-10T12:00:00.000Z", "2026-11-10T08:00:00.000Z", 1)], "UTC"),
    ).toContainEqual({ index: 0, issue: "endBeforeStart" });
  });

  it("tells local dates apart in the requirement's zone (23:30Z is the next day in Madrid)", () => {
    expect(localDate("2026-11-10T23:30:00.000Z", "Europe/Madrid")).toBe("2026-11-11");
    expect(localDate("2026-11-10T23:30:00.000Z", "UTC")).toBe("2026-11-10");
    const pair = [
      shift("2026-11-10T08:00:00.000Z", "2026-11-10T10:00:00.000Z", 2),
      shift("2026-11-10T23:30:00.000Z", "2026-11-11T01:00:00.000Z", 1.5),
    ];
    expect(shiftIssues(pair, "Europe/Madrid")).toEqual([]);
    expect(shiftIssues(pair, null)).toEqual([{ index: 1, issue: "sameLocalDay" }]); // no zone = UTC
  });

  it("caps the list at 366", () => {
    const many = Array.from({ length: 367 }, (_, i) => {
      const day = new Date(Date.UTC(2027, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
      return shift(`${day}T08:00:00.000Z`, `${day}T09:00:00.000Z`, 1);
    });
    expect(shiftIssues(many, "UTC")).toEqual([{ index: -1, issue: "tooMany" }]);
    expect(shiftIssues(many.slice(0, 366), "UTC")).toEqual([]);
  });
});

describe("v1.8 summary figures", () => {
  it("«{n} jornadas requeridas»: shifts × people, or the UTC days of a continuous period", () => {
    expect(requiredShiftDays({ ...NOV_PERIOD, headcount: 2, shifts: NOV })).toBe(6);
    expect(requiredShiftDays({ ...NOV_PERIOD, headcount: 2, shifts: null })).toBe(6);
    expect(periodDays("2026-11-10T08:00:00.000Z", "2026-11-11T00:00:00.000Z")).toBe(1);
    expect(periodDays("2026-11-10T22:00:00.000Z", "2026-11-11T06:00:00.000Z")).toBe(2);
  });

  it("day rate and the base amount are informative and need their inputs", () => {
    expect(dayRate({ hourlyRate: 50, shiftHours: 8 })).toBe(400);
    expect(dayRate({ hourlyRate: 50 })).toBeNull();
    expect(dayRate(null)).toBeNull();
    expect(baseAmount({ shifts: NOV, conditions: { hourlyRate: 50 } })).toEqual({
      hours: 24,
      hourlyRate: 50,
      amount: 1200,
    });
    expect(baseAmount({ shifts: null, conditions: { hourlyRate: 50 } })).toBeNull();
    expect(baseAmount({ shifts: NOV, conditions: {} })).toBeNull();
  });
});

describe("archive and duplicate (v2-14, T-64/T-65)", () => {
  it("archives closed requirements and drafts, once", () => {
    expect(canArchive({ status: "closed" })).toBe(true);
    expect(canArchive({ status: "draft" })).toBe(true);
    expect(canArchive({ status: "closed", archivedAt: "2026-10-22T10:00:00.000Z" })).toBe(false);
    for (const status of ["open", "paused", "covered", "cancelled"] as const)
      expect(canArchive({ status })).toBe(false);
  });

  it("a copy starts 45 days from today at the same UTC time, same duration and shift pattern", () => {
    const now = Date.parse("2026-10-22T17:45:00.000Z");
    const copy = duplicateSchedule(
      { title: "B1.1 · A320 support", ...NOV_PERIOD, shifts: NOV, headcount: 2 },
      now,
      "Copia · ",
    );
    expect(copy.title).toBe("Copia · B1.1 · A320 support");
    expect(copy.startsAt).toBe("2026-12-06T08:00:00.000Z");
    expect(copy.endsAt).toBe("2026-12-08T16:00:00.000Z");
    expect(copy.shifts?.map((s) => s.startsAt)).toEqual([
      "2026-12-06T08:00:00.000Z",
      "2026-12-07T08:00:00.000Z",
      "2026-12-08T08:00:00.000Z",
    ]);
    expect(copy.headcount).toBe(2);
    expect(totalBaseHours(copy.shifts!)).toBe(24);
    const long = duplicateSchedule({ title: "x".repeat(120), ...NOV_PERIOD }, now, "Copy · ");
    expect(long.title).toHaveLength(120);
  });
});
