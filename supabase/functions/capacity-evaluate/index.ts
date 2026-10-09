// POST /capacity-evaluate { requirementId } → required · internally eligible · gap · coverage
import { requireActor, requireOrganizationRole } from "../_shared/auth.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { loadCandidatePool, loadRequirement, toCandidateSummary } from "../_shared/requirements.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import { evaluateCapacity, InvalidRequirementError } from "../../../src/domain/capacity.ts";
import { compareMatches } from "../../../src/domain/matching.ts";
import { evaluateRequirementInput } from "../../../src/lib/validation/work-requirement.ts";
import type { CapacityResponse } from "../../../src/types/api.ts";

export const handler = createHandler("capacity-evaluate", {
  POST: async (ctx) => {
    const actor = await requireActor(ctx);
    const { requirementId } = await parseJsonBody(ctx.req, evaluateRequirementInput);
    const requirement = await loadRequirement(actor, requirementId);
    await requireOrganizationRole(actor, requirement.organizationId, ["admin", "manager"]);

    const workforce = (await loadCandidatePool(actor, requirementId)).filter(
      (c) => c.pool === "internal",
    );

    let evaluation;
    try {
      evaluation = evaluateCapacity(requirement, workforce);
    } catch (error) {
      if (error instanceof InvalidRequirementError)
        throw new ApiError("VALIDATION_ERROR", error.message);
      throw error;
    }

    const byId = new Map(workforce.map((c) => [c.id, c]));
    const { internalMatches, ...capacity } = evaluation;
    const internal = [...internalMatches].sort(compareMatches).map((match) => ({
      candidate: toCandidateSummary(byId.get(match.candidateId)!),
      match,
    }));

    return { data: { requirementId, capacity, internal } satisfies CapacityResponse };
  },
});

if (import.meta.main) Deno.serve(handler);
