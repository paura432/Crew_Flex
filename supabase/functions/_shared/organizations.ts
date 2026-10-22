// Row → contract mapping of an organization, shared by `organization-profile` and
// `organization-reviews` (one projection; the review evidence is never part of it).
import { z } from "zod";
import {
  ORGANIZATION_REVIEW_STATUSES,
  ORGANIZATION_TYPES,
} from "../../../src/domain/organization.ts";
import type { OrganizationProfile } from "../../../src/types/api.ts";

export const ORGANIZATION_SELECT =
  "id, name, type, country, tax_id, tax_address, review_status, reviewed_at, updated_at";

const iso = (value: string) => new Date(value).toISOString();

const row = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(ORGANIZATION_TYPES),
  country: z.string().nullable(),
  tax_id: z.string().nullable(),
  tax_address: z.string().nullable(),
  review_status: z.enum(ORGANIZATION_REVIEW_STATUSES),
  reviewed_at: z.string().nullable(),
  updated_at: z.string(),
});

export function toOrganization(raw: unknown): OrganizationProfile {
  const r = row.parse(raw);
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    country: r.country,
    taxId: r.tax_id,
    taxAddress: r.tax_address,
    reviewStatus: r.review_status,
    reviewedAt: r.reviewed_at ? iso(r.reviewed_at) : null,
    updatedAt: iso(r.updated_at),
  };
}
