// Work/rest cycle generator (V1.8 prototype `src/features/planning.js`, `ConnectedCalendar.jsx`).
// Pure: turns a rotation pattern into whole-UTC-day statuses for one month of the calendar. The
// result is only a preview until it is saved through `replace_availability_days` (one transaction).
// Mapping onto the windows model (BR-4): a working day becomes `unavailable`, a rest day is left
// empty unless the technician chooses to publish rest days as `available`.
import {
  MAX_CYCLE_DAYS,
  type AvailabilityStatus,
  type CycleDay,
  type Rotation,
} from "@/domain/availability";
import type { CalendarDay } from "./calendar";

export { MAX_CYCLE_DAYS, ROTATIONS, type CycleDay, type Rotation } from "@/domain/availability";

export type RotationErrorCode = "customLength" | "cycleTooLong" | "invalidDate";

export class RotationError extends Error {
  constructor(readonly code: RotationErrorCode) {
    super(code);
  }
}

const FIVE_ON_TWO_OFF: CycleDay[] = [
  "working",
  "working",
  "working",
  "working",
  "working",
  "off",
  "off",
];

/** One full cycle, day 1 first. Same table as the prototype. */
export function cycleStates(pattern: Rotation, custom: readonly CycleDay[] = []): CycleDay[] {
  switch (pattern) {
    case "custom":
      if (custom.length < 1 || custom.length > MAX_CYCLE_DAYS)
        throw new RotationError("customLength");
      return [...custom];
    case "flexible":
      return ["off"];
    case "night":
    case "split":
      return [...FIVE_ON_TWO_OFF];
    case "2D2N4OFF": // two day shifts, two night shifts, four days off
      return ["working", "working", "working", "working", "off", "off", "off", "off"];
    default: {
      const blocks = pattern.split("/").flatMap((part) => part.split("x").map(Number));
      if (blocks.reduce((sum, n) => sum + n, 0) > MAX_CYCLE_DAYS)
        throw new RotationError("cycleTooLong");
      return blocks.flatMap((n, i) => Array<CycleDay>(n).fill(i % 2 === 0 ? "working" : "off"));
    }
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value: string): number {
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (!DATE.test(value) || Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== value) {
    throw new RotationError("invalidDate");
  }
  return ms;
}

/** State of `date` in a cycle whose day 1 is `anchor` (both `YYYY-MM-DD`, UTC; works before it too). */
export function cycleDay(
  pattern: Rotation,
  anchor: string,
  date: string,
  custom: readonly CycleDay[] = [],
): CycleDay {
  const offset = Math.round((parseDay(date) - parseDay(anchor)) / 86_400_000);
  const cycle = cycleStates(pattern, custom);
  return cycle[((offset % cycle.length) + cycle.length) % cycle.length]!;
}

export interface PlanOptions {
  anchor: string;
  custom?: readonly CycleDay[];
  /** Publish generated rest days as `available` (otherwise they stay empty). */
  publishRest: boolean;
  /** Also overwrite days that already have windows (otherwise they are kept as they are). */
  replace: boolean;
  /** `YYYY-MM-DD` (UTC). Past days are never generated. */
  today: string;
  /**
   * UTC days of confirmed assignments (BR-4.9, v1.8 `ConnectedCalendar.jsx:10`): never generated, even
   * with `replace` — the server would refuse the whole save.
   */
  assigned?: ReadonlySet<string>;
}

export interface PlannedDay {
  /** Set when the day comes from the generator; absent for a day painted by hand. */
  cycle?: CycleDay;
  /** What the day becomes when saved; `null` = cleared / left empty. */
  status: AvailabilityStatus | null;
}

/** Preview of the cycle over the given calendar days. Days that are skipped are absent. */
export function planCycle(
  days: readonly CalendarDay[],
  pattern: Rotation,
  options: PlanOptions,
): Record<string, PlannedDay> {
  const plan: Record<string, PlannedDay> = {};
  for (const day of days) {
    if (day.date < options.today) continue;
    if (options.assigned?.has(day.date)) continue;
    if (!options.replace && day.windows.length > 0) continue;
    const cycle = cycleDay(pattern, options.anchor, day.date, options.custom);
    const status = cycle === "working" ? "unavailable" : options.publishRest ? "available" : null;
    plan[day.date] = { cycle, status };
  }
  return plan;
}

/**
 * Why a preview generated no day (X-15): the month is over (R-X L3), or every day from today already
 * has windows and «replace» is off.
 */
export const emptyPreviewReason = (days: readonly CalendarDay[], today: string) =>
  days.every((d) => d.date < today) ? ("pastMonth" as const) : ("nothingGenerated" as const);

/** Days that change something when saved (rest days on empty days are preview only). */
export function planChanges(
  days: readonly CalendarDay[],
  plan: Record<string, PlannedDay>,
): { date: string; status: AvailabilityStatus | null }[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  return Object.entries(plan)
    .filter(([date, p]) => p.status !== null || (byDate.get(date)?.windows.length ?? 0) > 0)
    .map(([date, p]) => ({ date, status: p.status }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
