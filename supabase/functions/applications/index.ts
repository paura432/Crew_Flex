// Applications (M08, D-06 ratified 2026-10-22). Every write is one database transaction (DEFINER RPC)
// that decides the caller's side from the database, never from the request.
// GET   /applications                                  → { applications: MyApplication[] } (technician)
// GET   /applications?requirementId=<uuid>             → { requirementId, applications: OrgApplication[] }
//                                                        (admin/manager of its organization; 404 hidden)
// GET   /applications?organizationId=<uuid>&view=counts → { counts } (admin/manager)
// GET   /applications?organizationId=<uuid>&view=list[&requirementId=&status=&offset=&limit=]
//                                                      → { applications: OrganizationApplication[], total }
//                                                        (admin/manager; v2-05 «Candidaturas», newest first)
// GET   /applications?organizationId=<uuid>&view=byRequirement → { requirements: [{ requirementId,
//                                                        headcount, startsAt, endsAt, shiftCount, counts }] }
//                                                        (admin/manager; v2-05 tabs, v2-08 coverage)
// POST  /applications { requirementId, shareConsent: true }        → 201 { application } · 200 replay
// PATCH /applications { applicationId, to, expectedUpdatedAt, reason?, proposalId?, acceptTerms? }
//                                                      → { transition, replayed }
// POST and PATCH require `Idempotency-Key`. Refusals: 403 wrong side / not a professional, 404 not a
// party (same as a missing id), 409 with `reason` (APPLICATION_CONFLICTS), 409 stale version or key reuse.
import { z } from "zod";
import { requireActor, requireOrganizationRole, requireTechnician } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import {
  loadOwnCandidate,
  periodOf,
  toMyApplication,
  toOrganizationApplication,
  toOrgApplication,
} from "../_shared/applications.ts";
import type { Actor } from "../_shared/auth.ts";
import { loadRequirement, toIso } from "../_shared/requirements.ts";
import { createdRow, idempotencyKey, parseJsonBody, parseQuery } from "../_shared/validation.ts";
import { APPLICATION_STATUSES } from "../../../src/domain/applications.ts";
import {
  applyInput,
  type ListApplicationsQuery,
  listApplicationsQuery,
  type TransitionInput,
  transitionInput,
} from "../../../src/lib/validation/applications.ts";
import type {
  ApplicationCountsResponse,
  ApplicationResponse,
  ApplicationTransitionResponse,
  MyApplication,
  MyApplicationListResponse,
  OrganizationApplicationsResponse,
  RequirementApplicationCountsResponse,
  RequirementApplicationsResponse,
} from "../../../src/types/api.ts";

/** RPC arguments of one transition: the side is the database's business, never the body's. */
export function transitionArgs(input: TransitionInput, key: string, requestId: string) {
  return {
    p_application_id: input.applicationId,
    p_to: input.to,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_idempotency_key: key,
    p_reason: input.reason ?? null,
    p_proposal_id: input.proposalId ?? null,
    p_request_id: requestId,
  };
}

const transitionRow = z.object({
  application_id: z.string(),
  status: z.enum(APPLICATION_STATUSES),
  event_id: z.string(),
  proposal_id: z.string().nullable(),
  updated_at: z.string(),
  replayed: z.boolean(),
});

export function toTransitionResponse(data: unknown): ApplicationTransitionResponse {
  const row = transitionRow.parse(Array.isArray(data) ? data[0] : data);
  return {
    transition: {
      applicationId: row.application_id,
      status: row.status,
      updatedAt: toIso(row.updated_at),
      proposalId: row.proposal_id,
    },
    replayed: row.replayed,
  };
}

const countRow = z.object({ status: z.enum(APPLICATION_STATUSES), total: z.number().int() });

export function toCounts(data: unknown): ApplicationCountsResponse {
  const counts: ApplicationCountsResponse["counts"] = {};
  for (const row of z.array(countRow).parse(data)) counts[row.status] = row.total;
  return { counts };
}

const requirementCountsRow = z.object({
  requirement_id: z.string(),
  headcount: z.number().int(),
  starts_at: z.string(),
  ends_at: z.string(),
  shift_count: z.number().int().nullable(),
  counts: z.partialRecord(z.enum(APPLICATION_STATUSES), z.number().int()),
});

export function toRequirementCounts(data: unknown): RequirementApplicationCountsResponse {
  return {
    requirements: z
      .array(requirementCountsRow)
      .parse(data)
      .map((row) => ({
        requirementId: row.requirement_id,
        headcount: row.headcount,
        startsAt: toIso(row.starts_at),
        endsAt: toIso(row.ends_at),
        shiftCount: row.shift_count,
        counts: row.counts,
      })),
  };
}

/**
 * One page of the organization's applications (admin/manager checked by the caller and by the RPC).
 * Past the last page the RPC returns no row, so the total is read again with a one-row page: the
 * page can then send the user to the last page.
 */
