// URL state of «Buscar candidatos» (package directory, BR-28): the seven v1.8 filters, the blocked switch and
// the page, parsed leniently from `searchParams` (an unknown value falls back to its default; a malformed
// window or years count is kept and flagged so the form shows v1.8's error) and written back as plain links.
import {
  DIRECTORY_MIN_YEARS_MAX,
  DIRECTORY_PAGE_MAX,
  DIRECTORY_BASE_MAX,
  isValidDirectoryWindow,
} from "@/domain/directory";
import {
  AIRCRAFT,
  ENGLISH_LEVELS,
  EU_COUNTRIES,
  PROFESSIONAL_CATEGORIES,
  type Aircraft,
  type EnglishLevel,
  type EuCountry,
  type ProfessionalCategory,
} from "@/domain/passport";

export const DIRECTORY_PATH = "/app/organization/candidates";

export interface DirectoryQuery {
  category: ProfessionalCategory | null;
  aircraft: Aircraft | null;
  englishLevel: EnglishLevel | null;
  /** null = not filtered (also while the typed value is invalid: see `errors.minYears`). */
  minYears: number | null;
  country: EuCountry | null;
  base: string;
  /** `YYYY-MM-DD` as typed (empty when absent), so the form keeps an invalid window for correction. */
  from: string;
  to: string;
  blocked: boolean;
  page: number;
}
export interface DirectoryQueryErrors {
  window: boolean;
  minYears: boolean;
}

type Param = string | string[] | undefined;
const first = (v: Param) => (Array.isArray(v) ? v[0] : v) ?? "";
const known = <T extends string>(catalog: readonly T[], value: string): T | null =>
  (catalog as readonly string[]).includes(value) ? (value as T) : null;

export const EMPTY_DIRECTORY_QUERY: DirectoryQuery = {
  category: null,
  aircraft: null,
  englishLevel: null,
  minYears: null,
  country: null,
  base: "",
  from: "",
  to: "",
  blocked: false,
  page: 1,
};

/** `today` = the UTC day (`utcDay(Date.now())`), the one the database compares the window against. */
export function parseDirectoryQuery(
  params: Record<string, Param>,
  today: string,
): { query: DirectoryQuery; errors: DirectoryQueryErrors } {
  const rawYears = first(params.minYears).trim();
  const years = /^\d{1,3}$/.test(rawYears) ? Number(rawYears) : null;
  const yearsValid = rawYears === "" || (years !== null && years <= DIRECTORY_MIN_YEARS_MAX);
  const page = Number.parseInt(first(params.page), 10);
  const from = first(params.from).trim().slice(0, 10);
  const to = first(params.to).trim().slice(0, 10);
  return {
    query: {
      category: known(PROFESSIONAL_CATEGORIES, first(params.category)),
      aircraft: known(AIRCRAFT, first(params.aircraft)),
      englishLevel: known(ENGLISH_LEVELS, first(params.englishLevel)),
      minYears: yearsValid ? years : null,
      country: known(EU_COUNTRIES, first(params.country)),
      base: first(params.base).trim().slice(0, DIRECTORY_BASE_MAX),
      from,
      to,
      blocked: first(params.blocked) === "1",
      page: Number.isFinite(page) && page >= 1 ? Math.min(page, DIRECTORY_PAGE_MAX) : 1,
    },
    errors: {
      window: !isValidDirectoryWindow(from || null, to || null, today),
      minYears: !yearsValid,
    },
  };
}

/** The query string the `candidate-directory` function expects (only the set filters travel). */
export function toDirectorySearchParams(
  organizationId: string,
  query: DirectoryQuery,
): Record<string, string> {
  const params: Record<string, string> = { organizationId };
  if (query.category) params.category = query.category;
  if (query.aircraft) params.aircraft = query.aircraft;
  if (query.englishLevel) params.englishLevel = query.englishLevel;
  if (query.minYears !== null) params.minYears = String(query.minYears);
  if (query.country) params.country = query.country;
  if (query.base) params.base = query.base;
  if (query.from && query.to) {
    params.from = query.from;
    params.to = query.to;
  }
  if (query.blocked) params.blocked = "1";
  if (query.page > 1) params.page = String(query.page);
  return params;
}

/** `?…` for the directory with some values replaced (plain links: works without JavaScript). */
export function directoryHref(query: DirectoryQuery, over: Partial<DirectoryQuery> = {}): string {
  const next = { ...query, ...over };
  const params = new URLSearchParams();
  if (next.category) params.set("category", next.category);
  if (next.aircraft) params.set("aircraft", next.aircraft);
  if (next.englishLevel) params.set("englishLevel", next.englishLevel);
  if (next.minYears !== null) params.set("minYears", String(next.minYears));
  if (next.country) params.set("country", next.country);
  if (next.base) params.set("base", next.base);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.blocked) params.set("blocked", "1");
  if (next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `${DIRECTORY_PATH}?${qs}` : DIRECTORY_PATH;
}

/** True when any of the seven filters is set (the «Más filtros» disclosure opens then). */
export const hasDirectoryFilters = (q: DirectoryQuery) =>
  q.category !== null ||
  q.aircraft !== null ||
  q.englishLevel !== null ||
  q.minYears !== null ||
  q.country !== null ||
  q.from !== "" ||
  q.to !== "";
