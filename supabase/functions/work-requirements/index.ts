// GET  /work-requirements           → requirements of the actor's organizations (RLS)
// GET  /work-requirements?id=<uuid> → one requirement
// POST /work-requirements           → create (admin/manager), atomic RPC under RLS, audited
import { requireActor, requireOrganizationRole } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { loadRequirement, REQUIREMENT_SELECT, toWorkRequirement } from "../_shared/requirements.ts";
import { parseJsonBody, parseQuery } from "../_shared/validation.ts";
import {
  createWorkRequirementInput,
  listWorkRequirementsQuery,
} from "../../../src/lib/validation/work-requirement.ts";
import type {
  WorkRequirementListResponse,
  WorkRequirementResponse,
} from "../../../src/types/api.ts";

export const handler = createHandler("work-requirements", {
  GET: async (ctx) => {
    const actor = await requireActor(ctx);
    const query = parseQuery(ctx.url, listWorkRequirementsQuery);

    if (query.id) {
      const requirement = await loadRequirement(actor, query.id);
      return { data: { requirement } satisfies WorkRequirementResponse };
    }

    let request = actor.client
      .from("work_requirements")
      .select(REQUIREMENT_SELECT)
      .order("starts_at", { ascending: true })
      .limit(query.limit);
    if (query.organizationId) request = request.eq("organization_id", query.organizationId);
    const { data, error } = await request;
    if (error) throw fromDatabaseError(error);
    return {
      data: {
        requirements: (data ?? []).map(toWorkRequirement),
      } satisfies WorkRequirementListResponse,
    };
  },

  POST: async (ctx) => {
    const actor = await requireActor(ctx);
    const input = await parseJsonBody(ctx.req, createWorkRequirementInput);
    await requireOrganizationRole(actor, input.organizationId, ["admin", "manager"]);

    const { data: id, error } = await actor.client.rpc("create_work_requirement", {
      p_organization_id: input.organizationId,
      p_title: input.title,
      p_location: input.location,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
      p_shift: input.shift,
      p_headcount: input.headcount,
      p_urgency: input.urgency,
      p_qualifications: input.qualifications.map((q) => ({
        qualification_type_id: q.qualificationTypeId,
        requirement_level: q.level,
      })),
    });
    if (error) throw fromDatabaseError(error);
    if (typeof id !== "string") throw new ApiError("INTERNAL_ERROR");

    const requirement = await loadRequirement(actor, id);
    return { status: 201, data: { requirement } satisfies WorkRequirementResponse };
  },
});

if (import.meta.main) Deno.serve(handler);
