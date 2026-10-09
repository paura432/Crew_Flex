import type { FieldErrors } from "@/lib/validation/errors";

export type AuthErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_CONFIRMED"
  | "USER_EXISTS"
  | "WEAK_PASSWORD"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export type AuthFormState =
  | { status: "idle" }
  | { status: "check_email"; email: string }
  | {
      status: "error";
      code: AuthErrorCode;
      message: string;
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
