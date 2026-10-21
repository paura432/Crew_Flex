import type { FieldErrors } from "@/lib/validation/errors";

export type AuthErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_CONFIRMED"
  | "USER_EXISTS"
  | "WEAK_PASSWORD"
  | "SAME_PASSWORD"
  | "RECOVERY_EXPIRED"
  | "NETWORK_ERROR"
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

/**
 * Which outcome banner the login page shows, from its query: a finished password reset wins over a
 * plain sign-out (both end the session; the reset one says why).
 */
export function loginNotice(params: { reset?: unknown; signedOut?: unknown }) {
  if (params.reset === "1") return "passwordChanged" as const;
  if (params.signedOut === "1") return "signedOut" as const;
  return null;
}
