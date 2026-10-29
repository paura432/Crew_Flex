// Confirmed coverage of requirements (BR-23; v1.8 `business.js:121-132` `coverage()`, `Company2.jsx:162`,
// `Dashboard.jsx` «Jornadas cubiertas»). Pure: shared by the pages and the tests. A seat is taken by a
// `confirmed` or `finished` application — the same rule the confirm step and the `covered` status use
// (`transition_application`, D-06). Next has one period per requirement (Q6), so every seat covers all
// of it.
import type { ApplicationStatus } from "./applications.ts";

/** v1.8 counts «Confirmada» and «Finalizada» as filled; so does the seat check of the confirm step. */
export const SEAT_STATUSES = [
  "confirmed",
  "finished",
] as const satisfies readonly ApplicationStatus[];

export type StatusCounts = Partial<Record<ApplicationStatus, number>>;

/** Seats taken by these applications (confirmed + finished). */
export const seatsTaken = (counts: StatusCounts) =>
  SEAT_STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0);

/** Per-status counts of a list of applications. */
export function countStatuses(
  applications: readonly { status: ApplicationStatus }[],
): StatusCounts {
  const counts: StatusCounts = {};
  for (const { status } of applications) counts[status] = (counts[status] ?? 0) + 1;
  return counts;
}

export interface ConfirmedCoverage {
  /** Seats filled, never above the headcount. */
  filled: number;
  /** The requirement's headcount. */
  total: number;
  /** 0–100, rounded as v1.8 (`Math.round(filled / max(1, total) × 100)`). */
  percent: number;
}

/** «{percent}% cobertura confirmada» of one requirement. */
export function confirmedCoverage(headcount: number, seats: number): ConfirmedCoverage {
  const total = Math.max(0, headcount);
  const filled = Math.min(Math.max(0, seats), total);
  return { filled, total, percent: Math.round((filled / Math.max(1, total)) * 100) };
}

const DAY_MS = 86_400_000;

/**
 * Working days («jornadas») a seat covers, for «Jornadas cubiertas» (T-92): its shifts (v2-09) when it has
 * them; a continuous period counts its started 24-hour blocks, at least one: 08:00–16:00 → 1; 10 Nov 08:00 →
 * 12 Nov 16:00 → 3; one night 22:00–06:00 → 1.
 *
 * NOT the same rule as `requirementDays` in `work-requirement.ts` («{n} días» of the cards, BR-10 / T-164),
 * which counts the UTC calendar days the period touches: that night is 2 days there and 1 block here. Both
 * are v1.8 literals for different figures (`Dashboard.jsx` KPI vs `Marketplace.jsx:90` card), so they stay
 * two functions on purpose (P10 review of the P05 nit); `coverage.test.ts` pins the divergent case.
 */
export const coverageDays = (startsAt: string, endsAt: string, shiftCount?: number | null) =>
  shiftCount ?? Math.max(1, Math.ceil((Date.parse(endsAt) - Date.parse(startsAt)) / DAY_MS));

export interface RequirementCounts {
  requirementId: string;
  headcount: number;
  startsAt: string;
  endsAt: string;
  /** Number of shifts; null = one continuous period. */
  shiftCount: number | null;
  counts: StatusCounts;
}

/**
 * v1.8 «Jornadas cubiertas · Solo asignaciones confirmadas»: Σ filled seats × days of each requirement
 * (one application covers every shift, D-06 Q6).
 */
export const coveredShifts = (rows: readonly RequirementCounts[]) =>
  rows.reduce(
    (sum, r) =>
      sum +
      confirmedCoverage(r.headcount, seatsTaken(r.counts)).filled *
        coverageDays(r.startsAt, r.endsAt, r.shiftCount),
    0,
  );

/** Per-status counts summed over several requirements (the organization-wide counters). */
export function sumCounts(rows: readonly { counts: StatusCounts }[]): StatusCounts {
  const total: StatusCounts = {};
  for (const { counts } of rows)
    for (const [status, n] of Object.entries(counts) as [ApplicationStatus, number][])
      total[status] = (total[status] ?? 0) + n;
  return total;
}

/** Seats taken per requirement id, for the lists. */
export const seatsByRequirement = (rows: readonly RequirementCounts[]) =>
  new Map(rows.map((r) => [r.requirementId, seatsTaken(r.counts)]));
