// «Buscar candidatos» — the organization's free candidate directory (package directory; v1.8
// `CandidateDirectory.jsx`, `MedalStrip.jsx`; BUSINESS_RULES BR-28, T-150…T-159). Pure: no I/O, no
// framework imports. Shared by Next.js, the `candidate-directory` Edge Function and the database tests.
// The search itself runs in the database (search_candidate_directory): these are the bounds both sides agree
// on and the display rules of the card.
import type { Aircraft, ProfessionalCategory } from "./passport.ts";

/** v1.8 «20 perfiles por página». */
export const DIRECTORY_PAGE_SIZE = 20;
/** Upper bound of `?page=` (the database caps the offset at 10 000 rows). */
export const DIRECTORY_PAGE_MAX = 500;
/** v1.8 «intervalo válido de hasta un año» (inclusive days between the two dates). */
export const DIRECTORY_WINDOW_MAX_DAYS = 365;
/** «Base habitual» text filter (the matches page's search field is 80 too). */
export const DIRECTORY_BASE_MAX = 80;
/** «Experiencia mínima» in declared years (`technician_profiles.years_experience` is 0–60). */
export const DIRECTORY_MIN_YEARS_MAX = 60;
/** T-157: directory calls (searches and block/unblock) per organization per minute before the database answers CFD01. */
export const DIRECTORY_SEARCHES_PER_MINUTE = 60;
/** The pseudonym the organization sees: `CF-` + 10 upper-case hex (per organization, T-151). */
export const DIRECTORY_REF_PATTERN = /^CF-[0-9A-F]{10}$/;

/** SQLSTATE `CFD01`… in order (migration 20261024700000); the 409 `reason` of `candidate-directory`. */
export const DIRECTORY_CONFLICTS = [
  "DIRECTORY_RATE_LIMITED", // CFD01: more than DIRECTORY_SEARCHES_PER_MINUTE searches by the organization
  "DIRECTORY_CANDIDATE_NOT_FOUND", // CFD02: the ref names nobody the organization may find right now
] as const;
export type DirectoryConflict = (typeof DIRECTORY_CONFLICTS)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Whole UTC days between two `YYYY-MM-DD` values (negative when `to` is before `from`). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * v1.8 «Completa ambas fechas con un intervalo válido de hasta un año.»: both dates or neither; `from` not
 * before `today` (a past window would only probe history, T-154) and not after `to`; at most
 * DIRECTORY_WINDOW_MAX_DAYS apart. Returns true for an empty window.
 */
export function isValidDirectoryWindow(
  from: string | null | undefined,
  to: string | null | undefined,
  today: string,
): boolean {
  if (!from && !to) return true;
  if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to)) return false;
  const span = daysBetween(from, to);
  return (
    Number.isFinite(span) &&
    span >= 0 &&
    span <= DIRECTORY_WINDOW_MAX_DAYS &&
    daysBetween(today, from) >= 0
  );
}

/** `YYYY-MM-DD` of `now` in UTC — the day the database compares the window against. */
export const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

/** v1.8 `MedalStrip` kinds (the learning medals stay the professional's own, T-156). */
export type Medal =
  | { kind: "experience"; years: number }
  | { kind: "category"; category: ProfessionalCategory }
  | { kind: "aircraft"; aircraft: Aircraft };
export type MedalKind = Medal["kind"];

/** The medals of one card, in v1.8 order: declared years, the main category then the others, the aircraft. */
export function medals(candidate: {
  yearsExperience: number | null;
  primaryCategory: ProfessionalCategory | null;
  categories: readonly ProfessionalCategory[];
  aircraft: readonly Aircraft[];
}): Medal[] {
  const categories = [
    ...(candidate.primaryCategory ? [candidate.primaryCategory] : []),
    ...candidate.categories.filter((c) => c !== candidate.primaryCategory),
  ];
  return [
    ...(candidate.yearsExperience !== null && candidate.yearsExperience > 0
      ? [{ kind: "experience" as const, years: candidate.yearsExperience }]
      : []),
    ...categories.map((category) => ({ kind: "category" as const, category })),
    ...candidate.aircraft.map((aircraft) => ({ kind: "aircraft" as const, aircraft })),
  ];
}

/**
 * v1.8 `primary`: the strip shows one medal per kind (experience, first category, first aircraft) and a «+N»
 * disclosure for the rest; `all` shows everything (the profile dialog).
 */
export function splitMedals(items: readonly Medal[]): { shown: Medal[]; more: Medal[] } {
  const shown: Medal[] = [];
  const more: Medal[] = [];
  const seen = new Set<MedalKind>();
  for (const medal of items) {
    if (seen.has(medal.kind)) more.push(medal);
    else {
      seen.add(medal.kind);
      shown.push(medal);
    }
  }
  return { shown, more };
}

/** v1.8 `Avatar`: «CF» while the identity is protected, the initials of the first two words otherwise. */
export function avatarInitials(displayName: string | null): string {
  if (!displayName) return "CF";
  const letters = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0]!.toLocaleUpperCase("es"))
    .join("");
  return letters || "CF";
}
