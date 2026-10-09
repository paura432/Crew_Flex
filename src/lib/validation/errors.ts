import type { ZodError } from "zod";

export type FieldErrors = Record<string, string>;

/** First message per top-level field, for form display. */
export function toFieldErrors(error: ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}
