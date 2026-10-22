// Edge Function response contracts. Type-only module shared by Next.js and the Deno functions.
// Envelope: docs/architecture/EDGE_FUNCTIONS.md
import type {
  ApplicationActor,
  ApplicationConflict,
  ApplicationStatus,
  ApplyBlocker,
} from "../domain/applications.ts";
import type {
  AvailabilityConflict,
  AvailabilityStatus,
  CycleDay,
  Rotation,
} from "../domain/availability.ts";
import type { CapacityResult } from "../domain/capacity.ts";
import type { DocumentKind, DocumentMime, DocumentScanStatus } from "../domain/documents.ts";
import type { LogbookCategory, LogbookEnvironment } from "../domain/logbook.ts";
import type { CandidatePool, MatchResult } from "../domain/matching.ts";
import type { ProfessionalProfile } from "../domain/professional.ts";
import type { Locale } from "../i18n/config.ts";
import type {
  QualificationCategory,
  QualificationStatus,
  QualificationType,
  VerificationStatus,
} from "../domain/qualification.ts";
import type {
  RequiredQualification,
  RequirementStatus,
  Shift,
  Urgency,
  WorkRequirement,
} from "../domain/work-requirement.ts";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR"
  /** Client-side only: the function could not be reached. */
  | "NETWORK_ERROR";

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  issues?: { path: string; message: string }[];
  /**
   * Which server check refused a 409: applications/opportunities (D-06; `APPLICATION_CONFLICTS`) or an
   * availability write that would touch a confirmed assignment (BR-4.9; `AVAILABILITY_CONFLICTS`).
   */
  reason?: ApplicationConflict | AvailabilityConflict;
}

export type ApiResponse<T> =
  { ok: true; data: T; requestId: string } | { ok: false; error: ApiErrorBody; requestId: string };

/** Display data of a candidate. External candidates: pseudonymous id, displayName null unless open. */
export interface CandidateSummary {
  id: string;
  pool: CandidatePool;
  displayName: string | null;
  baseLocation: string | null;
  yearsExperience: number | null;
}

export interface EvaluatedCandidate {
  candidate: CandidateSummary;
  match: MatchResult;
}

export interface HealthResponse {
  status: "ok";
  time: string;
}

export interface WorkRequirementResponse {
  requirement: WorkRequirement;
}

export interface WorkRequirementListResponse {
  requirements: WorkRequirement[];
  /** Rows matching the filters across all pages (absent from functions older than W5-02). */
  total?: number;
}

export interface CapacityResponse {
  requirementId: string;
  capacity: CapacityResult;
  internal: EvaluatedCandidate[];
}

/**
 * How complete the external evaluation is (get_requirement_external_pool_summary). `prefiltered`:
 * external professionals holding at least one required qualification; `hardEligible`: those who
 * pass every hard filter (selected first); `cap`: maximum evaluated per request. Counts only.
 */
export interface ExternalPoolCoverage {
  prefiltered: number;
  hardEligible: number;
  cap: number;
}

export interface MatchingResponse {
  requirementId: string;
  summary: { evaluated: number; eligible: number; pool: ExternalPoolCoverage };
  candidates: EvaluatedCandidate[];
}

export interface AvailabilityWindow {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AvailabilityStatus;
  updatedAt: string;
}

export interface AvailabilityRotation {
  pattern: Rotation;
  /** `YYYY-MM-DD` (UTC), day 1 of the cycle. */
  anchor: string;
  customCycle: CycleDay[];
}

export interface AvailabilityListResponse {
  windows: AvailabilityWindow[];
  /** The generator's saved pattern; private to the owner. `null` until one is saved. */
  rotation: AvailabilityRotation | null;
  /**
   * Fingerprint of the caller's calendar; send it back as `expectedVersion` when saving days.
   * Absent from backends older than migration 20261021120000 (then saves are not checked).
   */
  version?: string;
}

export interface AvailabilityWindowResponse {
  window: AvailabilityWindow;
}

export interface AvailabilityDaysResponse {
  /** Id of the applied change set (the same on an idempotent replay). */
  changeId: string;
  replayed: boolean;
}

