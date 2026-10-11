// Shared by the profile/qualification forms, the server actions and the `professional-profile` /
// `professional-qualifications` Edge Functions. Deno-compatible imports (relative, `.ts`, bare "zod").
//
// Identity never travels in a payload: the technician is the JWT subject. Every schema is strict so
// `profileId`, `technicianProfileId`, `verificationStatus`, `platformRole`… are rejected (check E).
import { z } from "zod";
import {
  BASE_LOCATION_MAX,
  DISPLAY_NAME_MAX,
  MOBILITIES,
  PROFILE_VISIBILITIES,
  TECHNICIAN_STATUSES,
  YEARS_EXPERIENCE_MAX,
} from "../../domain/professional.ts";
import { QUALIFICATION_STATUSES } from "../../domain/qualification.ts";

const optionalText = (max: number, label: string) =>
  z
    .string(`${label} must be text`)
    .trim()
    .max(max, `${label} must have at most ${max} characters`)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable();

/** Full replacement of the editable profile fields (no partial updates: one rule set, one form). */
export const updateProfessionalProfileInput = z.strictObject({
  displayName: z
    .string("Professional name is required")
    .trim()
    .min(1, "Professional name is required")
    .max(DISPLAY_NAME_MAX, `Professional name must have at most ${DISPLAY_NAME_MAX} characters`),
  baseLocation: optionalText(BASE_LOCATION_MAX, "Base"),
  mobility: z.enum(MOBILITIES, "Choose local, national or international mobility"),
  yearsExperience: z
    .number("Years of experience must be a number")
    .int("Years of experience must be a whole number")
    .min(0, "Years of experience cannot be negative")
    .max(YEARS_EXPERIENCE_MAX, `Years of experience must be at most ${YEARS_EXPERIENCE_MAX}`)
    .nullable(),
  currentStatus: z.enum(TECHNICIAN_STATUSES, "Choose your current status"),
  visibility: z.enum(PROFILE_VISIBILITIES, "Choose private, anonymous or open"),
});
export type UpdateProfessionalProfileInput = z.infer<typeof updateProfessionalProfileInput>;

const isoDate = (label: string) =>
  z.iso.date({ error: `${label} must be a date (YYYY-MM-DD)` }).nullable();

function refineDates(
  value: { issuedAt: string | null; expiresAt: string | null },
  ctx: z.RefinementCtx,
) {
  if (value.issuedAt && value.expiresAt && value.expiresAt < value.issuedAt) {
    ctx.addIssue({
      code: "custom",
      path: ["expiresAt"],
      message: "Expiry cannot be before the issue date",
    });
  }
}

/** Self-declaration: the type and its dates. Verification is never part of the payload (BR-2.6). */
export const createQualificationInput = z
  .strictObject({
    qualificationTypeId: z.uuid("Select a qualification from the catalog"),
    issuedAt: isoDate("Issue date").default(null),
    expiresAt: isoDate("Expiry date").default(null),
  })
  .superRefine(refineDates);
export type CreateQualificationInput = z.infer<typeof createQualificationInput>;

/** Dates and the held/withdrawn status. The type is immutable: remove and declare again instead. */
export const updateQualificationInput = z
  .strictObject({
    issuedAt: isoDate("Issue date").default(null),
    expiresAt: isoDate("Expiry date").default(null),
    status: z.enum(QUALIFICATION_STATUSES, "Choose active or withdrawn"),
  })
  .superRefine(refineDates);
export type UpdateQualificationInput = z.infer<typeof updateQualificationInput>;

export const qualificationIdQuery = z.strictObject({
  id: z.uuid("A valid qualification id is required"),
});

/** BR-2.7: catalog types flagged `requires_expiry` cannot be declared without an expiry date. */
export function expiryIssueFor(
  type: { code: string; requiresExpiry: boolean },
  expiresAt: string | null,
): { path: string; message: string } | null {
  if (type.requiresExpiry && expiresAt === null) {
    return { path: "expiresAt", message: `${type.code} requires an expiry date` };
  }
  return null;
}
