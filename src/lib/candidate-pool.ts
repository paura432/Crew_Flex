// Row → domain mapping of get_requirement_candidate_pool(). One implementation shared by the Edge
// Functions (Deno) and the database tests (Node). Rows are parsed, not cast, so schema drift fails
// loudly instead of corrupting eligibility. Deno-compatible imports (relative, `.ts`, bare "zod").
import { z } from "zod";
import { AVAILABILITY_STATUSES, type AvailabilityStatus } from "../domain/availability.ts";
import type { Candidate } from "../domain/matching.ts";
import { QUALIFICATION_STATUSES, VERIFICATION_STATUSES } from "../domain/qualification.ts";

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
  };
}
