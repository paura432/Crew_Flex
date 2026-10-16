// Locale vocabulary shared by server, client and the `user-preferences` Edge Function.
// Deno-compatible: no framework imports.
export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Explicit fallback when nothing else decides (docs/product/I18N_STRATEGY.md §3). */
export const DEFAULT_LOCALE: Locale = "en";

/** Remembers the choice before sign-in and between sessions on this browser (1 year). */
export const LOCALE_COOKIE = "crewflex-locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
