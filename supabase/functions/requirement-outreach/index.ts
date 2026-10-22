// «Distribuir aviso Urgente / AOG» (package outreach v2-17; migration 20261024400200, BUSINESS_RULES BR-26).
// Admin/manager of the requirement's organization (role from the database, never from the request).
// GET  /requirement-outreach?requirementId=<uuid> → OutreachStatusResponse { distribution | null }
// POST /requirement-outreach { requirementId }     → 201 OutreachDistributeResponse { distribution }
// The audience is computed by ONE database function (requirement_outreach, DEFINER): one in-app notice
// per recipient, once per requirement. The answer is the COUNT only — never who was notified (S-7).
// Refusals: 404 not visible (same as a missing id), 403 not admin/manager, 409 `reason` =
// OUTREACH_CONFLICTS (not open, planned, already distributed, started). No e-mail, SMS or push (OUT).
import { z } from "zod";
import { type Actor, requireActor, requireOrganizationRole } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { loadRequirement, toIso } from "../_shared/requirements.ts";
import { parseJsonBody, parseQuery } from "../_shared/validation.ts";
import { OUTREACH_URGENCIES } from "../../../src/domain/outreach.ts";
import { outreachRequirementInput } from "../../../src/lib/validation/outreach.ts";
import type {
  OutreachDistributeResponse,
  OutreachDistribution,
  OutreachStatusResponse,
} from "../../../src/types/api.ts";

const distributionRow = z.object({
  requirement_id: z.uuid(),
  urgency: z.enum(OUTREACH_URGENCIES),
  notified_count: z.number().int().min(0),
  created_at: z.string(),
});

const outreachResult = z.object({
  notified: z.number().int().min(0),
  distributed_at: z.string(),
  urgency: z.enum(OUTREACH_URGENCIES),
});

/** A stored distribution (`outreach_distributions` row) → the contract. */
export function toDistribution(raw: unknown): OutreachDistribution {
  const r = distributionRow.parse(raw);
  return {
    requirementId: r.requirement_id,
    urgency: r.urgency,
    notified: r.notified_count,
    distributedAt: toIso(r.created_at),
  };
}

/** The RPC's one row → the contract (no recipient ever travels). */
export function toDistributeResponse(requirementId: string, data: unknown): OutreachDistribution {
  const r = outreachResult.parse(Array.isArray(data) ? data[0] : data);
  return {
    requirementId,
    urgency: r.urgency,
    notified: r.notified,
    distributedAt: toIso(r.distributed_at),
  };
}

/** The requirement must be visible (RLS: its members) and the caller its admin/manager. */
async function authorize(actor: Actor, requirementId: string) {
  const requirement = await loadRequirement(actor, requirementId); // hidden = missing → 404
  await requireOrganizationRole(actor, requirement.organizationId, ["admin", "manager"]);
  return requirement;
}

export const handler = createHandler("requirement-outreach", {
  GET: async (ctx) => {
    const actor = await requireActor(ctx);
    const query = parseQuery(ctx.url, outreachRequirementInput);
    const requirement = await authorize(actor, query.requirementId);
    const { data, error } = await actor.client
      .from("outreach_distributions")
      .select("requirement_id, urgency, notified_count, created_at")
      .eq("requirement_id", requirement.id)
      .maybeSingle();
    if (error) throw fromDatabaseError(error);
    return {
      data: {
        distribution: data ? toDistribution(data) : null,
      } satisfies OutreachStatusResponse,
    };
  },

  POST: async (ctx) => {
    const actor = await requireActor(ctx);
    const input = await parseJsonBody(ctx.req, outreachRequirementInput);
    const requirement = await authorize(actor, input.requirementId);
    const { data, error } = await actor.client.rpc("requirement_outreach", {
      p_requirement_id: requirement.id,
      p_request_id: ctx.requestId,
    });
    if (error) throw fromDatabaseError(error);
    if (!Array.isArray(data) || data.length !== 1) throw new ApiError("INTERNAL_ERROR");
    return {
      status: 201,
      data: {
        distribution: toDistributeResponse(requirement.id, data),
      } satisfies OutreachDistributeResponse,
    };
  },
});

if (import.meta.main) Deno.serve(handler);
