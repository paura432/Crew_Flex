// Normalized, client-safe errors. `message` is always safe to show to a user; internal
// details never leave the function (they are logged, without secrets).

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

/** Maps PostgREST / Postgres errors to safe API errors. Never forwards the DB message. */
export function fromDatabaseError(error: PostgrestLikeError): ApiError {
  switch (error.code) {
    case "42501": // insufficient_privilege (incl. RLS violations and our "not authorized")
      return new ApiError("FORBIDDEN");
    case "22023": // invalid_parameter_value
    case "22P02": // invalid_text_representation
    case "23502": // not_null_violation
    case "23503": // foreign_key_violation (e.g. unknown qualification type)
    case "23514": // check_violation
      return new ApiError("VALIDATION_ERROR");
    case "23505": // unique_violation
      return new ApiError("CONFLICT");
    case "PGRST116": // no rows for single()
      return new ApiError("NOT_FOUND");
    default:
      if (error.message?.includes("row-level security")) return new ApiError("FORBIDDEN");
      return new ApiError("INTERNAL_ERROR");
  }
}
