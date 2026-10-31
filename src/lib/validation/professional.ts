// Shared by the profile/qualification forms, the server actions and the `professional-profile` /
// `professional-qualifications` Edge Functions. Deno-compatible imports (relative, `.ts`, bare "zod").
//
// Identity never travels in a payload: the technician is the JWT subject. Every schema is strict so
// `profileId`, `technicianProfileId`, `verificationStatus`, `platformRole`… are rejected (check E).
// Messages are i18n keys (`v.*`, messages/*.json) resolved by the UI.
import { z } from "./zod.ts";
import {
  BASE_LOCATION_MAX,
  DISPLAY_NAME_MAX,
  MOBILITIES,
  PROFILE_VISIBILITIES,
  TECHNICIAN_STATUSES,
  YEARS_EXPERIENCE_MAX,
} from "../../domain/professional.ts";
import {
  AIRCRAFT,
  BLOCKED_ORGANIZATIONS_MAX,
  ENGINES,
  ENGLISH_LEVELS,
  EU_COUNTRIES,
  GENERAL_RESTRICTIONS_MAX,
  inCatalogOrder,
  LICENCE_CATEGORIES,
  MIN_RATE_MAX,
  MIN_RATE_MIN,
  PHONE_MAX,
  PHONE_PATTERN,
  PROFESSIONAL_CATEGORIES,
  RATE_UNITS,
  RATING_RESTRICTIONS_MAX,
  SKILLS,
  TYPE_RATINGS_MAX,
} from "../../domain/passport.ts";
import { QUALIFICATION_STATUSES } from "../../domain/qualification.ts";

const optionalText = (max: number, textKey: string, maxKey: string) =>
  z
    .string(textKey)
    .trim()
    .max(max, maxKey)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable();

/** A list of catalog values: no repeats; stored in catalog order whatever order it arrives in. */
const catalogList = <T extends string>(catalog: readonly [T, ...T[]], key: string) =>
  z
    .array(z.enum(catalog, key), key)
    .max(catalog.length, key)
    .refine((values) => new Set(values).size === values.length, key)
    .transform((values) => inCatalogOrder(catalog, values));

/** `YYYY-MM-DD` from 1900 on: Zod accepts year 0000, which Postgres cannot store (review LOW-3). */
const isoDate = () =>
  z.iso
    .date({ error: "v.date.invalid" })
    .refine((value) => value >= "1900-01-01", "v.date.invalid")
    .nullable();

/** v1.8 rating: aircraft × licence category, optional validity, optional restrictions (T-31). */
const typeRatingInput = z.strictObject({
  aircraft: z.enum(AIRCRAFT, "v.passport.rating.aircraft"),
  category: z.enum(LICENCE_CATEGORIES, "v.passport.rating.category"),
  expiresAt: isoDate(),
  restrictions: optionalText(
    RATING_RESTRICTIONS_MAX,
    "v.passport.restrictions.text",
    "v.passport.rating.restrictionsMax",
  ),
});

/**
 * Full replacement of the editable passport (no partial updates: one rule set, one form, one save).
 * V0 identity/experience/visibility plus the v1.8 declarations (T-30…T-35) and the owner-only data.
 */
