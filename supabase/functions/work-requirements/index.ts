// GET  /work-requirements           → requirements of the actor's organizations (RLS); `offset` +
//                                      `order` (starts_asc · created_desc) page them, `total` counts all
// GET  /work-requirements?id=<uuid> → one requirement
// POST /work-requirements           → create (admin/manager), atomic RPC under RLS, audited,
//                                      idempotent per `Idempotency-Key` (201 created · 200 replay)
// PATCH /work-requirements { id, status: "closed" } → close (admin/manager); terminal (V1.8
//                                      `job.status`, enforced and audited by the database); closing
//                                      a closed requirement again is a no-op (200)
import { requireActor, requireOrganizationRole } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { loadRequirement, REQUIREMENT_SELECT, toWorkRequirement } from "../_shared/requirements.ts";
import { createdRow, idempotencyKey, parseJsonBody, parseQuery } from "../_shared/validation.ts";
import {
  closeWorkRequirementInput,
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

    const filtered = (head = false) => {
      let request = actor.client
        .from("work_requirements")
        .select(REQUIREMENT_SELECT, { count: "exact", head });
      if (query.organizationId) request = request.eq("organization_id", query.organizationId);
      if (query.status) request = request.eq("status", query.status);
      if (query.endsAfter) request = request.gt("ends_at", query.endsAfter);
      return request;
    };
    const request = filtered();
    const ordered =
      query.order === "created_desc"
        ? request.order("created_at", { ascending: false }).order("id", { ascending: true })
        : request.order("starts_at", { ascending: true });
    const { data, error, count } = await ordered.range(
      query.offset,
      query.offset + query.limit - 1,
    );
    if (error?.code === "PGRST103") {
      // Offset past the last row (`?page=` out of range): PostgREST answers 416. An empty page with
      // the real total lets the caller clamp, instead of a 500 (X-04).
      const { count: all, error: countError } = await filtered(true);
      if (countError) throw fromDatabaseError(countError);
      return { data: { requirements: [], total: all ?? 0 } satisfies WorkRequirementListResponse };
    }
    if (error) throw fromDatabaseError(error);
    return {
      data: {
        requirements: (data ?? []).map(toWorkRequirement),
        total: count ?? undefined,
      } satisfies WorkRequirementListResponse,
    };
  },

  POST: async (ctx) => {
    const actor = await requireActor(ctx);
    const input = await parseJsonBody(ctx.req, createWorkRequirementInput);
    await requireOrganizationRole(actor, input.organizationId, ["admin", "manager"]);

    const key = idempotencyKey(ctx.req);
    const { data, error } = await actor.client.rpc("create_work_requirement_idempotent", {
      p_idempotency_key: key,
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
    if (error) throw fromDatabaseError(error); // CF409 → CONFLICT (key reused, other payload)
    const { id, replayed } = createdRow(data);

    const requirement = await loadRequirement(actor, id);
    return {
      status: replayed ? 200 : 201,
      data: { requirement } satisfies WorkRequirementResponse,
    };
  },

  PATCH: async (ctx) => {
    const actor = await requireActor(ctx);
    const input = await parseJsonBody(ctx.req, closeWorkRequirementInput);
    const current = await loadRequirement(actor, input.id); // hidden and missing → 404
    await requireOrganizationRole(actor, current.organizationId, ["admin", "manager"]);
    if (current.status !== input.status) {
      const { data, error } = await actor.client
        .from("work_requirements")
        .update({ status: input.status })
        .eq("id", input.id)
        .select("id");
      if (error) throw fromDatabaseError(error); // 55000 → CONFLICT
      if (!data?.length) throw new ApiError("FORBIDDEN"); // RLS matched no row (role revoked meanwhile)
    }
    const requirement = await loadRequirement(actor, input.id);
    return { data: { requirement } satisfies WorkRequirementResponse };
  },
});

if (import.meta.main) Deno.serve(handler);
