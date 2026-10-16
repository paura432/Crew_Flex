// Locale-aware display formatting. Dates follow the aviation convention day · month · year in both
// languages (en-GB / es-ES patterns) and are always rendered in UTC (BR-10); backend timestamps are
// never altered. Enum labels live in the message catalogs, not here.
import type { Locale } from "./config";

const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", es: "es-ES" };

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

export const formatMonth = (locale: Locale, iso: string) =>
  fmt(locale, { month: "long", year: "numeric" }).format(new Date(iso));
