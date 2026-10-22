// Data access + row → domain mapping for work requirements and candidate pools.
// Rows are parsed (not cast) so schema drift fails loudly instead of corrupting results.
import { z } from "zod";
import type { Candidate } from "../../../src/domain/matching.ts";
import {
  isEvaluable,
  REQUIREMENT_LEVELS,
  type RequiredQualification,
  REQUIREMENT_STATUSES,
  SHIFTS,
  URGENCIES,
  type WorkRequirement,
} from "../../../src/domain/work-requirement.ts";
import type { CandidatePassport } from "../../../src/domain/passport.ts";
import { toCandidate, toCandidatePassport } from "../../../src/lib/candidate-pool.ts";

export { toCandidate };
import type { CandidateSummary, ExternalPoolCoverage } from "../../../src/types/api.ts";
import type { Actor } from "./auth.ts";
import { ApiError, fromDatabaseError } from "./errors.ts";

export const REQUIREMENT_SELECT = `
  id, organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_at,
  updated_at, work_requirement_qualifications ( requirement_level, qualification_types ( id, code, name ) )
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
  updated_at: z.string(),
  work_requirement_qualifications: z.array(
    z.object({
      requirement_level: z.enum(REQUIREMENT_LEVELS),
      qualification_types: z.object({ id: z.string(), code: z.string(), name: z.string() }),
    }),
  ),
});

export const toIso = (value: string) => new Date(value).toISOString();

/** Hard first, then by code: stable, readable ordering everywhere. */
export const byLevelThenCode = (a: RequiredQualification, b: RequiredQualification) =>
  a.level === b.level ? a.code.localeCompare(b.code) : a.level === "hard" ? -1 : 1;

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
    updatedAt: toIso(row.updated_at),
    qualifications: row.work_requirement_qualifications
      .map((q) => ({
        qualificationTypeId: q.qualification_types.id,
        code: q.qualification_types.code,
        name: q.qualification_types.name,
        level: q.requirement_level,
      }))
      .sort(byLevelThenCode),
  };
}

/** Loads a requirement visible to the actor (RLS). Hidden and missing look the same. */
/** V1.8 evaluates published jobs only: a paused or closed need exposes no candidate pool (BR-1.9, M05). */
export function assertEvaluableStatus(requirement: Pick<WorkRequirement, "status">): void {
  if (!isEvaluable(requirement))
    throw new ApiError("CONFLICT", `This requirement is ${requirement.status}.`);
}

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

const coverageRow = z.object({
  prefiltered: z.number().int().min(0),
  hard_eligible: z.number().int().min(0),
  cap: z.number().int().min(1),
});

/** Counts that tell the UI whether the capped external pool was exhaustive (no identities). */
export async function loadExternalPoolCoverage(
  actor: Actor,
  requirementId: string,
): Promise<ExternalPoolCoverage> {
  const { data, error } = await actor.client.rpc("get_requirement_external_pool_summary", {
    p_requirement_id: requirementId,
  });
  if (error) throw fromDatabaseError(error);
  const row = coverageRow.parse(Array.isArray(data) ? data[0] : data);
  return { prefiltered: row.prefiltered, hardEligible: row.hard_eligible, cap: row.cap };
}

/**
 * The v1.8 card declarations of the same pool rows (package passport), by candidate reference. The
 * definer function calls get_requirement_candidate_pool itself, so its authorization, cap, order and
 * blocks apply unchanged; it never returns contact, employer, rate, blocks or restriction text.
 */
export async function loadCandidatePassports(
  actor: Actor,
  requirementId: string,
): Promise<Map<string, CandidatePassport>> {
  const { data, error } = await actor.client.rpc("get_requirement_candidate_passports", {
    p_requirement_id: requirementId,
  });
  if (error) throw fromDatabaseError(error);
  return new Map(z.array(z.unknown()).parse(data).map(toCandidatePassport));
}

export function toCandidateSummary(
  candidate: Candidate,
  passport?: CandidatePassport | null,
): CandidateSummary {
  return {
    id: candidate.id,
    pool: candidate.pool,
    displayName: candidate.displayName,
    baseLocation: candidate.baseLocation,
    yearsExperience: candidate.yearsExperience,
    ...(passport === undefined ? {} : { passport }),
  };
}
