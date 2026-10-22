// GET  /work-requirements           → requirements of the actor's organizations (RLS); `offset` +
//                                      `order` (starts_asc · created_desc) page them, `total` counts all;
//                                      `archived` = include (default) · exclude · only (v1.8 «Archivada»)
// GET  /work-requirements?id=<uuid> → one requirement
// POST /work-requirements           → create (admin/manager), atomic RPC under RLS, audited,
//                                      idempotent per `Idempotency-Key` (201 created · 200 replay);
//                                      `intent: "draft"` saves a draft (R-D4: incomplete allowed), anything
//                                      else publishes it (`open`) with every creation rule
// PATCH /work-requirements { id, status: "paused" | "open" | "closed" } → pause, resume, publish a draft or
//                                      close (admin/manager; M05, V1.8 `job.status`); `closed` is terminal.
//                                      Enforced and audited by the database; the same status again is
//                                      a no-op (200); a change the lifecycle does not allow is 409; closing
//                                      with an accepted/confirmed application is 409 `ACTIVE_COMMITMENTS`;
//                                      publishing a draft (draft → open) applies the creation rules (400)
// PATCH /work-requirements { id, archive: true } → v1.8 «Archivar» (one way, T-64): a closed requirement,
//                                      or a draft (closed in the same step); anything else 409
// PUT /work-requirements { id, expectedUpdatedAt, title, …, qualifications, country?, timeZone?, description?,
//                          shifts?, conditions?, intent? } → edit (admin/manager; M05): only while the
//                                      requirement never received an application (409 `HAS_APPLICATIONS`),
//                                      409 when changed since `expectedUpdatedAt` or closed; nothing changed
//                                      is a 200 no-op; `intent: "draft"` saves a draft as a draft, `publish`
//                                      publishes it. RPC update_work_requirement (DEFINER), audited.
import { requireActor, requireOrganizationRole } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { loadRequirement, REQUIREMENT_SELECT, toWorkRequirement } from "../_shared/requirements.ts";
import {
  createdRow,
  idempotencyKey,
  MAX_REQUIREMENT_BODY_BYTES,
  parseJsonBody,
  parseQuery,
} from "../_shared/validation.ts";
import { canChangeRequirementStatus } from "../../../src/domain/work-requirement.ts";
import {
  type CreateWorkRequirementInput,
  createWorkRequirementInput,
  listWorkRequirementsQuery,
  patchRequirementInput,
  publishIssues,
  type UpdateWorkRequirementInput,
  updateWorkRequirementInput,
} from "../../../src/lib/validation/work-requirement.ts";
import type {
  WorkRequirementListResponse,
  WorkRequirementResponse,
} from "../../../src/types/api.ts";

type RequirementPayload = CreateWorkRequirementInput | UpdateWorkRequirementInput;

/** The fields every create and edit sends (full replacement: an absent term is cleared). */
function fieldArgs(input: RequirementPayload) {
  return {
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
    p_country: input.country ?? null,
    p_time_zone: input.timeZone ?? null,
    p_description: input.description || null,
    p_shifts: input.shifts?.length ? input.shifts : null,
    p_conditions: input.conditions ?? null,
  };
}

/** RPC arguments of the create: `intent: "draft"` → a draft, anything else → open (published). */
export function createArgs(input: CreateWorkRequirementInput, key: string) {
  return {
    p_idempotency_key: key,
    p_organization_id: input.organizationId,
    ...fieldArgs(input),
    p_status: input.intent === "draft" ? "draft" : "open",
  };
}

/** RPC arguments of the edit (M05); the organization never changes and is not sent. */
export function updateArgs(input: UpdateWorkRequirementInput) {
  return {
    p_id: input.id,
    p_expected_updated_at: input.expectedUpdatedAt,
    ...fieldArgs(input),
    // null keeps the status; `draft` saves a draft as a draft; `open` publishes a draft.
    p_status: input.intent === "draft" ? "draft" : input.intent === "publish" ? "open" : null,
  };
}

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
      if (query.archived === "exclude") request = request.is("archived_at", null);
      if (query.archived === "only") request = request.not("archived_at", "is", null);
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
    const input = await parseJsonBody(
      ctx.req,
      createWorkRequirementInput,
      { maxBytes: MAX_REQUIREMENT_BODY_BYTES },
    );
    await requireOrganizationRole(actor, input.organizationId, ["admin", "manager"]);

    const key = idempotencyKey(ctx.req);
    const { data, error } = await actor.client.rpc(
      "create_work_requirement_idempotent",
      createArgs(input, key),
    );
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
    const input = await parseJsonBody(ctx.req, patchRequirementInput);
    const current = await loadRequirement(actor, input.id); // hidden and missing → 404
    await requireOrganizationRole(actor, current.organizationId, ["admin", "manager"]);

    if ("archive" in input) {
      const { error } = await actor.client.rpc("archive_work_requirement", { p_id: input.id });
      if (error) throw fromDatabaseError(error); // 55000 (not closed nor a draft) → CONFLICT
    } else if (current.status !== input.status) {
      if (!canChangeRequirementStatus(current.status, input.status)) {
        throw new ApiError("CONFLICT", "This status change is not allowed.");
      }
      if (current.status === "draft") {
        // Publishing applies the creation rules to what the draft holds (R-D4, T-63).
        const issues = publishIssues(current);
        if (issues.length > 0) {
          throw new ApiError(
            "VALIDATION_ERROR",
            undefined,
            issues.slice(0, 20).map((issue) => ({
              path: issue.path.map(String).join(".") || "body",
              message: issue.message,
            })),
          );
        }
      }
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

  PUT: async (ctx) => {
    const actor = await requireActor(ctx);
    const input = await parseJsonBody(
      ctx.req,
      updateWorkRequirementInput,
      { maxBytes: MAX_REQUIREMENT_BODY_BYTES },
    );
    const current = await loadRequirement(actor, input.id); // hidden and missing → 404
    await requireOrganizationRole(actor, current.organizationId, ["admin", "manager"]);
    const { error } = await actor.client.rpc("update_work_requirement", updateArgs(input));
    // CF412 (stale) · CFA12 (has applications, + reason) · 55000 (closed, or a draft save of a published one)
    // → 409; 22023/23514 → 400
    if (error) throw fromDatabaseError(error);
    const requirement = await loadRequirement(actor, input.id);
    return { data: { requirement } satisfies WorkRequirementResponse };
  },
});

if (import.meta.main) Deno.serve(handler);
