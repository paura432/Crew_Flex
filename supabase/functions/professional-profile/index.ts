// Professional profile — own data only ("Mi pasaporte": identity, v1.8 declarations, private data).
//   GET   /professional-profile → { profile, organizations }: own passport (profiles.display_name +
//         technician_profiles + own private row, blocks and declared type ratings) and the organizations
//         that can be named as employer or blocked (list_blockable_organizations)
//   PATCH /professional-profile { …every field of `profile` but updatedAt…, expectedUpdatedAt? }
//         → atomic RPC save_professional_passport (all of it or nothing; 409 if changed since
//           expectedUpdatedAt)
// The technician is ALWAYS the JWT subject: the body never carries ownership. The new columns and
// tables have no write grant: the DEFINER RPC is their only writer and keys every row by auth.uid().
// Reads go through RLS (owner-only for phone, employer, rate and blocks). `platform_role`,
// `account_type` and `verification_status` are not reachable from here.
import { z } from "zod";
import { requireActor, type Actor } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import {
  AIRCRAFT,
  ENGINES,
  ENGLISH_LEVELS,
  EU_COUNTRIES,
  inCatalogOrder,
  LICENCE_CATEGORIES,
  PROFESSIONAL_CATEGORIES,
  RATE_UNITS,
  SKILLS,
} from "../../../src/domain/passport.ts";
import {
  MOBILITIES,
  PROFILE_VISIBILITIES,
  TECHNICIAN_STATUSES,
} from "../../../src/domain/professional.ts";
import {
  PASSPORT_BODY_MAX_BYTES,
  passportPayload,
  updateProfessionalProfileInput,
} from "../../../src/lib/validation/professional.ts";
import type { OrganizationOption, ProfessionalProfileResponse } from "../../../src/types/api.ts";

const PROFILE_SELECT =
  "profile_id, base_location, mobility, years_experience, current_status, visibility, updated_at, " +
  "primary_category, categories, aircraft, engines, skills, english_level, own_tools, base_country, " +
  "work_permits, general_restrictions, profiles!inner ( display_name, updated_at )";

const profileRow = z.object({
  profile_id: z.string(),
  base_location: z.string().nullable(),
  mobility: z.enum(MOBILITIES),
  years_experience: z.number().int().nullable(),
  current_status: z.enum(TECHNICIAN_STATUSES),
  visibility: z.enum(PROFILE_VISIBILITIES),
  updated_at: z.string(),
  primary_category: z.enum(PROFESSIONAL_CATEGORIES).nullable(),
  categories: z.array(z.enum(PROFESSIONAL_CATEGORIES)),
  aircraft: z.array(z.enum(AIRCRAFT)),
  engines: z.array(z.enum(ENGINES)),
  skills: z.array(z.enum(SKILLS)),
  english_level: z.enum(ENGLISH_LEVELS).nullable(),
  own_tools: z.boolean(),
  base_country: z.enum(EU_COUNTRIES).nullable(),
  work_permits: z.array(z.enum(EU_COUNTRIES)),
  general_restrictions: z.string().nullable(),
  profiles: z.object({ display_name: z.string(), updated_at: z.string() }),
});

const privateRow = z.object({
  phone: z.string().nullable(),
  current_employer_id: z.string().nullable(),
  // PostgREST returns numeric as a JSON number (or a string for huge values): accept both.
  min_rate: z.union([z.number(), z.string()]).nullable(),
  rate_unit: z.enum(RATE_UNITS),
});

const ratingRow = z.object({
  aircraft: z.enum(AIRCRAFT),
  category: z.enum(LICENCE_CATEGORIES),
  expires_at: z.string().nullable(),
  restrictions: z.string().nullable(),
});

const blockRow = z.object({ organization_id: z.string() });
const organizationRow = z.object({ id: z.string(), name: z.string() });

export interface PassportRows {
  profile: unknown;
  /** `null` until the first save creates the private row. */
  privateDetails: unknown;
  blocks: unknown[];
  ratings: unknown[];
}

