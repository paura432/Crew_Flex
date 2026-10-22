import type { FieldErrors } from "@/lib/validation/errors";

export type AuthErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_CONFIRMED"
  | "USER_EXISTS"
  | "WEAK_PASSWORD"
  | "SAME_PASSWORD"
  | "RECOVERY_EXPIRED"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  /** Invitation-only sign-up (owner flag, T-40): no code was given. */
  | "INVITATION_REQUIRED"
  /** The code is unknown, expired, used or revoked (v1.8 «Enlace caducado, utilizado o no válido.»). */
  | "INVITATION_INVALID"
  /** The code is valid for another address; nothing was consumed (v1.8 «…pertenece a otro email.»). */
  | "INVITATION_OTHER_EMAIL"
  | "UNKNOWN";

export type AuthFormState =
  | { status: "idle" }
  | { status: "check_email"; email: string }
  | {
      status: "error";
      /** Translated by the form (`auth.errors.<code>`); no prose crosses the boundary. */
      code: AuthErrorCode;
      /** `v.*` keys resolved by the form. */
      fieldErrors?: FieldErrors;
      /** Echoed non-secret values so the form keeps them (never the password). */
      values?: Record<string, string>;
    };

export const initialAuthState: AuthFormState = { status: "idle" };

/** Only same-app relative paths under /app are accepted (prevents open redirects). */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return "/app";
  if (!next.startsWith("/app") || next.startsWith("//") || next.includes("\\")) return "/app";
  return next;
}

/** Where an e-mail link may land after `/auth/confirm`: the reset page or a safe `/app` path. */
export function safeConfirmNext(next: unknown): string {
  return next === "/reset-password" ? next : safeNextPath(next);
}

/** v1.8 reset links lived 1 h (`server/app.mjs:164`); the reset form is open for the same window. */
export const RECOVERY_WINDOW_SECONDS = 3600;

/**
 * True when the JWT `amr` claim shows the session was opened from an e-mail link within the window:
 * `recovery` (PKCE `code` link) or `otp` (`token_hash` link — GoTrue v2.197 records recovery
 * verification as `otp`; T22 matrix 2026-10-20). Both prove control of the mailbox. UX gate only: the
 * provider-level control is `update_password_require_current_password`, which exempts recovery sessions
 * natively (docs/product/SECURITY_PRIVACY.md T22).
 */
export function isRecentRecovery(amr: unknown, nowSeconds: number): boolean {
  return (
    Array.isArray(amr) &&
    amr.some(
      (entry: unknown) =>
        typeof entry === "object" &&
        entry !== null &&
        ["recovery", "otp"].includes((entry as { method?: unknown }).method as string) &&
        typeof (entry as { timestamp?: unknown }).timestamp === "number" &&
        nowSeconds - (entry as { timestamp: number }).timestamp <= RECOVERY_WINDOW_SECONDS,
    )
  );
}

export type LoginNotice =
  "passwordChanged" | "accountClosed" | "emailConfirmed" | "confirmLinkInvalid" | "signedOut";

/**
 * Which outcome banner the login page shows, from its query. The ones that explain why the session
 * ended win (password reset, closed account) over the e-mail confirmation and a plain sign-out.
 */
export function loginNotice(params: {
  reset?: unknown;
  closed?: unknown;
  confirmed?: unknown;
  confirmError?: unknown;
  signedOut?: unknown;
}): LoginNotice | null {
  if (params.reset === "1") return "passwordChanged";
  if (params.closed === "1") return "accountClosed";
  if (params.confirmed === "1") return "emailConfirmed";
  if (params.confirmError === "1") return "confirmLinkInvalid";
  if (params.signedOut === "1") return "signedOut";
  return null;
}

export type ConfirmLink =
  /** Password recovery (`next=/reset-password`): open the session and go on. */
  | { kind: "recovery"; code: string | null; tokenHash: string | null }
  /** Sign-up confirmation, already verified by Auth (a PKCE `code` exists only after that). */
  | { kind: "signup_confirmed" }
  /** Sign-up confirmation by `token_hash` (custom e-mail template): verify it, keep no session. */
  | { kind: "signup_token"; tokenHash: string; type: "signup" | "email" }
  | { kind: "invalid" };

/**
 * What an e-mail link that lands on `/auth/confirm` is (AUTH-03). Recovery links name their own
 * destination; every other link is a sign-up confirmation (`emailRedirectTo = /auth/confirm?next=/app`),
 * which never opens a session here: the person signs in afterwards (no login CSRF through a link), and
 * an expired or reused one says so on the login page instead of the password-reset form.
 */
export function confirmLink(params: {
  next: string;
  code: string | null;
  tokenHash: string | null;
  type: string | null;
}): ConfirmLink {
  if (params.next === "/reset-password") {
    return {
      kind: "recovery",
      code: params.code,
      tokenHash: params.type === "recovery" ? params.tokenHash : null,
    };
  }
  if (params.code) return { kind: "signup_confirmed" };
  if (params.tokenHash && (params.type === "signup" || params.type === "email")) {
    return { kind: "signup_token", tokenHash: params.tokenHash, type: params.type };
  }
  return { kind: "invalid" };
}

export interface AuthErrorLike {
  code?: string;
  name?: string;
  status?: number;
}

/** Maps provider errors to stable codes; the UI translates them (`auth.errors.*`). */
export function mapAuthError(error: AuthErrorLike): { code: AuthErrorCode } {
  if (error.name === "AuthRetryableFetchError" || error.status === 0) {
    return { code: "NETWORK_ERROR" };
  }
  // Supabase Auth throttling (sign-in, sign-up, e-mail sends). Callers that must not reveal whether an
  // account exists (password reset) keep their uniform answer and never surface this code.
  if (
    error.status === 429 ||
    error.code === "over_request_rate_limit" ||
    error.code === "over_email_send_rate_limit"
  ) {
    return { code: "RATE_LIMITED" };
  }
  if (error.name === "AuthSessionMissingError") return { code: "RECOVERY_EXPIRED" };
  switch (error.code) {
    case "invalid_credentials":
      return { code: "INVALID_CREDENTIALS" };
    case "email_not_confirmed":
      return { code: "EMAIL_NOT_CONFIRMED" };
    case "user_already_exists":
    case "email_exists":
      return { code: "USER_EXISTS" };
    case "weak_password":
      return { code: "WEAK_PASSWORD" };
    case "same_password":
      return { code: "SAME_PASSWORD" };
    // Provider refused a password change outside a recovery session (T22 settings).
    case "current_password_required":
    case "reauthentication_needed":
      return { code: "RECOVERY_EXPIRED" };
    default:
      return { code: "UNKNOWN" };
  }
}
