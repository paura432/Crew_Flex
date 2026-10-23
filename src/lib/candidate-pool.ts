// Row → domain mapping of the matching inputs: candidate rows (get_requirement_candidate_pool,
// own_candidate_profile, get_requirement_applications — same columns; the directory rows of
// search_candidate_directory reuse `toDeclarations`), their companion
// get_requirement_candidate_passports() (package passport) and a requirement's v1.8 profile rules
// (work_requirements columns / get_requirement_profile_rules, package matching-v18). One implementation
// shared by the Edge Functions (Deno) and the database tests (Node). Rows are parsed, not cast, so schema
// drift fails loudly instead of corrupting eligibility. Deno-compatible imports (relative, `.ts`, bare "zod").
import { z } from "./validation/zod.ts";
import { AVAILABILITY_STATUSES, type AvailabilityStatus } from "../domain/availability.ts";
import type { Candidate, CandidateDeclarations, DeclaredTypeRating } from "../domain/matching.ts";
import {
  AIRCRAFT,
  ENGINES,
  ENGLISH_LEVELS,
  EU_COUNTRIES,
  inCatalogOrder,
  LICENCE_CATEGORIES,
  PROFESSIONAL_CATEGORIES,
  SKILLS,
  type CandidatePassport,
} from "../domain/passport.ts";
import { MOBILITIES } from "../domain/professional.ts";
import { QUALIFICATION_STATUSES, VERIFICATION_STATUSES } from "../domain/qualification.ts";
import type { RequirementProfileRules } from "../domain/work-requirement.ts";

const toIso = (value: string) => new Date(value).toISOString();

/**
 * Deliberate exception to "fail loudly": an availability status this code does not know yet (e.g. a
 * value added by a migration applied before the functions were redeployed) is read as
 * `unavailable`. It can only ever remove availability, never grant eligibility, and one
 * professional's window can no longer make every pool containing them fail (review HIGH-1,
 * 2026-10-19).
 */
export function availabilityStatus(value: string): AvailabilityStatus {
  return (AVAILABILITY_STATUSES as readonly string[]).includes(value)
    ? (value as AvailabilityStatus)
    : "unavailable";
}

/** app_private.candidate_declarations (20261023900100): camelCase, catalog values as stored. */
export const candidateDeclarationsRow = z.object({
  primaryCategory: z.string().nullable(),
  categories: z.array(z.string()),
  aircraft: z.array(z.string()),
  engines: z.array(z.string()),
  skills: z.array(z.string()),
  englishLevel: z.string().nullable(),
  mobility: z.string(),
  workPermits: z.array(z.string()),
  typeRatings: z.array(
    z.object({
      aircraft: z.string(),
      category: z.string(),
      expiresAt: z.string().nullable(),
      restricted: z.boolean(),
    }),
  ),
  hasRestrictions: z.boolean(),
});

const poolRow = z.object({
  candidate_ref: z.string(),
  candidate_pool: z.enum(["internal", "external"]),
  candidate_display_name: z.string().nullable(),
  candidate_base_location: z.string().nullable(),
  candidate_years_experience: z.number().nullable(),
  candidate_qualifications: z.array(
    z.object({
      qualificationTypeId: z.string(),
      code: z.string(),
      status: z.enum(QUALIFICATION_STATUSES),
      verificationStatus: z.enum(VERIFICATION_STATUSES),
      expiresAt: z.string().nullable(),
    }),
  ),
  candidate_availability: z.array(
    z.object({
      startsAt: z.string(),
      endsAt: z.string(),
      status: z.string().transform(availabilityStatus),
    }),
  ),
  candidate_declarations: candidateDeclarationsRow,
});

const passportRow = z.object({
  candidate_ref: z.string(),
  primary_category: z.string().nullable(),
  categories: z.array(z.string()),
  aircraft: z.array(z.string()),
  english_level: z.string().nullable(),
  work_permits: z.array(z.string()),
  has_restrictions: z.boolean(),
});

const known = <T extends string>(catalog: readonly T[], value: string | null): T | null =>
  value !== null && (catalog as readonly string[]).includes(value) ? (value as T) : null;
const knownList = <T extends string>(catalog: readonly T[], values: string[]): T[] =>
  inCatalogOrder(
    catalog,
    values.filter((v): v is T => known(catalog, v) !== null),
  );

/**
 * Row of get_requirement_candidate_passports() → [candidate ref, declarations]. Display-only data, so
 * the second deliberate exception to "fail loudly": a value this code does not know yet (added by a
 * later migration) is dropped instead of failing the whole candidate list. It never reaches eligibility.
 */
