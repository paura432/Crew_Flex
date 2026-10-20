// POST /matching-evaluate { requirementId } → deterministic, explainable external matches.
// LLM ≠ eligibility engine: this is pure rule evaluation (src/domain/matching.ts).
import { requireActor, requireOrganizationRole } from "../_shared/auth.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import {
  loadCandidatePool,
  loadExternalPoolCoverage,
  loadRequirement,
  toCandidateSummary,
} from "../_shared/requirements.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import {
  assertEvaluableRequirement,
  InvalidRequirementError,
} from "../../../src/domain/capacity.ts";
import { compareMatches, evaluateMatch } from "../../../src/domain/matching.ts";
import { evaluateRequirementInput } from "../../../src/lib/validation/work-requirement.ts";
import type { MatchingResponse } from "../../../src/types/api.ts";

export const handler = createHandler("matching-evaluate", {
  POST: async (ctx) => {
    const actor = await requireActor(ctx);
    const { requirementId } = await parseJsonBody(ctx.req, evaluateRequirementInput);
    const requirement = await loadRequirement(actor, requirementId);
    await requireOrganizationRole(actor, requirement.organizationId, ["admin", "manager"]);
    // V1.8 evaluates published jobs only: a closed need no longer exposes the candidate pool.
    if (requirement.status === "closed")
      throw new ApiError("CONFLICT", "This requirement is closed.");
    try {
      assertEvaluableRequirement(requirement);
    } catch (error) {
      if (error instanceof InvalidRequirementError)
        throw new ApiError("VALIDATION_ERROR", error.message);
      throw error;
    }

    const [pool, coverage] = await Promise.all([
      loadCandidatePool(actor, requirementId),
      loadExternalPoolCoverage(actor, requirementId),
    ]);
    const external = pool.filter((c) => c.pool === "external");
    const candidates = external
      .map((candidate) => ({
        candidate: toCandidateSummary(candidate),
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
