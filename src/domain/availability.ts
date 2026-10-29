import type { Urgency } from "./work-requirement.ts";

/**
 * `aog_only` (owner decision C-8 / D-05, 2026-10-19): available exclusively for requirements whose
 * declared urgency is `aog`. BR-4.8 precedence: unavailable > aog_only > available.
 */
export const AVAILABILITY_STATUSES = ["available", "unavailable", "aog_only"] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

/** Work/rest rotation patterns of the cycle generator (BR-4.7; V1.8 `planning.js` ROTATIONS). */
export const ROTATIONS = [
  "7x3",
  "7x4",
  "5x2",
  "7x3/7x4",
  "6x4",
  "5x5",
  "4x4",
  "10x10",
  "15x15",
  "custom",
  "2D2N4OFF",
  "night",
  "split",
  "flexible",
] as const;
export type Rotation = (typeof ROTATIONS)[number];
export const CYCLE_DAYS = ["working", "off"] as const;
export type CycleDay = (typeof CYCLE_DAYS)[number];
export const MAX_CYCLE_DAYS = 31;

export interface AvailabilityWindow {
  startsAt: string;
  endsAt: string;
  status: AvailabilityStatus;
}

export interface AvailabilityCoverage {
  /** 0–100, rounded to 2 decimals. */
  coveredPercent: number;
  fullyCovered: boolean;
}

type Interval = [start: number, end: number];

function clipAndMerge(windows: AvailabilityWindow[], start: number, end: number): Interval[] {
  const clipped = windows
    .map((w): Interval => [
      Math.max(Date.parse(w.startsAt), start),
      Math.min(Date.parse(w.endsAt), end),
    ])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const merged: Interval[] = [];
  for (const interval of clipped) {
    const last = merged.at(-1);
    if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
    else merged.push([...interval]);
  }
  return merged;
}

function overlapLength(a: Interval[], b: Interval[]): number {
  let total = 0;
  for (const [as, ae] of a) {
    for (const [bs, be] of b) total += Math.max(0, Math.min(ae, be) - Math.max(as, bs));
  }
  return total;
}

/**
 * BR-4.8: what each window means for a requirement of the given urgency. `aog_only` adds
 * availability for AOG requirements and blocks every other one; `unavailable` always blocks.
 * The SQL prefilter (`app_private.ranked_external_pool`, migration 20261019150100) mirrors this.
 */
export function effectiveStatus(
  status: AvailabilityStatus,
  urgency: Urgency,
): "available" | "unavailable" {
  if (status === "aog_only") return urgency === "aog" ? "available" : "unavailable";
  return status;
}

/**
 * Share of `[startsAt, endsAt)` covered by effective `available` windows minus effective
 * `unavailable` ones (BR-4: unavailable overrides; BR-4.8: `aog_only` by urgency; windows merge).
 */
export function availabilityCoverage(
  windows: AvailabilityWindow[],
  startsAt: string,
  endsAt: string,
  urgency: Urgency,
): AvailabilityCoverage {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  const total = end - start;
  if (!(total > 0)) throw new RangeError("Period end must be after start");

  const available = clipAndMerge(
    windows.filter((w) => effectiveStatus(w.status, urgency) === "available"),
    start,
    end,
  );
  const unavailable = clipAndMerge(
    windows.filter((w) => effectiveStatus(w.status, urgency) === "unavailable"),
    start,
    end,
  );
  const covered =
    available.reduce((sum, [s, e]) => sum + (e - s), 0) - overlapLength(available, unavailable);

  return {
    coveredPercent: Math.round((covered / total) * 10_000) / 100,
    fullyCovered: covered === total,
  };
}

/**
 * BR-4.9 (N-04, v1.8 connected `server/connected.mjs:22` and `server/app.mjs:67`): stable reasons of a
 * refused availability write (409 `reason`). The SQL raises them as SQLSTATE `CFV01`… in this order
 * (`supabase/functions/_shared/errors.ts`), a family apart from `APPLICATION_CONFLICTS` (`CFA..`).
 */
export const AVAILABILITY_CONFLICTS = [
  "ASSIGNMENT_PROTECTED", // CFV01: a day of a confirmed assignment, or availability it needs, would change
] as const;
export type AvailabilityConflict = (typeof AVAILABILITY_CONFLICTS)[number];

/**
 * N-26 (BR-4.6, migration 20261024200100): the SQL `hint` of the 22023 raised when a single window is
 * created, or its start moved, before today (UTC). Old functions map that 22023 to a plain 400; the
 * current one turns this hint into the form's own field error (`v.start.future`).
 */
export const PAST_START_HINT = "past_start";

const AVAILABILITY_BLOCKERS = new Set(["NOT_AVAILABLE", "PARTIAL_AVAILABILITY"]);

/**
 * BR-14.1, v1.8 «Posible en descanso» (demo `homeModel.js:6-15`): the professional meets every other
 * rule (only availability blockers) and the period would be fully covered if every part of it with no
 * window at all — a private rest day — were published as `available`. Blocked time (`unavailable`, or
 * `aog_only` for a need that is not AOG; BR-4.2/BR-4.8) is never treated as rest. A hint for the
 * professional only: it never makes anyone eligible (BR-3).
 */
export function possibleOnRest(
  match: { eligible: boolean; blockers: readonly { code: string }[] },
  windows: readonly AvailabilityWindow[],
  period: { startsAt: string; endsAt: string; urgency: Urgency },
): boolean {
  if (match.eligible || match.blockers.length === 0) return false;
  if (!match.blockers.every((b) => AVAILABILITY_BLOCKERS.has(b.code))) return false;
  const start = Date.parse(period.startsAt);
  const end = Date.parse(period.endsAt);
  return !windows.some(
    (w) =>
      effectiveStatus(w.status, period.urgency) === "unavailable" &&
      Date.parse(w.startsAt) < end &&
      Date.parse(w.endsAt) > start,
  );
}
