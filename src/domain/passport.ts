// v1.8 passport declarations (package passport: N-01, N-02, N-05, N-06, N-07, N-08).
// Pure: no I/O, no framework imports. Shared by Next.js and the Supabase Edge Functions.
//
// These lists are the v1.8 catalogs (`src/business.js:7-10`, `src/components/v11/Professional2.jsx:8-9`,
// `server/rules.mjs:1` of the prototype), adopted as documented technical defaults (T-30…T-35,
// docs/integration/crewflex-v13/08-product-decisions.md). The database CHECK constraints of migration
// 20261023100100 repeat them: change both in the same commit (tests/db/passport.test.ts proves they agree).
//
// What they are: the professional's OWN declarations (what they work as, on, with, and where they may
// work). They are not verified evidence: verified licences and type ratings stay the catalog
// qualifications (BR-2/BR-3). Matching does not read these declarations yet (separate package after the
// company-side diff); the helpers at the end are the pieces it will need.

/** v1.8 `CATEGORIES` (12): licence categories plus trades. Codes follow the qualification catalog. */
export const PROFESSIONAL_CATEGORIES = [
  "B1.1",
  "B1.2",
  "B1.3",
  "B1.4",
  "B2",
  "B3",
  "CAT-A",
  "CAT-C",
  "MECHANIC",
  "SHEET-METAL",
  "NDT",
  "HELPER",
] as const;
export type ProfessionalCategory = (typeof PROFESSIONAL_CATEGORIES)[number];

/**
 * Categories a type rating can be endorsed for. v1.8 demo (`Professional2.jsx:81`) offers a rating for
 * every chosen category except Sheet Metal, NDT, Mecánico and Helper: they are trades, not licences.
 */
export const LICENCE_CATEGORIES = [
  "B1.1",
  "B1.2",
  "B1.3",
  "B1.4",
  "B2",
  "B3",
  "CAT-A",
  "CAT-C",
] as const satisfies readonly ProfessionalCategory[];
export type LicenceCategory = (typeof LICENCE_CATEGORIES)[number];

/** v1.8 `AIRCRAFT` (12). Aeronautical designations: shown as they are in every language. */
export const AIRCRAFT = [
  "A320 Family",
  "B737 NG",
  "B737 MAX",
  "ATR 72",
  "Embraer E-Jets",
  "A330",
  "A350",
  "B787",
  "EC135/145",
  "Cessna 172",
  "Piper PA-28",
  "Robinson R44",
] as const;
export type Aircraft = (typeof AIRCRAFT)[number];

/** v1.8 `ENGINES` (7). Designations, not translated. */
export const ENGINES = [
  "CFM56-5B/7B",
  "LEAP-1A",
  "LEAP-1B",
  "PW1100G",
  "PW127",
  "Trent 700/1000",
  "GE90",
] as const;
export type Engine = (typeof ENGINES)[number];

/** v1.8 `SKILLS` (9). Translated in `messages/*.json` (`passport.skills.*`). */
export const SKILLS = [
  "line_maintenance",
  "base_maintenance",
  "aog_support",
  "troubleshooting",
  "engine_change",
  "sheet_metal",
  "ndt",
  "borescope",
  "cabin_systems",
] as const;
export type Skill = (typeof SKILLS)[number];

/** CEFR levels, in order (v1.8 «Inglés técnico» A1–C2). */
export const ENGLISH_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type EnglishLevel = (typeof ENGLISH_LEVELS)[number];

/** The 27 EU member states, ISO 3166-1 alpha-2, in v1.8 order (`server/rules.mjs:1`). */
export const EU_COUNTRIES = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
] as const;
export type EuCountry = (typeof EU_COUNTRIES)[number];

/** v1.8 «Unidad de tarifa»: «EUR / hora» or «EUR / día» (demo default: per day). */
export const RATE_UNITS = ["hour", "day"] as const;
export type RateUnit = (typeof RATE_UNITS)[number];