async function loadOrganizationApplications(
  actor: Actor,
  query: ListApplicationsQuery & { organizationId: string },
): Promise<OrganizationApplicationsResponse> {
  const page = async (offset: number, limit: number) => {
    const { data, error } = await actor.client.rpc("get_organization_applications", {
      p_organization_id: query.organizationId,
      p_requirement_id: query.requirementId ?? null,
      p_status: query.status ?? null,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) throw fromDatabaseError(error);
    return z.array(z.unknown()).parse(data).map(toOrganizationApplication);
  };
  const rows = await page(query.offset, query.limit);
  const total = rows[0]?.total ?? (query.offset > 0 ? ((await page(0, 1))[0]?.total ?? 0) : 0);
  return { applications: rows.map((r) => r.application), total };
}

/** `status` filters the organization-wide list only (400 anywhere else). */
export function assertListParams(query: ListApplicationsQuery): void {
  if (query.status && query.view !== "list") throw new ApiError("VALIDATION_ERROR");
  if (query.view === "list" && !query.organizationId) throw new ApiError("VALIDATION_ERROR");
  if (query.view === "byRequirement" && (!query.organizationId || query.requirementId))
    throw new ApiError("VALIDATION_ERROR");
}

async function loadMine(actor: Actor): Promise<MyApplication[]> {
  const { data, error } = await actor.client.rpc("get_my_applications");
  if (error) throw fromDatabaseError(error); // 42501 → 403 (not a professional account)
  const rows = z.array(z.unknown()).parse(data);
  if (rows.length === 0) return [];
  const requirements = rows.map((r) => {
    const req = z.object({ requirement: z.object({ startsAt: z.string(), endsAt: z.string() }) });
    const { startsAt, endsAt } = req.parse(r).requirement;
    return { startsAt: toIso(startsAt), endsAt: toIso(endsAt) };
  });
  const own = await loadOwnCandidate(actor, periodOf(requirements));
  return rows.map((r) => toMyApplication(r, own));
}

export const handler = createHandler("applications", {
  GET: async (ctx) => {
    const actor = await requireActor(ctx);
    const query = parseQuery(ctx.url, listApplicationsQuery);
    assertListParams(query);

    if (query.view === "list" && query.organizationId) {
      const { organizationId } = query;
      await requireOrganizationRole(actor, organizationId, ["admin", "manager"]);
      return { data: await loadOrganizationApplications(actor, { ...query, organizationId }) };
    }

    if (query.view === "byRequirement" && query.organizationId) {
      await requireOrganizationRole(actor, query.organizationId, ["admin", "manager"]);
      const { data, error } = await actor.client.rpc("get_requirement_application_counts", {
        p_organization_id: query.organizationId,
      });
      if (error) throw fromDatabaseError(error);
      return { data: toRequirementCounts(data) };
    }

    if (query.requirementId) {
      if (query.organizationId || query.view) throw new ApiError("VALIDATION_ERROR");
      const requirement = await loadRequirement(actor, query.requirementId); // hidden = missing → 404
      await requireOrganizationRole(actor, requirement.organizationId, ["admin", "manager"]);
      const { data, error } = await actor.client.rpc("get_requirement_applications", {
        p_requirement_id: requirement.id,
      });
      if (error) throw fromDatabaseError(error);
      return {
        data: {
          requirementId: requirement.id,
          applications: z
            .array(z.unknown())
            .parse(data)
            .map((row) => toOrgApplication(row, requirement)),
        } satisfies RequirementApplicationsResponse,
      };
    }

    if (query.view === "counts" || query.organizationId) {
      if (query.view !== "counts" || !query.organizationId) throw new ApiError("VALIDATION_ERROR");
      await requireOrganizationRole(actor, query.organizationId, ["admin", "manager"]);
      const { data, error } = await actor.client.rpc("get_application_counts", {
        p_organization_id: query.organizationId,
      });
      if (error) throw fromDatabaseError(error);
      return { data: toCounts(data) };
    }

    await requireTechnician(actor);
    return { data: { applications: await loadMine(actor) } satisfies MyApplicationListResponse };
  },

  POST: async (ctx) => {
    const actor = await requireActor(ctx);
    const input = await parseJsonBody(ctx.req, applyInput);
    const key = idempotencyKey(ctx.req, { required: true });
    await requireTechnician(actor);
    const { data, error } = await actor.client.rpc("apply_to_requirement", {
      p_requirement_id: input.requirementId,
      p_idempotency_key: key,
      p_share_consent: input.shareConsent, // literal true (schema); the database requires it too
      p_request_id: ctx.requestId,
    });
    // P0002 → 404 · CFA01…CFA10, CFA13 → 409 + reason · CF409 → 409 (key reused with another requirement)
    if (error) throw fromDatabaseError(error);
    const { id, replayed } = createdRow(data);
    const application = (await loadMine(actor)).find((a) => a.id === id);
    if (!application) throw new ApiError("INTERNAL_ERROR");
    return {
      status: replayed ? 200 : 201,
      data: { application } satisfies ApplicationResponse,
    };
  },

  PATCH: async (ctx) => {
    const actor = await requireActor(ctx);
    const input = await parseJsonBody(ctx.req, transitionInput);
    const key = idempotencyKey(ctx.req, { required: true });
    const { data, error } = await actor.client.rpc(
      "transition_application",
      transitionArgs(input, key, ctx.requestId),
    );
    // 42501 → 403 (the other side's action) · P0002 → 404 (not a party) · 55000 → 409 (not allowed
    // from this state) · CF412 → 409 (changed since loaded) · CFA… → 409 + reason · 22023 → 400
    if (error) throw fromDatabaseError(error);
    return { data: toTransitionResponse(data) };
  },
});

if (import.meta.main) Deno.serve(handler);
