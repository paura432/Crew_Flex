// Validation messages travel as stable keys (`v.*`, see src/lib/validation/*) so the same Zod
// schemas serve the browser, the server actions and the Deno Edge Functions. The UI resolves
// them here; anything that is not a key (a raw server message) is shown as-is.
import type { FieldErrors } from "@/lib/validation/errors";

/**
 * Any next-intl translator created without a namespace (`useTranslations()` / `getTranslations()`).
 * Keys arrive at runtime (from Zod issues or API envelopes), so they cannot be checked statically;
 * next-intl returns the key itself and logs when one is missing, and `tests/i18n` proves the
 * catalogs contain every key the schemas emit.
 */
export type MessageResolver = (key: never) => string;

const isValidationKey = (message: string) => /^v\.[a-zA-Z0-9_.]+$/.test(message);

export const translateKey = (t: MessageResolver, key: string) => t(key as never);

export function resolveMessage(t: MessageResolver, message: string): string {
  return isValidationKey(message) ? translateKey(t, message) : message;
}

export function resolveFieldErrors(t: MessageResolver, errors: FieldErrors): FieldErrors {
  return Object.fromEntries(
    Object.entries(errors).map(([field, message]) => [field, resolveMessage(t, message)]),
  );
}
