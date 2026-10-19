export const AVAILABILITY_STATUSES = ["available", "unavailable"] as const;
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
 * Share of `[startsAt, endsAt)` covered by `available` windows minus `unavailable` windows
 * (BR-4: unavailable overrides available; overlapping/adjacent windows merge).
 */
export function availabilityCoverage(
  windows: AvailabilityWindow[],
  startsAt: string,
  endsAt: string,
): AvailabilityCoverage {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  const total = end - start;
  if (!(total > 0)) throw new RangeError("Period end must be after start");

  const available = clipAndMerge(
    windows.filter((w) => w.status === "available"),
    start,
    end,
  );
  const unavailable = clipAndMerge(
    windows.filter((w) => w.status === "unavailable"),
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
