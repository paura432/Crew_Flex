// Locale-aware display formatting. Dates follow the aviation convention day · month · year in both
// languages (en-GB / es-ES patterns) and are always rendered in UTC (BR-10); backend timestamps are
// never altered. Enum labels live in the message catalogs, not here.
import type { Locale } from "./config";

export const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", es: "es-ES" };

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(locale: Locale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let instance = cache.get(key);
  if (!instance) {
    instance = new Intl.DateTimeFormat(INTL_LOCALE[locale], { ...options, timeZone: "UTC" });
    cache.set(key, instance);
  }
  return instance;
}

export const formatShortDate = (locale: Locale, iso: string) =>
  fmt(locale, { day: "2-digit", month: "short" }).format(new Date(iso)).toUpperCase();

export const formatDate = (locale: Locale, isoOrDate: string) =>
  fmt(locale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(isoOrDate));

export const formatDateTime = (locale: Locale, iso: string) =>
  `${fmt(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso))} UTC`;

export const formatPeriod = (locale: Locale, startsAt: string, endsAt: string) =>
  `${formatShortDate(locale, startsAt)} → ${formatShortDate(locale, endsAt)}`;

/** A month as a title: «Octubre de 2026» (Spanish month names are lower case mid-sentence; X-18). */
export const formatMonth = (locale: Locale, iso: string) => {
  const month = fmt(locale, { month: "long", year: "numeric" }).format(new Date(iso));
  return month.charAt(0).toUpperCase() + month.slice(1);
};

/** «48,78%» in Spanish, «48.78%» in English: the locale's decimal mark, `%` glued as in the catalog (X-05). */
export const formatPercent = (locale: Locale, value: number) =>
  `${new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 2 }).format(value)}%`;
