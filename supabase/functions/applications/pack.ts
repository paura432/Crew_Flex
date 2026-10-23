// Candidate Pack copy (v2-15 + v2-04, BR-25, migration 20261024300000): row → API mapping and the two reads.
// The database decides who may read a copy (get_application_pack: the applicant or the requirement
// organization's admin/manager; anyone else gets the same 404 as a missing id). The DTO is built field by
// field, so a column the database might add one day never reaches the client.
import { z } from "zod";
import { LOGBOOK_CATEGORIES, LOGBOOK_ENVIRONMENTS } from "../../../src/domain/logbook.ts";
import {
  AIRCRAFT,
  ENGINES,
  ENGLISH_LEVELS,
  EU_COUNTRIES,
  LICENCE_CATEGORIES,
  PROFESSIONAL_CATEGORIES,
  RATE_UNITS,
  SKILLS,
} from "../../../src/domain/passport.ts";
import {
  QUALIFICATION_CATEGORIES,
  VERIFICATION_STATUSES,
} from "../../../src/domain/qualification.ts";
import type {
  ApplicationPackResponse,
  CandidatePackCopy,
  CandidatePackPreviewResponse,
} from "../../../src/types/api.ts";
import type { Actor } from "../_shared/auth.ts";
import { requireTechnician } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { toIso } from "../_shared/requirements.ts";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** PostgREST may send `numeric` as a number or a string; NaN/Infinity are refused by z.number(). */
const numeric = z.union([z.number(), z.string()]).transform(Number).pipe(z.number());

const packColumns = z.object({
  copied_at: z.string(),
  primary_category: z.enum(PROFESSIONAL_CATEGORIES).nullable(),
  categories: z.array(z.enum(PROFESSIONAL_CATEGORIES)),
  years_experience: z.number().int().nullable(),
  english_level: z.enum(ENGLISH_LEVELS).nullable(),
  base_location: z.string().nullable(),
  base_country: z.enum(EU_COUNTRIES).nullable(),
  aircraft: z.array(z.enum(AIRCRAFT)),
  engines: z.array(z.enum(ENGINES)),
  skills: z.array(z.enum(SKILLS)),
  work_permits: z.array(z.enum(EU_COUNTRIES)),
  general_restrictions: z.string().nullable(),
  min_rate: numeric.nullable(),
  rate_unit: z.enum(RATE_UNITS).nullable(),
  type_ratings: z.array(
    z.object({
      aircraft: z.enum(AIRCRAFT),
      category: z.enum(LICENCE_CATEGORIES),
      expiresAt: date.nullable(),
      restrictions: z.string().nullable(),
    }),
  ),
  qualifications: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      category: z.enum(QUALIFICATION_CATEGORIES),
      verificationStatus: z.enum(VERIFICATION_STATUSES),
      expiresAt: date.nullable(),
    }),
  ),
  experience: z.array(
    z.object({
      date,
      aircraft: z.string(),
      ata: z.string().nullable(),
      hours: numeric,
      category: z.enum(LOGBOOK_CATEGORIES),
      environment: z.enum(LOGBOOK_ENVIRONMENTS),
      description: z.string(),
    }),
  ),
});
const packRow = packColumns.extend({ application_id: z.string().optional() });

/** One row of `get_application_pack` (with `application_id`) or `get_my_candidate_pack_preview`. */
export function toCandidatePack(raw: unknown): CandidatePackCopy {
  const row = packRow.parse(raw);
  return {
    applicationId: row.application_id ?? null,
    copiedAt: toIso(row.copied_at),
    primaryCategory: row.primary_category,
    categories: row.categories,
    yearsExperience: row.years_experience,
    englishLevel: row.english_level,
    baseLocation: row.base_location,
    baseCountry: row.base_country,
    aircraft: row.aircraft,
    engines: row.engines,
    skills: row.skills,
    workPermits: row.work_permits,
    generalRestrictions: row.general_restrictions,
    minRate:
      row.min_rate === null || row.rate_unit === null
        ? null
        : { amount: row.min_rate, unit: row.rate_unit },
    typeRatings: row.type_ratings.map((r) => ({
      aircraft: r.aircraft,
      category: r.category,
      expiresAt: r.expiresAt,
      restrictions: r.restrictions,
    })),
    qualifications: row.qualifications.map((q) => ({
      code: q.code,
      name: q.name,
      category: q.category,
      verificationStatus: q.verificationStatus,
      expiresAt: q.expiresAt,
    })),
    experience: row.experience.map((e) => ({
      date: e.date,
      aircraft: e.aircraft,
      ata: e.ata,
      hours: e.hours,
      category: e.category,
      environment: e.environment,
      description: e.description,
    })),
  };
}

/** P0002 (not a party, or missing) → 404; zero rows = a party, but this application has no copy. */
export async function loadApplicationPack(
  actor: Actor,
  applicationId: string,
): Promise<ApplicationPackResponse> {
  const { data, error } = await actor.client.rpc("get_application_pack", {
    p_application_id: applicationId,
  });
  if (error) throw fromDatabaseError(error);
  const rows = z.array(z.unknown()).max(1).parse(data);
  const pack = rows.length === 1 ? toCandidatePack(rows[0]) : null;
  if (pack && pack.applicationId !== applicationId) throw new ApiError("INTERNAL_ERROR");
  return { pack };
}

/** Professionals only (403 otherwise); always the caller's own data. */
export async function loadPackPreview(actor: Actor): Promise<CandidatePackPreviewResponse> {
  await requireTechnician(actor);
  const { data, error } = await actor.client.rpc("get_my_candidate_pack_preview");
  if (error) throw fromDatabaseError(error);
  const rows = z.array(z.unknown()).length(1).parse(data);
  return { pack: toCandidatePack(rows[0]) };
}
