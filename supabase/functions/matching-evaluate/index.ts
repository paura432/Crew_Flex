// POST /matching-evaluate { requirementId } → deterministic, explainable external matches.
// POST /matching-evaluate { organizationId, startsAt, endsAt, urgency, hardQualificationTypeIds } → the
//      requirement builder's live count «{n} candidatos con requisitos y bloques viables» (v2-13, T-21): a
//      COUNT of internal members and visible professionals who pass the hard filters, from the same SQL rule as
//      apply and confirm (count_viable_candidates); admin/manager of that organization only. No identities.
// LLM ≠ eligibility engine: this is pure rule evaluation (src/domain/matching.ts).
import { requireActor, requireOrganizationRole } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import {
  loadCandidatePassports,
  loadCandidatePool,
  loadExternalPoolCoverage,
  assertEvaluableStatus,
  loadRequirement,
  toCandidateSummary,
} from "../_shared/requirements.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import {
  assertEvaluableRequirement,
  InvalidRequirementError,
} from "../../../src/domain/capacity.ts";
import { compareMatches, evaluateMatch } from "../../../src/domain/matching.ts";
import { matchingEvaluateInput } from "../../../src/lib/validation/work-requirement.ts";
import type { MatchingResponse, ViableCandidatesResponse } from "../../../src/types/api.ts";

export const handler = createHandler("matching-evaluate", {
  POST: async (ctx) => {
    const actor = await requireActor(ctx);
    const input = await parseJsonBody(ctx.req, matchingEvaluateInput);

    if ("organizationId" in input) {
      await requireOrganizationRole(actor, input.organizationId, ["admin", "manager"]);
      const { data, error } = await actor.client.rpc("count_viable_candidates", {
        p_organization_id: input.organizationId,
        p_starts_at: input.startsAt,
        p_ends_at: input.endsAt,
        p_urgency: input.urgency,
        p_hard_type_ids: [...new Set(input.hardQualificationTypeIds)],
      });
      if (error) throw fromDatabaseError(error); // 42501 → 403, 22023 → 400
      if (typeof data !== "number") throw new ApiError("INTERNAL_ERROR");
      return { data: { viable: data } satisfies ViableCandidatesResponse };
    }

    const { requirementId } = input;
    const requirement = await loadRequirement(actor, requirementId);
    await requireOrganizationRole(actor, requirement.organizationId, ["admin", "manager"]);
    assertEvaluableStatus(requirement);
    try {
      assertEvaluableRequirement(requirement);
    } catch (error) {
      if (error instanceof InvalidRequirementError)
        throw new ApiError("VALIDATION_ERROR", error.message);
      throw error;
    }

    const [pool, coverage, passports] = await Promise.all([
      loadCandidatePool(actor, requirementId),
      loadExternalPoolCoverage(actor, requirementId),
      loadCandidatePassports(actor, requirementId),
    ]);
    const external = pool.filter((c) => c.pool === "external");
    const candidates = external
      .map((candidate) => ({
        candidate: toCandidateSummary(candidate, passports.get(candidate.id) ?? null),
        match: evaluateMatch(requirement, candidate),
      }))
      .sort((a, b) => compareMatches(a.match, b.match));

    return {
      data: {
        requirementId,
        summary: {
          evaluated: candidates.length,
          eligible: candidates.filter((c) => c.match.eligible).length,
          pool: coverage,
        },
        candidates,
      } satisfies MatchingResponse,
    };
  },
});

if (import.meta.main) Deno.serve(handler);
