// Candidate Pack access rules (D-07; CANDIDATE_PACK.md §1). Owner, 2026-10-22: P1 (contact from
// `accepted`, with its own consent), P2 (only authorised, scanned, `clean` documents, audited) and P4
// (real identity together with contact) are the ratified DIRECTION; P3 (access-log retention) is OPEN.
// PREPARED, NOT ACTIVATED: nothing calls these yet, no table, RPC or UI shares contact or documents,
// and `PACK_ACTIVATION` stays false until P3, the approved scanner (D-10) and their controls exist.
import type { ApplicationStatus } from "./applications.ts";
import {
  canShareWithThirdParties,
  documentExpiryState,
  type DocumentScanStatus,
} from "./documents.ts";

/** Kill switch: flipping a value is an owner decision (P3 + D-10), never a code default. */
export const PACK_ACTIVATION = { contact: false, documents: false } as const;
export type PackActivation = { contact: boolean; documents: boolean };

/** States in which a consent can take effect (P1: from acceptance; a cancellation locks it again). */
export const PACK_UNLOCK_STATUSES: readonly ApplicationStatus[] = ["accepted", "confirmed"];

/** The technician's two independent, revocable consents for ONE requirement and organization. */
export interface PackConsents {
  contact: boolean;
  documents: boolean;
}

/** P1 + P4: identity and contact are one permission. */
export function contactVisible(
  status: ApplicationStatus,
  consents: PackConsents,
  activation: PackActivation = PACK_ACTIVATION,
): boolean {
  return activation.contact && consents.contact && PACK_UNLOCK_STATUSES.includes(status);
}

export interface PackDocument {
  /** Selected by the technician for this application's pack. */
  selected: boolean;
  deleted: boolean;
  scanStatus: DocumentScanStatus;
  expiresAt: string | null;
}

/** P2: one document, at the moment of access (`today` = YYYY-MM-DD, UTC). */
export function documentAccessible(
  status: ApplicationStatus,
  consents: PackConsents,
  document: PackDocument,
  today: string,
  activation: PackActivation = PACK_ACTIVATION,
): boolean {
  return (
    activation.documents &&
    consents.documents &&
    PACK_UNLOCK_STATUSES.includes(status) &&
    document.selected &&
    !document.deleted &&
    canShareWithThirdParties(document) &&
    documentExpiryState(document.expiresAt, today) !== "expired"
  );
}
