// Organization data, its review by a platform admin and «Empresas verificadas» (BR-8, BR-16).
// Pure: no I/O, no framework imports. Shared by Next.js and Supabase Edge Functions.
// The arrays mirror the database enums (`organization_type`, `organization_review_status`); the
// generated types in `src/types/database.generated.ts` are the check.
import type { ProfileVisibility } from "./professional.ts";

export const ORGANIZATION_TYPES = [
  "mro",
  "airline",
  "operator",
  "staffing_agency",
  "other",
] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

/** OD-5 default (v1.8 connected): `pending` until a platform admin registers the review. */
export const ORGANIZATION_REVIEW_STATUSES = ["pending", "reviewed"] as const;
export type OrganizationReviewStatus = (typeof ORGANIZATION_REVIEW_STATUSES)[number];

export const ORGANIZATION_NAME_MIN = 2;
export const ORGANIZATION_NAME_MAX = 160;
/** v1.8 `server/app.mjs:83`: «Identificación fiscal» ≤ 80, «Domicilio» ≤ 400. */
export const TAX_ID_MAX = 80;
export const TAX_ADDRESS_MAX = 400;
/** v1.8 «Evidencia / observaciones de la revisión» ≤ 2000, mandatory for every review. */
export const ORGANIZATION_REVIEW_NOTE_MAX = 2000;

/**
 * The 27 EU member states, v1.8 `server/rules.mjs` COUNTRIES (OD-6 default, T-16), in that order.
 * The screen shows their names with `Intl.DisplayNames`; the code is what is stored (ISO 3166-1).
 */
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

/** The fields a review is about. */
export interface OrganizationReviewData {
  country: string | null;
  taxId: string | null;
  taxAddress: string | null;
}

/**
 * BR-16: a platform admin can register the review only of a `pending` organization whose fiscal data
 * is complete, and never of an organization they belong to (`review_organization` enforces the same).
 */
export function reviewBlocker(
  org: OrganizationReviewData & { reviewStatus: OrganizationReviewStatus },
  reviewerIsMember: boolean,
): "own" | "reviewed" | "incomplete" | null {
  if (reviewerIsMember) return "own";
  if (org.reviewStatus !== "pending") return "reviewed";
  if (!org.country || !org.taxId?.trim() || !org.taxAddress?.trim()) return "incomplete";
  return null;
}

/**
 * BR-8: may an organization's external candidate pool include a professional with this visibility?
 * `private` never; `anonymous` and `open` always; `verified_orgs` only when that organization's
 * review is registered. Internal members are always in the internal pool, whatever their visibility.
 * Mirrors `app_private.ranked_external_pool` (parity in tests/db/admin-org.test.ts).
 */
export function isExternallyMatchable(
  visibility: ProfileVisibility,
  organizationReviewStatus: OrganizationReviewStatus,
): boolean {
  switch (visibility) {
    case "private":
      return false;
    case "verified_orgs":
      return organizationReviewStatus === "reviewed";
    case "anonymous":
    case "open":
      return true;
  }
}
