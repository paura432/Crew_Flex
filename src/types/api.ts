// Edge Function response contracts. Type-only module shared by Next.js and the Deno functions.
// Envelope: docs/architecture/EDGE_FUNCTIONS.md
import type { AvailabilityStatus } from "../domain/availability.ts";
import type { CapacityResult } from "../domain/capacity.ts";
import type { CandidatePool, MatchResult } from "../domain/matching.ts";
import type { ProfessionalProfile } from "../domain/professional.ts";
import type {
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

export interface MatchingResponse {
  requirementId: string;
  summary: { evaluated: number; eligible: number };
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