export const updateProfessionalProfileInput = z
  .strictObject({
    displayName: z
      .string("v.displayName.required")
      .trim()
      .min(1, "v.displayName.required")
      .max(DISPLAY_NAME_MAX, "v.displayName.max"),
    baseLocation: optionalText(BASE_LOCATION_MAX, "v.base.text", "v.base.max"),
    mobility: z.enum(MOBILITIES, "v.mobility.invalid"),
    yearsExperience: z
      .number("v.years.number")
      .int("v.years.int")
      .min(0, "v.years.min")
      .max(YEARS_EXPERIENCE_MAX, "v.years.max")
      .nullable(),
    currentStatus: z.enum(TECHNICIAN_STATUSES, "v.status.invalid"),
    visibility: z.enum(PROFILE_VISIBILITIES, "v.visibility.invalid"),
    // N-01: main category and declared categories and aircraft.
    primaryCategory: z.enum(PROFESSIONAL_CATEGORIES, "v.passport.primary.required").nullable(),
    categories: catalogList(PROFESSIONAL_CATEGORIES, "v.passport.categories"),
    aircraft: catalogList(AIRCRAFT, "v.passport.aircraft"),
    // N-05: technical English, engines, capabilities, own tools.
    engines: catalogList(ENGINES, "v.passport.engines"),
    skills: catalogList(SKILLS, "v.passport.skills"),
    englishLevel: z.enum(ENGLISH_LEVELS, "v.passport.english").nullable(),
    ownTools: z.boolean("v.passport.ownTools"),
    // N-07: base country and the 27 EU work permits.
    baseCountry: z.enum(EU_COUNTRIES, "v.passport.country").nullable(),
    workPermits: catalogList(EU_COUNTRIES, "v.passport.permits"),
    // N-02: general restrictions and declared type ratings.
    generalRestrictions: optionalText(
      GENERAL_RESTRICTIONS_MAX,
      "v.passport.restrictions.text",
      "v.passport.restrictions.max",
    ),
    typeRatings: z
      .array(typeRatingInput, "v.passport.rating.list")
      .max(TYPE_RATINGS_MAX, "v.passport.rating.max"),
    // N-08 / N-06: owner-only (never shown to organizations).
    phone: optionalText(PHONE_MAX, "v.passport.phone", "v.passport.phone").refine(
      (value) => value === null || PHONE_PATTERN.test(value),
      "v.passport.phone",
    ),
    currentEmployerId: z.uuid("v.passport.organization").nullable(),
    minRate: z
      .number("v.passport.minRate.number")
      .min(MIN_RATE_MIN, "v.passport.minRate.min")
      .max(MIN_RATE_MAX, "v.passport.minRate.max")
      .transform((value) => Math.round(value * 100) / 100)
      .nullable(),
    rateUnit: z.enum(RATE_UNITS, "v.passport.rateUnit"),
    blockedOrganizationIds: z
      .array(z.uuid("v.passport.organization"), "v.passport.organization")
      .max(BLOCKED_ORGANIZATIONS_MAX, "v.passport.blocks.max")
      .refine((ids) => new Set(ids).size === ids.length, "v.passport.organization"),
    /** Optimistic concurrency: the `updatedAt` the form was rendered with (409 if it changed). */
    expectedUpdatedAt: z.iso
      .datetime({ offset: true, error: "v.date.invalid" })
      .nullable()
      .optional(),
  })
  .superRefine((value, ctx) => {
    // v1.8 connected: the main category is one of the declared ones and is never the empty option.
    if (value.primaryCategory !== null && !value.categories.includes(value.primaryCategory)) {
      ctx.addIssue({
        code: "custom",
        path: ["primaryCategory"],
        message: "v.passport.primary.notDeclared",
      });
    }
    if (value.primaryCategory === null && value.categories.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["primaryCategory"],
        message: "v.passport.primary.required",
      });
    }
    // A rating is for an aircraft and a category the professional declares, once each.
    const seen = new Set<string>();
    const aircraft = new Set(value.aircraft);
    const categories = new Set(value.categories);
    value.typeRatings.forEach((rating, index) => {
      const key = `${rating.aircraft}|${rating.category}`;
      if (!aircraft.has(rating.aircraft) || !categories.has(rating.category)) {
        ctx.addIssue({
          code: "custom",
          path: ["typeRatings", index],
          message: "v.passport.rating.undeclared",
        });
      } else if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["typeRatings", index],
          message: "v.passport.rating.duplicate",
        });
      }
      seen.add(key);
    });
  });
export type UpdateProfessionalProfileInput = z.infer<typeof updateProfessionalProfileInput>;

/** The fields the passport save carries (all of the input but the version check). */
export type ProfessionalPassportPayload = Omit<UpdateProfessionalProfileInput, "expectedUpdatedAt">;

/**
 * Body limit of the passport PATCH. The largest VALID body (40 ratings × 500 characters of 3-byte
 * UTF-8, 2000 of general restrictions, 200 blocks…) is ~80 KB, over the 32 KB default of the Edge
 * Functions (security review LOW-2); a test builds that body and checks it fits.
 */
export const PASSPORT_BODY_MAX_BYTES = 128 * 1024;

/**
 * The `p_passport` argument of `save_professional_passport`: the validated input without the version
 * (which travels as `p_expected_updated_at`). The SQL function checks it carries exactly these keys.
 */
export function passportPayload(
  input: UpdateProfessionalProfileInput,
): ProfessionalPassportPayload {
  const passport: Partial<UpdateProfessionalProfileInput> = { ...input };
  delete passport.expectedUpdatedAt;
  return passport as ProfessionalPassportPayload;
}

function refineDates(
  value: { issuedAt: string | null; expiresAt: string | null },
  ctx: z.RefinementCtx,
) {
  if (value.issuedAt && value.expiresAt && value.expiresAt < value.issuedAt) {
    ctx.addIssue({
      code: "custom",
      path: ["expiresAt"],
      message: "v.expiry.beforeIssue",
    });
  }
}

/** Self-declaration: the type and its dates. Verification is never part of the payload (BR-2.6). */
export const createQualificationInput = z
  .strictObject({
    qualificationTypeId: z.uuid("v.qualification.select"),
    issuedAt: isoDate().default(null),
    expiresAt: isoDate().default(null),
  })
  .superRefine(refineDates);
export type CreateQualificationInput = z.infer<typeof createQualificationInput>;

/** Dates and the held/withdrawn status. The type is immutable: remove and declare again instead. */
export const updateQualificationInput = z
  .strictObject({
    issuedAt: isoDate().default(null),
    expiresAt: isoDate().default(null),
    status: z.enum(QUALIFICATION_STATUSES, "v.qualification.status"),
  })
  .superRefine(refineDates);
export type UpdateQualificationInput = z.infer<typeof updateQualificationInput>;

export const qualificationIdQuery = z.strictObject({
  id: z.uuid("v.qualification.id"),
});

/** BR-2.7: catalog types flagged `requires_expiry` cannot be declared without an expiry date. */
export function expiryIssueFor(
  type: { code: string; requiresExpiry: boolean },
  expiresAt: string | null,
): { path: string; message: string } | null {
  if (type.requiresExpiry && expiresAt === null) {
    return { path: "expiresAt", message: "v.expiry.required" };
  }
  return null;
}