/** Rows → API contract. Lists in catalog order; ratings by aircraft, then category. */
export function toProfile(rows: PassportRows): ProfessionalProfileResponse["profile"] {
  const r = profileRow.parse(rows.profile);
  const p = rows.privateDetails === null ? null : privateRow.parse(rows.privateDetails);
  const ratings = z.array(ratingRow).parse(rows.ratings);
  const rank = (list: readonly string[], value: string) => list.indexOf(value);
  // The passport version is technician_profiles.updated_at: every passport save touches it, while
  // profiles.updated_at also moves on a language change (that must not invalidate an open form).
  return {
    displayName: r.profiles.display_name,
    baseLocation: r.base_location,
    mobility: r.mobility,
    yearsExperience: r.years_experience,
    currentStatus: r.current_status,
    visibility: r.visibility,
    primaryCategory: r.primary_category,
    categories: inCatalogOrder(PROFESSIONAL_CATEGORIES, r.categories),
    aircraft: inCatalogOrder(AIRCRAFT, r.aircraft),
    engines: inCatalogOrder(ENGINES, r.engines),
    skills: inCatalogOrder(SKILLS, r.skills),
    englishLevel: r.english_level,
    ownTools: r.own_tools,
    baseCountry: r.base_country,
    workPermits: inCatalogOrder(EU_COUNTRIES, r.work_permits),
    generalRestrictions: r.general_restrictions,
    typeRatings: ratings
      .map((x) => ({
        aircraft: x.aircraft,
        category: x.category,
        expiresAt: x.expires_at,
        restrictions: x.restrictions,
      }))
      .sort(
        (a, b) =>
          rank(AIRCRAFT, a.aircraft) - rank(AIRCRAFT, b.aircraft) ||
          rank(LICENCE_CATEGORIES, a.category) - rank(LICENCE_CATEGORIES, b.category),
      ),
    phone: p?.phone ?? null,
    currentEmployerId: p?.current_employer_id ?? null,
    minRate: p?.min_rate == null ? null : Number(p.min_rate),
    rateUnit: p?.rate_unit ?? "day",
    blockedOrganizationIds: z
      .array(blockRow)
      .parse(rows.blocks)
      .map((b) => b.organization_id)
      .sort(),
    updatedAt: new Date(Date.parse(r.updated_at)).toISOString(),
  };
}

async function readOwnProfile(actor: Actor): Promise<ProfessionalProfileResponse["profile"]> {
  const [profile, privateDetails, blocks, ratings] = await Promise.all([
    actor.client
      .from("technician_profiles")
      .select(PROFILE_SELECT)
      .eq("profile_id", actor.id)
      .maybeSingle(),
    actor.client
      .from("technician_private_details")
      .select("phone, current_employer_id, min_rate, rate_unit")
      .eq("profile_id", actor.id)
      .maybeSingle(),
    actor.client
      .from("technician_organization_blocks")
      .select("organization_id")
      .eq("technician_profile_id", actor.id),
    actor.client
      .from("technician_type_ratings")
      .select("aircraft, category, expires_at, restrictions")
      .eq("technician_profile_id", actor.id),
  ]);
  const error = profile.error ?? privateDetails.error ?? blocks.error ?? ratings.error;
  if (error) throw fromDatabaseError(error);
  if (!profile.data) throw new ApiError("FORBIDDEN", "Only professional accounts have a passport.");
  return toProfile({
    profile: profile.data,
    privateDetails: privateDetails.data,
    blocks: blocks.data ?? [],
    ratings: ratings.data ?? [],
  });
}

/** Professionals only (the RPC re-checks): id and name, sorted by name for the form. */
async function readOrganizations(actor: Actor): Promise<OrganizationOption[]> {
  const { data, error } = await actor.client.rpc("list_blockable_organizations");
  if (error) throw fromDatabaseError(error);
  return z
    .array(organizationRow)
    .parse(data ?? [])
    .map((o) => ({ id: o.id, name: o.name }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

async function readPassport(actor: Actor): Promise<ProfessionalProfileResponse> {
  const profile = await readOwnProfile(actor); // 403 for accounts without a technician profile
  return { profile, organizations: await readOrganizations(actor) };
}

export const handler = createHandler("professional-profile", {
  GET: async (ctx) => {
    const actor = await requireActor(ctx);
    return { data: (await readPassport(actor)) satisfies ProfessionalProfileResponse };
  },

  PATCH: async (ctx) => {
    const actor = await requireActor(ctx);
    const input = await parseJsonBody(ctx.req, updateProfessionalProfileInput, {
      maxBytes: PASSPORT_BODY_MAX_BYTES,
    });
    await readOwnProfile(actor); // professionals only (403 otherwise), before any write

    // One RPC = one transaction: every table of the passport is saved or none is (I-3).
    const { error } = await actor.client.rpc("save_professional_passport", {
      p_passport: passportPayload(input),
      p_expected_updated_at: input.expectedUpdatedAt ?? null,
    });
    if (error) throw fromDatabaseError(error); // CF412 → CONFLICT (changed elsewhere since loaded)

    return { data: (await readPassport(actor)) satisfies ProfessionalProfileResponse };
  },
});

if (import.meta.main) Deno.serve(handler);
