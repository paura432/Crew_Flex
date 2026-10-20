// Application state machine — the D-06 contract (docs/product/APPLICATIONS_STATE_MACHINE.md §1–2),
// derived from V1.8 `server/app.mjs:115-117`. PURE TABLE ONLY: no migration, Edge Function or UI uses
// it before the owner ratifies the contract (§4.1). Rows that depend on an owner proposal that is not
// ratified yet carry its id in `pending`; R-08 (new proposal version after acceptance) is decided.

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
  /** Owner proposal not ratified yet (§4): the row must not be activated. */
  pending?: "Q2" | "Q3" | "Q4";
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
  { from: "accepted", to: "cancelled", actor: "organization", reason: true, pending: "Q2" },
  { from: "confirmed", to: "finished", actor: "organization", pending: "Q4" },
  { from: "confirmed", to: "cancelled", actor: "organization", reason: true, pending: "Q3" },
  { from: "confirmed", to: "cancelled", actor: "technician", reason: true, pending: "Q3" },
];

export const TERMINAL_APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "finished",
  "rejected",
  "withdrawn",
  "cancelled",
];

/** The allowed transition for this actor, or undefined (→ 409 / 403 at the API). */
export const findApplicationTransition = (
  from: ApplicationStatus,
  to: ApplicationStatus,
  actor: ApplicationActor,
) => APPLICATION_TRANSITIONS.find((t) => t.from === from && t.to === to && t.actor === actor);
