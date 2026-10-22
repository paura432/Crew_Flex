// «Organización» screen and the platform admin's organization review (OD-5 default = v1.8 connected;
// migration 20261023500100). Shared by the forms, the server actions and the `organization-profile` /
// `organization-reviews` Edge Functions. Deno-compatible imports (relative, `.ts`).
//
// The organization id is the TARGET, never an identity: who may act is read from the database
// (membership role / platform role). Every schema is strict, so `reviewStatus`, `role`,
// `platformRole`… in a payload are rejected. Messages are i18n keys (`v.*`).
import {
  EU_COUNTRIES,
  ORGANIZATION_NAME_MAX,
  ORGANIZATION_NAME_MIN,
  ORGANIZATION_REVIEW_NOTE_MAX,
  ORGANIZATION_TYPES,
  TAX_ADDRESS_MAX,
  TAX_ID_MAX,
} from "../../domain/organization.ts";
import { z } from "./zod.ts";

const version = z.iso.datetime({ offset: true, error: "v.invalid" });

/** Full replacement of the editable data (v1.8 «Guardar organización»: every field required). */
export const updateOrganizationInput = z.strictObject({
  organizationId: z.uuid("v.invalid"),
  /** Optimistic concurrency: the `updatedAt` the form was rendered with (409 if it changed). */
  expectedUpdatedAt: version,
  name: z
    .string("v.orgName.min")
    .trim()
    .min(ORGANIZATION_NAME_MIN, "v.orgName.min")
    .max(ORGANIZATION_NAME_MAX, "v.orgName.max"),
  type: z.enum(ORGANIZATION_TYPES, "v.orgType.invalid"),
  country: z.enum(EU_COUNTRIES, "v.organization.countryEu"),
  taxId: z
    .string("v.organization.taxIdRequired")
    .trim()
    .min(1, "v.organization.taxIdRequired")
    .max(TAX_ID_MAX, "v.organization.taxIdMax"),
  taxAddress: z
    .string("v.organization.taxAddressRequired")
    .trim()
    .min(1, "v.organization.taxAddressRequired")
    .max(TAX_ADDRESS_MAX, "v.organization.taxAddressMax"),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationInput>;

export const organizationIdQuery = z.strictObject({
  organizationId: z.uuid("v.invalid"),
});

/** «Registrar revisión»: the version the reviewer looked at and the evidence (always required). */
export const reviewOrganizationInput = z.strictObject({
  organizationId: z.uuid("v.invalid"),
  expectedUpdatedAt: version,
  note: z
    .string("v.organizationReview.noteRequired")
    .trim()
    .min(1, "v.organizationReview.noteRequired")
    .max(ORGANIZATION_REVIEW_NOTE_MAX, "v.organizationReview.noteMax"),
});
export type ReviewOrganizationInput = z.infer<typeof reviewOrganizationInput>;