export interface AvailabilityDeleteResponse {
  deleted: true;
  id: string;
}

/**
 * Document wallet (`professional-documents`, D-10, LOCAL ONLY). Owner-only: no organization,
 * manager or platform-admin access. Never carries the storage path or a persistent URL.
 */
export interface ProfessionalDocument {
  id: string;
  kind: DocumentKind;
  title: string;
  /** Sniffed from the uploaded bytes, never the client-declared type. */
  mimeType: DocumentMime;
  sizeBytes: number;
  /** Lower-case hex SHA-256 of the stored bytes. */
  sha256: string;
  /** YYYY-MM-DD. */
  expiresAt: string | null;
  /** One of the owner's own qualifications. */
  qualificationId: string | null;
  scanStatus: DocumentScanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentListResponse {
  documents: ProfessionalDocument[];
}

export interface DocumentResponse {
  document: ProfessionalDocument;
}

/** Short-lived signed URL (60 s). Never store it; ask again for each view. */
export interface DocumentUrlResponse {
  url: string;
  expiresInSeconds: number;
}

export interface DocumentDeleteResponse {
  deleted: true;
  id: string;
}

/**
 * Personal logbook (`professional-logbook`, M14/N-12, LOCAL ONLY). Owner-only and self-declared: no
 * organization, manager or platform-admin access; never an official record.
 */
export interface LogbookEntry {
  id: string;
  /** YYYY-MM-DD, never after today in Madrid (BR-16). */
  entryDate: string;
  aircraft: string;
  /** ATA chapter, free text ≤ 10. */
  ata: string | null;
  /** 0–24 in steps of 0.1. */
  hours: number;
  category: LogbookCategory;
  environment: LogbookEnvironment;
  description: string;
  /** «Seleccionable para expediente»: stored only, nothing reads it until D-07. */
  cvRelevant: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LogbookListResponse {
  entries: LogbookEntry[];
  /** Entries in this view; more than `entries.length` when the list was cut at `limit`. */
  total: number;
}

export interface LogbookEntryResponse {
  entry: LogbookEntry;
}

export interface LogbookDeleteResponse {
  deleted: true;
  id: string;
}

export interface ProfessionalProfileResponse {
  profile: ProfessionalProfile & { updatedAt: string };
}

/** A qualification declared by the professional. `verificationStatus` is read-only for them. */
export interface Qualification {
  id: string;
  type: QualificationType;
  status: QualificationStatus;
  /** Calendar dates `YYYY-MM-DD` or null. */
  issuedAt: string | null;
  expiresAt: string | null;
  verificationStatus: VerificationStatus;
  /** Reviewer's reason (phase 6); always set for rejections. */
  reviewNote: string | null;
  reviewedAt: string | null;
  updatedAt: string;
}

export interface QualificationListResponse {
  qualifications: Qualification[];
}

export interface QualificationResponse {
  qualification: Qualification;
}

export interface QualificationDeleteResponse {
  deleted: true;
  id: string;
}

export interface PreferencesResponse {
  preferences: { locale: Locale | null; updatedAt: string };
}

/** Platform-admin review queue (`qualification-reviews`, phase 6). Minimal data: no e-mail, no documents. */
export interface ReviewQueueItem {
  id: string;
  professional: { id: string; displayName: string; baseLocation: string | null };
  type: { code: string; name: string; category: QualificationCategory };
  issuedAt: string | null;
  expiresAt: string | null;
  declaredAt: string;
  /** Version the decision is about (sent back as `expectedUpdatedAt`). */
  updatedAt: string;
}

export interface ReviewHistoryItem {
  qualificationId: string;
  reviewerId: string | null;
  decision: "verified" | "rejected";
  noteProvided: boolean;
  requestId: string | null;
  at: string;
}

export interface ReviewQueueResponse {
  pending: ReviewQueueItem[];
  recent: ReviewHistoryItem[];
}

export interface ReviewDecisionResponse {
  qualification: { id: string; verificationStatus: VerificationStatus; reviewedAt: string };
}

/**
 * `documents-maintenance` (platform admin, LOCAL ONLY, not deployed): orphan reconciliation and
 * purge of tombstoned objects. Ids and counts only — never titles; paths never leave the function.
 */
export interface DocumentsMaintenanceResponse {
  mode: "dry-run" | "apply";
  /** Objects with no row and no tombstone, older than the orphan grace. */
  orphans: number;
  /** Tombstones due for purge (dry-run) or processed (apply). */
  due: { tombstoneId: string; reason: string }[];
  /** Apply only. */
  purged: number;
  absent: number;
  skipped: { tombstoneId: string; why: string }[];
  failed: number;
}

// --- M07 opportunities (D-12) and M08 applications (D-06), owner 2026-10-22 -------------------------

/**
 * What a professional may see of a published requirement (D-12): the fixed projection of
 * `list_opportunities` — organization NAME only, no ids of people, no counts of other applicants.
 */
export interface OpportunityRequirement {
  id: string;
  organizationName: string;
  title: string;
  location: string;
  startsAt: string;
  endsAt: string;
  shift: Shift;
  headcount: number;
  urgency: Urgency;
  createdAt: string;
  qualifications: RequiredQualification[];
}

export interface Opportunity {
  requirement: OpportunityRequirement;
  /** The caller's own eligibility (shared engine), whatever their visibility; never a ranking. */
  match: MatchResult;
  /** The caller's latest application to this requirement, if any. */
  myApplication: { id: string; status: ApplicationStatus } | null;
  /** Why «Presentar candidatura» is unavailable now; null = may apply. */
  applyBlocker: ApplyBlocker | null;
  /**
   * v1.8 «Posible en descanso» (BR-14.1): only availability stops the caller from applying, and
   * publishing their rest days (no window) as available would cover the period. Optional: an older
   * function does not send it (= false).
   */
  possibleOnRest?: boolean;
}

export interface OpportunityListResponse {
  opportunities: Opportunity[];
  /** Matches of the filters across all pages. */
  total: number;
  /** Published requirements considered (the function evaluates at most `cap` of them). */
  considered: number;
  cap: number;
}

export interface OpportunityResponse {
  opportunity: Opportunity;
}

/** One step of an application's history, readable by both parties (no free text, no person ids). */
export interface ApplicationEvent {
  from: ApplicationStatus | null;
  to: ApplicationStatus;
  actor: ApplicationActor;
  at: string;
  /** Proposal version created or accepted by this step. */
  proposalVersion: number | null;
}

/** R-08: an immutable snapshot of the requirement's published terms (T-11), version n per application. */
export interface ApplicationProposal {
  id: string;
  version: number;
  createdAt: string;
  terms: Omit<OpportunityRequirement, "id" | "createdAt">;
}

interface ApplicationBase {
  id: string;
  requirementId: string;
  status: ApplicationStatus;
  createdAt: string;
  /** Optimistic version: send it back as `expectedUpdatedAt` (ms precision). */
  updatedAt: string;
  /** Reject/cancel reason (T-10: visible to both parties). */
  reason: string | null;
  currentProposal: ApplicationProposal | null;
  acceptedProposalId: string | null;
  history: ApplicationEvent[];
}

/** The technician's view of their own application. */
export interface MyApplication extends ApplicationBase {
  requirement: OpportunityRequirement & { status: RequirementStatus };
  match: MatchResult;
}

/** The organization's view: the applicant as the candidate pool shows them (pseudonym rules, T-04). */
export interface OrgApplication extends ApplicationBase {
  candidate: CandidateSummary;
  match: MatchResult;
}

export interface MyApplicationListResponse {
  applications: MyApplication[];
}

export interface RequirementApplicationsResponse {
  requirementId: string;
  applications: OrgApplication[];
}

/** Dashboard counters for one organization: applications per status over its requirements. */
export interface ApplicationCountsResponse {
  counts: Partial<Record<ApplicationStatus, number>>;
}

export interface ApplicationResponse {
  application: MyApplication;
}

export interface ApplicationTransitionResponse {
  transition: {
    applicationId: string;
    status: ApplicationStatus;
    updatedAt: string;
    proposalId: string | null;
  };
  replayed: boolean;
}
