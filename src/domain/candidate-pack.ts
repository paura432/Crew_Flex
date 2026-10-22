// Candidate Pack access rules (D-07; CANDIDATE_PACK.md §1). Owner, 2026-10-22: P1 (contact from
// `accepted`, with its own consent), P2 (only authorised, scanned, `clean` documents, audited) and P4
// (real identity together with contact) are the ratified DIRECTION; P3 (access-log retention) is OPEN.
// PREPARED, NOT ACTIVATED: no table, RPC or UI shares contact or documents, and `PACK_ACTIVATION` stays
// false until P3, the approved scanner (D-10) and their controls exist.
//
// What IS shared (v2-15 + v2-04, LOCAL, BR-25, T-110…T-116): the dated copy of the professional's technical
// profile frozen when they apply (`application_packs`, migration 20261024300000) — never identity, contact,
// employer, blocks or documents. The view consults `packWithheld()` below, i.e. `PACK_ACTIVATION`.
import type { ApplicationStatus } from "./applications.ts";
import {
  canShareWithThirdParties,
  documentExpiryState,
  type DocumentScanStatus,
  type ExpiryState,
} from "./documents.ts";
import type { LogbookCategory, LogbookEnvironment } from "./logbook.ts";
import type { QualificationCategory, VerificationStatus } from "./qualification.ts";

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

// --- The dated copy (v2-15 + v2-04) --------------------------------------------------------------------

/**
 * v2-04 (T-112): the logbook entries marked «Seleccionable para expediente» and not archived when the
 * professional applies, newest first, at most this many (the database builder and its CHECK repeat it).
 */
export const PACK_EXPERIENCE_MAX = 20;

/** A catalog qualification as it stood when the copy was made (active ones only). */
export interface PackQualification {
  code: string;
  name: string;
  category: QualificationCategory;
  verificationStatus: VerificationStatus;
  /** `YYYY-MM-DD` or null. */
  expiresAt: string | null;
}

/** A selected logbook entry as it stood when the copy was made (no id: the copy is not a link). */
export interface PackExperience {
  /** `YYYY-MM-DD`. */
  date: string;
  aircraft: string;
  ata: string | null;
  hours: number;
  category: LogbookCategory;
  environment: LogbookEnvironment;
  description: string;
}

/**
 * T-113: withdrawing deletes the copy (v1.8 kept it, ✗ MKT-05 #14); every other status keeps it, so both
 * parties may open it. (An application sent before the copies existed has none: the read says so.)
 */
export const hasPackCopy = (status: ApplicationStatus): boolean => status !== "withdrawn";

/**
 * What the copy must declare as withheld while D-07 is not activated: identity and contact (P1/P4) and
 * documents (P2). The database never returns them; the view says so whenever this is true.
 */
export function packWithheld(activation: PackActivation = PACK_ACTIVATION): boolean {
  return !activation.contact || !activation.documents;
}

/** v1.8 «Cursos» are the TRAINING qualifications; «Cualificaciones», every other category. */
export function splitPackQualifications(qualifications: readonly PackQualification[]): {
  courses: PackQualification[];
  others: PackQualification[];
} {
  return {
    courses: qualifications.filter((q) => q.category === "TRAINING"),
    others: qualifications.filter((q) => q.category !== "TRAINING"),
  };
}

/**
 * v1.8 course state («Sin caducidad / Caducado / Caduca pronto / Vigente», `documentStatus`), computed when
 * the copy is read from the expiry the copy froze (`today` = YYYY-MM-DD, UTC).
 */
export const packCourseState = (course: PackQualification, today: string): ExpiryState =>
  documentExpiryState(course.expiresAt, today);
