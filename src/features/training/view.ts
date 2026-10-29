import {
  TRAINING_FAMILIES,
  TRAINING_MODES,
  CATALOG_PAGE_SIZE,
  type TrainingFamily,
  type TrainingMode,
} from "@/domain/training";
import { INTL_LOCALE } from "@/i18n/format";
import type { Locale } from "@/i18n/config";

export const TRAINING_PATH = "/app/training";
export const REQUESTS_PATH = "/app/training/requests";
export const PROVIDER_PATH = "/app/organization/training";
export const INBOX_PATH = "/app/organization/training/inbox";
export const ADMIN_TRAINING_PATH = "/app/admin/training";

export interface CatalogFilters {
  q: string;
  family: TrainingFamily | "";
  mode: TrainingMode | "";
  language: string;
  country: string;
  from: string;
  to: string;
  page: number;
}

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
const date = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const oneOf = <T extends string>(v: string, all: readonly T[]) =>
  (all as readonly string[]).includes(v) ? (v as T) : "";

/** `?q=&family=&mode=&language=&country=&from=&to=&page=` → filters; anything invalid is dropped, never an error. */
export function parseCatalogFilters(search: Search): CatalogFilters {
  const page = Number.parseInt(one(search.page), 10);
  return {
    q: one(search.q).slice(0, 80),
    family: oneOf(one(search.family), TRAINING_FAMILIES),
    mode: oneOf(one(search.mode), TRAINING_MODES),
    language: one(search.language).slice(0, 100),
    country: one(search.country).slice(0, 100),
    from: date(one(search.from)),
    to: date(one(search.to)),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** The API query of one catalog page (12 per page, server-side). */
export const catalogQuery = ({ page, ...f }: CatalogFilters) => ({
  ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "")),
  offset: (page - 1) * CATALOG_PAGE_SIZE,
  limit: CATALOG_PAGE_SIZE,
});

export function catalogHref(filters: CatalogFilters, patch: Partial<CatalogFilters> = {}) {
  const merged = { ...filters, ...patch };
  const params = new URLSearchParams(
    Object.entries(merged)
      .filter(([k, v]) => v !== "" && !(k === "page" && v === 1))
      .map(([k, v]) => [k, String(v)]),
  );
  const qs = params.toString();
  return qs ? `${TRAINING_PATH}?${qs}` : TRAINING_PATH;
}

/** «12 nov 2026, 08:00–12:00» in the edition's IANA zone (v1.9: sessions are edited in UTC, shown in the zone). */
export function formatSessionRange(
  locale: Locale,
  startsAt: string,
  endsAt: string,
  timeZone: string,
) {
  const day = new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "medium", timeZone });
  const time = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeStyle: "short", timeZone });
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay = day.format(start) === day.format(end);
  return sameDay
    ? `${day.format(start)}, ${time.format(start)}–${time.format(end)}`
    : `${day.format(start)} ${time.format(start)} – ${day.format(end)} ${time.format(end)}`;
}

/** «24 oct 2026» in a zone (UTC for history events). */
export const formatDay = (locale: Locale, iso: string, timeZone = "UTC") =>
  new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "medium", timeZone }).format(
    new Date(iso),
  );

/** `datetime-local` value (no zone) read as UTC → ISO instant; "" → null. */
export const utcInputToIso = (value: string) =>
  value ? new Date(`${value}:00Z`).toISOString() : null;
/** ISO instant → `datetime-local` value in UTC. */
export const isoToUtcInput = (iso: string | null) => (iso ? iso.slice(0, 16) : "");

/** Chip tone of a training status (requests, listings, providers). */
export function statusTone(status: string): "neutral" | "ok" | "warn" | "danger" | "info" {
  if (["confirmed", "finished", "published", "reviewed", "completed", "attended"].includes(status))
    return "ok";
  if (["offered", "accepted", "waitlisted", "submitted", "pending", "changes"].includes(status))
    return "warn";
  if (["rejected", "suspended", "no_show"].includes(status)) return "danger";
  if (status === "received" || status === "draft") return "info";
  return "neutral";
}
