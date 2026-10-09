// Data access + row → domain mapping for work requirements and candidate pools.
// Rows are parsed (not cast) so schema drift fails loudly instead of corrupting results.
import { z } from "zod";
import { AVAILABILITY_STATUSES } from "../../../src/domain/availability.ts";
import type { Candidate } from "../../../src/domain/matching.ts";
import {
  QUALIFICATION_STATUSES,
  VERIFICATION_STATUSES,
} from "../../../src/domain/qualification.ts";
import {
  REQUIREMENT_LEVELS,
  REQUIREMENT_STATUSES,
  SHIFTS,
  URGENCIES,
  type WorkRequirement,
} from "../../../src/domain/work-requirement.ts";
import type { CandidateSummary } from "../../../src/types/api.ts";
import type { Actor } from "./auth.ts";
import { ApiError, fromDatabaseError } from "./errors.ts";

export const REQUIREMENT_SELECT = `
  id, organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_at,
  work_requirement_qualifications ( requirement_level, qualification_types ( id, code, name ) )
`;

const requirementRow = z.object({
  id: z.string(),
  organization_id: z.string(),
  title: z.string(),
  location: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  shift: z.enum(SHIFTS),
  headcount: z.number(),
  urgency: z.enum(URGENCIES),
  status: z.enum(REQUIREMENT_STATUSES),
  created_at: z.string(),
  work_requirement_qualifications: z.array(
    z.object({
      requirement_level: z.enum(REQUIREMENT_LEVELS),
      qualification_types: z.object({ id: z.string(), code: z.string(), name: z.string() }),
    }),
  ),
});

const toIso = (value: string) => new Date(value).toISOString();

export function toWorkRequirement(raw: unknown): WorkRequirement {
  const row = requirementRow.parse(raw);
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    location: row.location,
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    shift: row.shift,
    headcount: row.headcount,
    urgency: row.urgency,
    status: row.status,
    createdAt: toIso(row.created_at),
    qualifications: row.work_requirement_qualifications
      .map((q) => ({
        qualificationTypeId: q.qualification_types.id,
        code: q.qualification_types.code,
        name: q.qualification_types.name,
        level: q.requirement_level,
      }))
      // Hard first, then by code: stable, readable ordering everywhere.
      .sort((a, b) =>
        a.level === b.level ? a.code.localeCompare(b.code) : a.level === "hard" ? -1 : 1,
      ),
  };
}

/** Loads a requirement visible to the actor (RLS). Hidden and missing look the same. */
export async function loadRequirement(actor: Actor, id: string): Promise<WorkRequirement> {
  const { data, error } = await actor.client
    .from("work_requirements")
    .select(REQUIREMENT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw fromDatabaseError(error);
  if (!data) throw new ApiError("NOT_FOUND");
  return toWorkRequirement(data);
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
    z.object({ startsAt: z.string(), endsAt: z.string(), status: z.enum(AVAILABILITY_STATUSES) }),
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

/**
 * Matchable data for both pools in ONE database call (no N+1). The definer function
 * re-checks that the actor is admin/manager of the requirement's organization.
 */
export async function loadCandidatePool(actor: Actor, requirementId: string): Promise<Candidate[]> {
  const { data, error } = await actor.client.rpc("get_requirement_candidate_pool", {
    p_requirement_id: requirementId,
  });
  if (error) throw fromDatabaseError(error);
  return z.array(z.unknown()).parse(data).map(toCandidate);
}

export function toCandidateSummary(candidate: Candidate): CandidateSummary {
  return {
    id: candidate.id,
    pool: candidate.pool,
    displayName: candidate.displayName,
    baseLocation: candidate.baseLocation,
    yearsExperience: candidate.yearsExperience,
  };
}
