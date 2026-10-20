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
 * True when the JWT `amr` claim shows the session was opened by a recovery e-mail link within the
 * window. A plain signed-in session (shared device, stolen cookie) must not set a new password
 * without the current one.
 */
export function isRecentRecovery(amr: unknown, nowSeconds: number): boolean {
  return (
    Array.isArray(amr) &&
    amr.some(
      (entry: unknown) =>
        typeof entry === "object" &&
        entry !== null &&
        (entry as { method?: unknown }).method === "recovery" &&
        typeof (entry as { timestamp?: unknown }).timestamp === "number" &&
        nowSeconds - (entry as { timestamp: number }).timestamp <= RECOVERY_WINDOW_SECONDS,
    )
  );
}
