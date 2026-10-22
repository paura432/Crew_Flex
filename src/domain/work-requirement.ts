export const SHIFTS = ["day", "night", "split", "flexible"] as const;
export type Shift = (typeof SHIFTS)[number];

export const URGENCIES = ["planned", "urgent", "aog"] as const;
export type Urgency = (typeof URGENCIES)[number];

// `cancelled` is a legacy value no transition reaches any more (M05, T-14); `paused` is v1.8's «Pausada».
export const REQUIREMENT_STATUSES = [
  "draft",
  "open",
  "paused",
  "covered",
  "cancelled",
  "closed",
] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const REQUIREMENT_LEVELS = ["hard", "soft"] as const;
export type RequirementLevel = (typeof REQUIREMENT_LEVELS)[number];

export const HEADCOUNT_MAX = 50;
export const MAX_REQUIREMENT_DAYS = 366;

export interface RequiredQualification {
  qualificationTypeId: string;
  code: string;
  name: string;
  level: RequirementLevel;
}

export interface WorkRequirement {
  id: string;
  organizationId: string;
  title: string;
  location: string;
  startsAt: string;
  endsAt: string;
  shift: Shift;
  headcount: number;
  urgency: Urgency;
  status: RequirementStatus;
  createdAt: string;
  /**
   * Optimistic version for the edit (`work-requirements` PUT `expectedUpdatedAt`, ms precision; M05).
   * Optional: absent from functions older than the edit and from hand-built fixtures.
   */
  updatedAt?: string;
  qualifications: RequiredQualification[];
}

/**
 * V1.8 «Vencida» (`business.js` `effectiveStatus`): an open requirement whose period has ended (BR-10:
 * UTC instants). Display only — derived at read time, never stored, never a transition; closing stays
 * an explicit action (BR-1.9).
 */
export const isExpired = (r: Pick<WorkRequirement, "status" | "endsAt">, nowMs: number) =>
  r.status === "open" && Date.parse(r.endsAt) <= nowMs;

/**
 * Status changes allowed on a requirement (M05, owner 2026-10-22; BR-1.9): open ↔ paused, a draft is
 * opened, anything not closed may be closed; `closed` is terminal. `covered` comes and goes with
 * confirmed applications only (D-06). Mirrored by `guard_requirement_status` (rls suite S).
 */
export function canChangeRequirementStatus(from: RequirementStatus, to: RequirementStatus) {
  if (from === "closed" || from === to) return false;
  return (
    to === "closed" ||
    (from === "open" && to === "paused") ||
    (from === "paused" && to === "open") ||
    (from === "draft" && to === "open")
  );
}

/** V1.8 evaluates and publishes `published` jobs only: paused and closed needs have no candidate pool. */
export const isEvaluable = (r: Pick<WorkRequirement, "status">) =>
  r.status !== "paused" && r.status !== "closed";
