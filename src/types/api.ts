// Edge Function response contracts. Type-only module shared by Next.js and the Deno functions.
// Envelope: docs/architecture/EDGE_FUNCTIONS.md
import type { AvailabilityStatus } from "../domain/availability.ts";
import type { CapacityResult } from "../domain/capacity.ts";
import type { CandidatePool, MatchResult } from "../domain/matching.ts";
import type { ProfessionalProfile } from "../domain/professional.ts";
import type { Locale } from "../i18n/config.ts";
import type {
  QualificationCategory,
  QualificationStatus,
  QualificationType,
  VerificationStatus,
} from "../domain/qualification.ts";
import type { WorkRequirement } from "../domain/work-requirement.ts";

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

export interface AvailabilityListResponse {
  windows: AvailabilityWindow[];
}

export interface AvailabilityWindowResponse {
  window: AvailabilityWindow;
}

export interface AvailabilityDeleteResponse {
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
