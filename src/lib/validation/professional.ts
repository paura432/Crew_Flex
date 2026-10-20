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
import { QUALIFICATION_STATUSES } from "../../domain/qualification.ts";

const optionalText = (max: number, textKey: string, maxKey: string) =>
  z
    .string(textKey)
    .trim()
    .max(max, maxKey)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable();

/** Full replacement of the editable profile fields (no partial updates: one rule set, one form). */
export const updateProfessionalProfileInput = z.strictObject({
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
  /** Optimistic concurrency: the `updatedAt` the form was rendered with (409 if it changed). */
  expectedUpdatedAt: z.iso
    .datetime({ offset: true, error: "v.date.invalid" })
    .nullable()
    .optional(),
});
export type UpdateProfessionalProfileInput = z.infer<typeof updateProfessionalProfileInput>;

const isoDate = () => z.iso.date({ error: "v.date.invalid" }).nullable();

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