export const PHONE_MAX = 32;
/** Digits, spaces, `( ) . -` and an optional leading `+` (the database CHECK repeats it). */
export const PHONE_PATTERN = /^\+?[0-9][0-9 ().-]{5,30}$/;
export const GENERAL_RESTRICTIONS_MAX = 2000;
export const RATING_RESTRICTIONS_MAX = 500;
/** v1.8 connected: at most 40 ratings; at most 200 blocked organizations (`server/app.mjs:70`). */
export const TYPE_RATINGS_MAX = 40;
export const BLOCKED_ORGANIZATIONS_MAX = 200;
/** v1.8 demo: «Tarifa mínima» ≥ 0.01 (no real money, OD-7); the upper bound only keeps typos out. */
export const MIN_RATE_MIN = 0.01;
export const MIN_RATE_MAX = 100000;

/** A declared type rating: aircraft × licence category (v1.8 `ratings`). Not verified evidence. */
export interface TypeRating {
  aircraft: Aircraft;
  category: LicenceCategory;
  /** `YYYY-MM-DD` or null when no validity applies («La fecha es opcional cuando no aplique»). */
  expiresAt: string | null;
  restrictions: string | null;
}

/** Declarations readable by the owner, their own organization's admins/managers and platform admins. */
export interface PassportDeclarations {
  primaryCategory: ProfessionalCategory | null;
  categories: ProfessionalCategory[];
  aircraft: Aircraft[];
  engines: Engine[];
  skills: Skill[];
  englishLevel: EnglishLevel | null;
  ownTools: boolean;
  /** Country of the usual base (OD-6 default: an EU member state). */
  baseCountry: EuCountry | null;
  workPermits: EuCountry[];
  generalRestrictions: string | null;
  typeRatings: TypeRating[];
}

/** Owner-only data (D-07: contact is never shared without the Candidate Pack consents; OD-7: rate). */
export interface PassportPrivate {
  phone: string | null;
  currentEmployerId: string | null;
  minRate: number | null;
  rateUnit: RateUnit;
  /** Organizations that must not find this professional in their external candidate pool. */
  blockedOrganizationIds: string[];
}

/**
 * What an organization's admin/manager sees of a candidate's declarations next to the match
 * (`get_requirement_candidate_passports`): never contact, employer, rate, blocks or restriction text.
 */
export interface CandidatePassport {
  primaryCategory: ProfessionalCategory | null;
  categories: ProfessionalCategory[];
  aircraft: Aircraft[];
  englishLevel: EnglishLevel | null;
  workPermits: EuCountry[];
  hasRestrictions: boolean;
}

/** Keeps the catalog order (and drops repeats) whatever order the values arrive in. */
export function inCatalogOrder<T extends string>(catalog: readonly T[], values: readonly T[]): T[] {
  const chosen = new Set(values);
  return catalog.filter((value) => chosen.has(value));
}

type Underscored<S extends string> = S extends `${infer A}.${infer B}`
  ? Underscored<`${A}_${B}`>
  : S extends `${infer A}-${infer B}`
    ? Underscored<`${A}_${B}`>
    : S;

/** next-intl keys cannot contain dots: `B1.1` → `B1_1`, `SHEET-METAL` → `SHEET_METAL`. */
export const categoryKey = <C extends ProfessionalCategory>(category: C) =>
  category.replace(/[.-]/g, "_") as Underscored<C>;

/** True when the text declares a restriction (v1.8 `restrictions?.trim()`). */
export const declaresRestriction = (text: string | null | undefined) =>
  (text ?? "").trim().length > 0;

/** Any general restriction or any restricted rating (v1.8 «Con restricciones»). */
export function hasRestrictions(
  passport: Pick<PassportDeclarations, "generalRestrictions" | "typeRatings">,
): boolean {
  return (
    declaresRestriction(passport.generalRestrictions) ||
    passport.typeRatings.some((rating) => declaresRestriction(rating.restrictions))
  );
}

/** CEFR comparison for a future «Inglés mínimo» filter: no declared level never meets a minimum. */
export function meetsEnglishLevel(held: EnglishLevel | null, required: EnglishLevel): boolean {
  return held !== null && ENGLISH_LEVELS.indexOf(held) >= ENGLISH_LEVELS.indexOf(required);
}
