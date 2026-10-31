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

/** «16:00 UTC» — the end of a shift that ends on the day it starts. */
export const formatTime = (locale: Locale, iso: string) =>
  `${fmt(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso))} UTC`;

/** A shift «10 nov 2026, 08:00 UTC → 16:00 UTC» (the end's date only when it differs, BR-10 UTC). */
export const formatShiftSpan = (locale: Locale, startsAt: string, endsAt: string) =>
  `${formatDateTime(locale, startsAt)} → ${
    startsAt.slice(0, 10) === endsAt.slice(0, 10)
      ? formatTime(locale, endsAt)
      : formatDateTime(locale, endsAt)
  }`;

/**
 * Informative amounts in EUR (requirement terms, OD-7: no payment exists): «50 €» / «€50», two decimals only
 * when the amount has cents.
 */
export const formatEuro = (locale: Locale, value: number) =>
  new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);

const amountCache = new Map<Locale, Intl.NumberFormat>();
/** A frozen pack's amounts in EUR, always with cents («50,00 €» / «€50.00»). */
export const formatAmount = (locale: Locale, value: number) => {
  let instance = amountCache.get(locale);
  if (!instance) {
    instance = new Intl.NumberFormat(INTL_LOCALE[locale], { style: "currency", currency: "EUR" });
    amountCache.set(locale, instance);
  }
  return instance.format(value);
};

const localCache = new Map<Locale, Intl.DateTimeFormat>();
/**
 * A moment in the viewer's own time zone («31 oct 2026, 12:05»), for browser-only facts such as when a
 * local draft was saved. Never call it while server rendering: the zone would be the server's.
 */
export const formatLocalDateTime = (locale: Locale, iso: string) => {
  let instance = localCache.get(locale);
  if (!instance) {
    instance = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      dateStyle: "medium",
      timeStyle: "short",
    });
    localCache.set(locale, instance);
  }
  return instance.format(new Date(iso));
};

/** Hours and other plain numbers with the locale's decimal mark («7,5» / «7.5»). */
export const formatNumber = (locale: Locale, value: number) =>
  new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 2 }).format(value);

/** «España» / «Spain» for an ISO 3166-1 alpha-2 code (v1.8 `names.of`). */
export const formatCountry = (locale: Locale, code: string) =>
  new Intl.DisplayNames([INTL_LOCALE[locale]], { type: "region" }).of(code) ?? code;

/** «48,78%» in Spanish, «48.78%» in English: the locale's decimal mark, `%` glued as in the catalog (X-05). */
export const formatPercent = (locale: Locale, value: number) =>
  `${new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 2 }).format(value)}%`;
