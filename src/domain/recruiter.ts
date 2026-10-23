// Recruiter = a staffing agency that represents clients (D-12 provisional model, docs/product/RECRUITER_MODEL.md;
// BUSINESS_RULES BR-27, technical defaults T-130…T-136). Pure: no I/O, no framework imports. Shared by Next.js and
// the Supabase Edge Functions. The database enforces every rule on its own (LOCAL 20261024500000/500100); these
// functions only let the screens say the same thing before a request is sent.
import type { ApplicationStatus } from "./applications.ts";
import type { OrganizationType } from "./organization.ts";

/** Mirrors the database enum `representation_status`. */
export const REPRESENTATION_STATUSES = ["pending", "active", "revoked"] as const;
export type RepresentationStatus = (typeof REPRESENTATION_STATUSES)[number];

/** v1.8 «Nuevo cliente» (required) and «Correo del cliente» (optional), `Company2.jsx:211`. */
export const CLIENT_NAME_MIN = 2;
export const CLIENT_NAME_MAX = 120;
export const CLIENT_EMAIL_MAX = 254;
/** Evidence a platform admin records to activate a representation (as the organization review, BR-20). */
export const REPRESENTATION_NOTE_MAX = 2000;
/** Pending + active clients one agency may hold at once (T-131); revoked ones do not count. */
export const MAX_LIVE_CLIENTS = 200;

/**
 * The database refusals of this module, SQLSTATE `CFR01`… in this order (`_shared/errors.ts` maps them):
 * an agency publishing without a client, and an action for a client whose representation is not active.
 */
export const RECRUITER_CONFLICTS = ["CLIENT_REQUIRED", "CLIENT_NOT_ACTIVE"] as const;
export type RecruiterConflict = (typeof RECRUITER_CONFLICTS)[number];

/** BR-27.1: only a staffing agency represents clients (the organization type of the sign-up, es «Agencia de personal»). */
export const isStaffingAgency = (type: OrganizationType | null | undefined) =>
  type === "staffing_agency";

/**
 * BR-27.3 (v1.8 `Company2.jsx:103`): a staffing agency publishes only for a represented client — «Selecciona un
 * cliente.». A draft may wait for it (v1.8 asks for the client only when publishing).
 */
export const clientRequired = (
  type: OrganizationType | null | undefined,
  intent: "draft" | "publish" | undefined,
) => isStaffingAgency(type) && intent !== "draft";

/** BR-27.2: acting for a client (publish, resume, apply, shortlist, propose, accept, confirm) needs `active`. */
export const canActForClient = (status: RepresentationStatus) => status === "active";

/**
 * BR-27.5: the application steps that move forward and so act for the client; withdraw, reject, cancel and
 * finish stay possible after a revocation (an agency winds down, the history stays true).
 */
export const ADVANCING_APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "received",
  "shortlisted",
  "proposed",
  "accepted",
  "confirmed",
];

/**
 * BR-27.2: a platform admin activates a `pending` representation with evidence, never one of an agency they
 * belong to (as the organization review, BR-20). `activate_represented_client` enforces the same.
 */
export function activationBlocker(
  client: { status: RepresentationStatus },
  reviewerIsMember: boolean,
): "own" | "notPending" | null {
  if (reviewerIsMember) return "own";
  if (client.status !== "pending") return "notPending";
  return null;
}

/** Revoking is the agency's own act and is final (T-130); a revoked client is added again as a new one. */
export const canRevoke = (status: RepresentationStatus) => status !== "revoked";
