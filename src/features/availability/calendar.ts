// Pure helpers that project availability windows onto a month calendar (UTC days).
// Mirrors the original prototype's per-day calendar on top of the windows model (BR-4):
// an `unavailable` window overrides `available` wherever they overlap.
import type { AvailabilityStatus } from "@/domain/availability";

export interface CalendarWindow {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AvailabilityStatus;
}

/** BR-4.8 display precedence: unavailable > aog_only > available. */
export type DayState = "available" | "unavailable" | "aog_only" | "none" | "mixed";

export interface CalendarDay {
  /** `YYYY-MM-DD` (UTC). */
  date: string;
  state: DayState;
  /** Windows touching this day. */
  windows: CalendarWindow[];
  /** True when exactly one window covers the day and it is a single-day window (safe to toggle). */
  singleDayWindow: CalendarWindow | null;
}

const DAY_MS = 86_400_000;

/** Monday-first week, the order of the calendar grids (keys of `availability.weekday.*`). */
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** Day cell colours shared by the editable calendar and the overview's read-only month. */
export const DAY_STYLE: Record<DayState, string> = {
  available: "border-ok/40 bg-ok-bg text-ok",
  unavailable: "border-line bg-canvas text-muted",
  // V1.8: AOG is orange (v11.css `.day.aog`), never the error red; a partial day is hatched (v18.css).
  aog_only: "border-warn/40 bg-warn-bg text-warn",
  mixed: "border-ok/40 bg-partial text-ok",
  none: "border-line bg-white text-muted",
};

/** `YYYY-MM` from a URL value, or null. */
export const parseMonth = (value: unknown) =>
  typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;

export const dayStart = (date: string) => Date.parse(`${date}T00:00:00Z`);
export const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Days of a month as `YYYY-MM-DD`. `month` is `YYYY-MM`. */
export function monthDays(month: string): string[] {
  const [year, m] = month.split("-").map(Number) as [number, number];
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

/** 0 = Monday … 6 = Sunday, for the first day of the month. */
export function monthOffset(month: string): number {
  return (new Date(dayStart(`${month}-01`)).getUTCDay() + 6) % 7;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function coverageOfDay(windows: CalendarWindow[], start: number, end: number): DayState {
  const covered = (status: AvailabilityStatus) =>
    windows
      .filter((w) => w.status === status)
      .map((w): [number, number] => [
        Math.max(Date.parse(w.startsAt), start),
        Math.min(Date.parse(w.endsAt), end),
      ])
      .filter(([s, e]) => e > s);
  const unavailable = covered("unavailable");
  const aogOnly = covered("aog_only");
  const available = covered("available");
  const fullDay = (ranges: [number, number][]) =>
    ranges.length > 0 &&
    ranges
      .sort((a, b) => a[0] - b[0])
      .reduce((cursor, [s, e]) => (s <= cursor ? Math.max(cursor, e) : cursor), start) >= end;
  if (fullDay(unavailable)) return "unavailable";
  if (unavailable.length > 0) return "mixed";
  if (fullDay(aogOnly)) return "aog_only";
  if (aogOnly.length > 0) return "mixed";
  if (fullDay(available)) return "available";
  if (available.length > 0) return "mixed";
  return "none";
}

export function calendarDays(windows: CalendarWindow[], month: string): CalendarDay[] {
  return monthDays(month).map((date) => {
    const start = dayStart(date);
    const end = start + DAY_MS;
    const touching = windows.filter(
      (w) => Date.parse(w.startsAt) < end && Date.parse(w.endsAt) > start,
    );
    const single =
      touching.length === 1 &&
      Date.parse(touching[0]!.startsAt) === start &&
      Date.parse(touching[0]!.endsAt) === end
        ? touching[0]!
        : null;
    return {
      date,
      state: coverageOfDay(touching, start, end),
      windows: touching,
      singleDayWindow: single,
    };
  });
}

/**
 * Past days are frozen (v1.8 parity; the batch `PUT` already refuses them): only today or later can
 * be changed from the calendar, with or without a draft. Both are `YYYY-MM-DD` (UTC).
 */
export const isDayEditable = (date: string, today: string) => date >= today;

/**
 * X-19, form only: a new window, or one whose start moves, may not start on a past UTC day. Both
 * starts are the form's minute-precision `YYYY-MM-DDTHH:mm` (R-X L2: a stored start can carry
 * seconds); `editingStart` is null for a new window.
 */
export const refusesPastStart = (formStart: string, editingStart: string | null, today: string) =>
  formStart !== editingStart && !isDayEditable(formStart.slice(0, 10), today);

/** Whole-day window boundaries for a calendar day (UTC). */
export function dayWindow(date: string): { startsAt: string; endsAt: string } {
  const start = dayStart(date);
  return {
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(start + DAY_MS).toISOString(),
  };
}

export function countDays(
  windows: CalendarWindow[],
  status: AvailabilityStatus,
  from: string,
  to: string,
) {
  let n = 0;
  for (let t = dayStart(from); t < dayStart(to); t += DAY_MS) {
    const state = coverageOfDay(
      windows.filter((w) => Date.parse(w.startsAt) < t + DAY_MS && Date.parse(w.endsAt) > t),
      t,
      t + DAY_MS,
    );
    if (state === status) n++;
  }
  return n;
}

/**
 * UTC days touched by periods (end exclusive): confirmed assignments (D-06 «Asignación», v1.8
 * «Asignado») or opportunities. Since N-04 (BR-4.9, T-15) the days of a `confirmed` assignment are
 * protected: not editable here and refused by the server (only `confirmed`, T-16).
 */
export function assignmentDays(assignments: readonly { startsAt: string; endsAt: string }[]) {
  const days = new Set<string>();
  for (const a of assignments) {
    const end = Date.parse(a.endsAt);
    for (let t = dayStart(a.startsAt.slice(0, 10)); t < end; t += DAY_MS)
      days.add(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

/**
 * A calendar day can be changed: today or later (v1.8 parity) and not a day of a confirmed
 * assignment (BR-4.9, v1.8 «Una asignación confirmada está protegida.»).
 */
export const canEditDay = (date: string, today: string, assigned: ReadonlySet<string>) =>
  isDayEditable(date, today) && !assigned.has(date);

/** The mini calendar's «Asignado» cell (v1.8 `.mini-day.assigned`), over any day state. */
export const ASSIGNED_STYLE = "border-blue/40 bg-info-bg text-blue";
