import { EU_COUNTRIES, type EuCountry } from "@/domain/organization";
import type { Locale } from "@/i18n/config";
import { INTL_LOCALE } from "@/i18n/format";

/** Country name in the UI language (v1.8 `Intl.DisplayNames`); the code itself if unknown. */
export function countryName(locale: Locale, code: string): string {
  try {
    return new Intl.DisplayNames([INTL_LOCALE[locale]], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The 27 EU countries (OD-6 default) sorted by their name in the UI language. */
export function euCountryOptions(locale: Locale): { code: EuCountry; name: string }[] {
  return EU_COUNTRIES.map((code) => ({ code, name: countryName(locale, code) })).sort((a, b) =>
    a.name.localeCompare(b.name, INTL_LOCALE[locale]),
  );
}

/**
 * The select's initial value: the stored country when it is one of the list; otherwise empty, so a
 * sign-up country outside the EU is never silently replaced by another one (the admin must choose).
 */
export const initialCountry = (stored: string | null): EuCountry | "" =>
  (EU_COUNTRIES as readonly string[]).includes(stored ?? "") ? (stored as EuCountry) : "";
