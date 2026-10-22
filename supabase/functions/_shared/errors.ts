// Normalized, client-safe errors. `message` is always safe to show to a user; internal
// details never leave the function (they are logged, without secrets).
import {
  APPLICATION_CONFLICTS,
  type ApplicationConflict,
} from "../../../src/domain/applications.ts";
import {
  AVAILABILITY_CONFLICTS,
  type AvailabilityConflict,
} from "../../../src/domain/availability.ts";
import { OUTREACH_CONFLICTS, type OutreachConflict } from "../../../src/domain/outreach.ts";

/** Every `reason` a 409 can carry (one family per SQLSTATE prefix). */
export type ConflictReason = ApplicationConflict | AvailabilityConflict | OutreachConflict;

const CONFLICT_FAMILIES: Record<string, readonly ConflictReason[]> = {
  A: APPLICATION_CONFLICTS,
  V: AVAILABILITY_CONFLICTS,
  O: OUTREACH_CONFLICTS,
};

export const ERROR_STATUS = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export interface FieldIssue {
  path: string;
  message: string;
}

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: "Sign in to continue.",
  FORBIDDEN: "You do not have permission to perform this action.",
  VALIDATION_ERROR: "Some fields are invalid.",
  NOT_FOUND: "The requested resource was not found.",
  METHOD_NOT_ALLOWED: "Method not allowed.",
  CONFLICT: "The resource already exists or was modified.",
  PAYLOAD_TOO_LARGE: "The request is too large.",
  INTERNAL_ERROR: "Unexpected server error. Try again later.",
};

export class ApiError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string = DEFAULT_MESSAGES[code],
    readonly issues?: FieldIssue[],
    /**
     * Which server check refused a 409: applications/opportunities (`APPLICATION_CONFLICTS`),
     * availability (`AVAILABILITY_CONFLICTS`, BR-4.9) or the Urgent/AOG outreach (`OUTREACH_CONFLICTS`,
     * BR-26).
     */
    readonly reason?: ConflictReason,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = ERROR_STATUS[code];
  }
}

/** Anything that is not an ApiError becomes a generic INTERNAL_ERROR. */
export function normalizeError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError("INTERNAL_ERROR");
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

/**
 * Our business conflicts: SQLSTATE `CFA01`…`CFA15` are the entries of `APPLICATION_CONFLICTS` in order
 * (20261022130300, 20261024100000; CFA14/CFA15 from the applications trigger of 20261023900200), `CFV01`… those of
 * `AVAILABILITY_CONFLICTS` (20261023300000), `CFO01`… those of `OUTREACH_CONFLICTS` (20261024400200). Custom
 * codes, never `40001` (PostgREST retries that one forever).
 */
export function conflictReason(sqlstate: string | undefined): ConflictReason | undefined {
  const match = /^CF([AVO])(\d{2})$/.exec(sqlstate ?? "");
  if (!match) return undefined;
  return CONFLICT_FAMILIES[match[1]!]?.[Number(match[2]) - 1];
}

/** Maps PostgREST / Postgres errors to safe API errors. Never forwards the DB message. */
export function fromDatabaseError(error: PostgrestLikeError): ApiError {
  const reason = conflictReason(error.code);
  if (reason) {
    return new ApiError(
      "CONFLICT",
      "This action is not possible in the current state.",
      undefined,
      reason,
    );
  }
  switch (error.code) {
    case "42501": // insufficient_privilege (incl. RLS violations and our "not authorized")
      return new ApiError("FORBIDDEN");
    case "22023": // invalid_parameter_value
    case "22P02": // invalid_text_representation
    case "22007": // invalid_datetime_format
    case "22008": // datetime_field_overflow (e.g. year 0000, which ISO-date validation accepts)
    case "23502": // not_null_violation
    case "23503": // foreign_key_violation (e.g. unknown qualification type)
    case "23514": // check_violation
      return new ApiError("VALIDATION_ERROR");
    case "23505": // unique_violation
    case "40001": // serialization_failure (PostgREST normally retries these itself)
    case "40P01": // deadlock_detected: two concurrent writes of the same technician (review LOW-1); retryable
    case "CF412": // optimistic concurrency: changed since the client loaded it (20261015130100)
      return new ApiError("CONFLICT");
    case "55000": // object_not_in_prerequisite_state (e.g. qualification no longer awaiting review)
      return new ApiError("CONFLICT", "The item changed and is no longer in the expected state.");
    case "P0002": // no_data_found raised by our RPCs
      return new ApiError("NOT_FOUND");
    case "0A000": // feature_not_supported: a flow disabled in this database (e.g. qualification review)
      return new ApiError("NOT_FOUND", "This service is not available.");
    case "CF409": // idempotency key reused with a different request (migration 20261015130200)
      return new ApiError("CONFLICT", "This request was already submitted with different data.");
    case "PGRST116": // no rows for single()
      return new ApiError("NOT_FOUND");
    default:
      if (error.message?.includes("row-level security")) return new ApiError("FORBIDDEN");
      return new ApiError("INTERNAL_ERROR");
  }
}
