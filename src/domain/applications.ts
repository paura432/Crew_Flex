// Application state machine — the D-06 contract (docs/product/APPLICATIONS_STATE_MACHINE.md §1–2),
// derived from V1.8 `server/app.mjs:115-117`, ratified by the owner on 2026-10-22 (Q2–Q6, Q7 = no
// `accepted → rejected`, R-08). One table, imported by the UI and the Edge Functions and mirrored by
// `app_private.application_transitions` (rls suite T1 compares both). Pure: no I/O.
import type { RequirementStatus, WorkRequirement } from "./work-requirement.ts";

export const APPLICATION_STATUSES = [
  "received",
  "shortlisted",
  "proposed",
  "accepted",
  "confirmed",
  "finished",
  "rejected",
  "withdrawn",
  "cancelled",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Who acts — always derived from the JWT (technician = the applicant, organization = admin/manager). */
export type ApplicationActor = "technician" | "organization";

export interface ApplicationTransition {
  from: ApplicationStatus;
  to: ApplicationStatus;
  actor: ApplicationActor;
  /** A 1–1000 character reason is required (V1.8 A:134: reject and cancel only). */
  reason?: true;
}

export const APPLICATION_TRANSITIONS: readonly ApplicationTransition[] = [
  { from: "received", to: "shortlisted", actor: "organization" },
  { from: "received", to: "rejected", actor: "organization", reason: true },
  { from: "received", to: "withdrawn", actor: "technician" },
  { from: "shortlisted", to: "proposed", actor: "organization" },
  { from: "shortlisted", to: "rejected", actor: "organization", reason: true },
  { from: "shortlisted", to: "withdrawn", actor: "technician" },
  { from: "proposed", to: "accepted", actor: "technician" },
  { from: "proposed", to: "rejected", actor: "organization", reason: true },
  { from: "proposed", to: "withdrawn", actor: "technician" },
  { from: "accepted", to: "proposed", actor: "organization" }, // R-08: a new proposal version
  { from: "accepted", to: "confirmed", actor: "organization" },
  { from: "accepted", to: "withdrawn", actor: "technician" },
  // Q7 (owner 2026-10-22): never accepted → rejected; the organization cancels with a reason (Q2).
  { from: "accepted", to: "cancelled", actor: "organization", reason: true },
  { from: "confirmed", to: "finished", actor: "organization" }, // Q4: explicit, after the period
  { from: "confirmed", to: "cancelled", actor: "organization", reason: true }, // Q3
  { from: "confirmed", to: "cancelled", actor: "technician", reason: true }, // Q3, no penalties
];

export const TERMINAL_APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "finished",
  "rejected",
  "withdrawn",
  "cancelled",
];

/** Statuses that hold a seat or a commitment: closing the requirement is refused while any exists (T-12). */
export const COMMITTED_APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "accepted",
  "confirmed",
];

export const REASON_MAX = 1000;

/** The allowed transition for this actor, or undefined (→ 409 / 403 at the API). */
export const findApplicationTransition = (
  from: ApplicationStatus,
  to: ApplicationStatus,
  actor: ApplicationActor,
) => APPLICATION_TRANSITIONS.find((t) => t.from === from && t.to === to && t.actor === actor);

/** What this actor may do from this status — the buttons the UI shows (the server re-checks). */
export const availableTransitions = (from: ApplicationStatus, actor: ApplicationActor) =>
  APPLICATION_TRANSITIONS.filter((t) => t.from === from && t.actor === actor);

/**
 * Stable reasons the API returns with a 409 (`reason` in the error body), one per server check.
 * The SQL functions raise them as SQLSTATE `CFA01`…`CFA15` (`_shared/errors.ts` maps them). Append only:
 * the position is the code.
 */
export const APPLICATION_CONFLICTS = [
  "REQUIREMENT_NOT_OPEN", // CFA01: paused, closed, covered or not published
  "REQUIREMENT_STARTED", // CFA02: the period has started (apply, propose, confirm)
  "QUALIFICATION_INVALID", // CFA03: a hard qualification is missing, unverified or expires
  "AVAILABILITY_INCOMPLETE", // CFA04: availability does not cover the whole period (BR-4.8)
  "OVERLAPPING_ASSIGNMENT", // CFA05: another confirmed assignment overlaps the period
  "HEADCOUNT_REACHED", // CFA06: every seat is confirmed
  "PROPOSAL_STALE", // CFA07: the accepted version is not the current proposal (R-08)
  "PERIOD_NOT_ENDED", // CFA08: finish before the last day ended (Q4)
  "ALREADY_APPLIED", // CFA09: an application of this technician is active
  "REAPPLY_NOT_ALLOWED", // CFA10: only after `withdrawn` (Q5, T-09)
  "ACTIVE_COMMITMENTS", // CFA11: closing with accepted/confirmed applications (T-12)
  "HAS_APPLICATIONS", // CFA12: editing a requirement that received applications (M05)
  "OWN_ORGANIZATION", // CFA13: applying to a requirement of an own organization (v2-27, T-90)
  // CFA14: apply or confirm while a v1.8 profile requirement fails (work permit, category, aircraft, type
  // rating, engines, years, capabilities; BR-3.7–3.13, trigger applications_profile_rules)
  "PROFILE_REQUIREMENTS_UNMET",
  "RESTRICTIONS_DECLARED", // CFA15: confirm while the professional declares general restrictions (T-87)
  // CFA16: applying to a requirement of an organization the professional blocked in the passport (v2-16, T-160;
  // v1.8 «Esta organización está bloqueada.»). Checked after the requirement's state, before the history.
  "ORGANIZATION_BLOCKED",
] as const;
export type ApplicationConflict = (typeof APPLICATION_CONFLICTS)[number];

/** Why this technician cannot apply now, before asking the server (it re-checks everything). */
export type ApplyBlocker =
  | "REQUIREMENT_NOT_OPEN"
  | "REQUIREMENT_STARTED"
  | "ALREADY_APPLIED"
  | "REAPPLY_NOT_ALLOWED"
  | "NOT_ELIGIBLE";

/**
 * Apply rules (D-06 Q5/Q6, T-08, T-09): the requirement is open and has not started; the technician
 * has no application that is not withdrawn (one that ended rejected, cancelled or finished closes the
 * door); and is eligible now (hard qualifications, the v1.8 profile requirements and availability).
 */
export function applyBlocker(
  requirement: Pick<WorkRequirement, "startsAt"> & { status: RequirementStatus },
  ownStatuses: readonly ApplicationStatus[],
  eligible: boolean,
  nowMs: number,
): ApplyBlocker | null {
  if (requirement.status !== "open") return "REQUIREMENT_NOT_OPEN";
  if (Date.parse(requirement.startsAt) <= nowMs) return "REQUIREMENT_STARTED";
  const others = ownStatuses.filter((s) => s !== "withdrawn");
  if (others.some((s) => !TERMINAL_APPLICATION_STATUSES.includes(s))) return "ALREADY_APPLIED";
  if (others.length > 0) return "REAPPLY_NOT_ALLOWED";
  if (!eligible) return "NOT_ELIGIBLE";
  return null;
}

/** Q4: an assignment can be finished only once the requirement's period has ended. */
export const canFinish = (requirement: Pick<WorkRequirement, "endsAt">, nowMs: number) =>
  Date.parse(requirement.endsAt) <= nowMs;