export function toCandidatePassport(raw: unknown): [string, CandidatePassport] {
  const row = passportRow.parse(raw);
  return [
    row.candidate_ref,
    {
      primaryCategory: known(PROFESSIONAL_CATEGORIES, row.primary_category),
      categories: knownList(PROFESSIONAL_CATEGORIES, row.categories),
      aircraft: knownList(AIRCRAFT, row.aircraft),
      englishLevel: known(ENGLISH_LEVELS, row.english_level),
      workPermits: knownList(EU_COUNTRIES, row.work_permits),
      hasRestrictions: row.has_restrictions,
    },
  ];
}

/**
 * The candidate's declarations. Third deliberate exception to "fail loudly", in the safe direction only: a
 * value this code does not know yet is dropped (an unknown category, aircraft, permit… can only stop matching
 * a stated rule, never satisfy one) and an unknown mobility reads as `local` (no affinity). Requirement rules
 * are parsed strictly (`profileRulesColumns`): dropping one of those would make people eligible.
 */
export function toDeclarations(
  raw: z.infer<typeof candidateDeclarationsRow>,
): CandidateDeclarations {
  const typeRatings: DeclaredTypeRating[] = [];
  for (const r of raw.typeRatings) {
    const aircraft = known(AIRCRAFT, r.aircraft);
    const category = known(LICENCE_CATEGORIES, r.category);
    if (aircraft && category)
      typeRatings.push({ aircraft, category, expiresAt: r.expiresAt, restricted: r.restricted });
  }
  return {
    primaryCategory: known(PROFESSIONAL_CATEGORIES, raw.primaryCategory),
    categories: knownList(PROFESSIONAL_CATEGORIES, raw.categories),
    aircraft: knownList(AIRCRAFT, raw.aircraft),
    engines: knownList(ENGINES, raw.engines),
    skills: knownList(SKILLS, raw.skills),
    englishLevel: known(ENGLISH_LEVELS, raw.englishLevel),
    mobility: known(MOBILITIES, raw.mobility) ?? "local",
    workPermits: knownList(EU_COUNTRIES, raw.workPermits),
    typeRatings,
    hasRestrictions: raw.hasRestrictions,
  };
}

/** The card projection of the declarations (`CandidatePassport`, BR-18) — e.g. for an applicant. */
export const passportOf = (d: CandidateDeclarations): CandidatePassport => ({
  primaryCategory: d.primaryCategory,
  categories: d.categories,
  aircraft: d.aircraft,
  englishLevel: d.englishLevel,
  workPermits: d.workPermits,
  hasRestrictions: d.hasRestrictions,
});

export function toCandidate(raw: unknown): Candidate {
  const row = poolRow.parse(raw);
  return {
    id: row.candidate_ref,
    pool: row.candidate_pool,
    displayName: row.candidate_display_name,
    baseLocation: row.candidate_base_location,
    yearsExperience: row.candidate_years_experience,
    qualifications: row.candidate_qualifications,
    availability: row.candidate_availability.map((w) => ({
      ...w,
      startsAt: toIso(w.startsAt),
      endsAt: toIso(w.endsAt),
    })),
    declarations: toDeclarations(row.candidate_declarations),
  };
}

/**
 * The v1.8 profile rules a requirement states beyond its country (which is a builder term, 20261023600000,
 * read with the other terms): the columns of migration 20261023900000, also those of
 * get_requirement_profile_rules(). Strict on purpose (see `toDeclarations`).
 */
export type RequirementRuleColumns = Required<Omit<RequirementProfileRules, "country">>;
export const PROFILE_RULES_SELECT =
  "category, aircraft, requires_type_rating, engines, min_years, required_skills";
export const profileRulesColumns = {
  category: z.enum(PROFESSIONAL_CATEGORIES).nullable(),
  aircraft: z.array(z.enum(AIRCRAFT)),
  requires_type_rating: z.boolean(),
  engines: z.array(z.enum(ENGINES)),
  min_years: z.number().int().nullable(),
  required_skills: z.array(z.enum(SKILLS)),
};
const profileRulesObject = z.object(profileRulesColumns);

export function toProfileRules(row: z.infer<typeof profileRulesObject>): RequirementRuleColumns {
  return {
    category: row.category,
    aircraft: row.aircraft,
    requiresTypeRating: row.requires_type_rating,
    engines: row.engines,
    minYears: row.min_years,
    requiredSkills: row.required_skills,
  };
}

const profileRulesRow = profileRulesObject.extend({ requirement_id: z.string() });

/** Rows of get_requirement_profile_rules() → requirement id → rules. */
export function toProfileRulesById(rows: readonly unknown[]): Map<string, RequirementRuleColumns> {
  return new Map(
    rows.map((raw) => {
      const row = profileRulesRow.parse(raw);
      return [row.requirement_id, toProfileRules(row)];
    }),
  );
}
