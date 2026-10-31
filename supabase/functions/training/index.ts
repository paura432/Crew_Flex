// Training «Formación» (CrewFlex v1.9; ADR-003; batch V19-01; BR-30). LOCAL ONLY, behind the `training`
// flag (the RPCs refuse with 0A000 → 404 when it is off). Every write is one database transaction
// (DEFINER RPC) that decides the caller's side from the database, never from the request. No service role.
// GET  /training?view=catalog[&q=&family=&mode=&language=&country=&from=&to=&offset=&limit=]
//                                               → TrainingCatalogResponse (signed in; 12 per page)
// GET  /training?view=course&id=                → TrainingCourseResponse (live, or own/admin any state)
// GET  /training?view=favorites                 → TrainingFavoritesResponse (professional)
// GET  /training?view=requests                  → TrainingRequestsResponse (professional: own)
// GET  /training?view=messages&requestId=       → TrainingMessagesResponse (the two participants)
// GET  /training?view=inbox&organizationId=[&status=&offset=&limit=] → TrainingInboxResponse (admin/manager)
// GET  /training?view=workspace&organizationId= → TrainingWorkspaceResponse (admin/manager)
// GET  /training?view=review-queue[&offset=&limit=] → TrainingReviewQueueResponse (platform admin)
// GET  /training?view=sessions&from=&to=        → TrainingSessionsResponse (own confirmed sessions)
// POST /training { op, input }                  → by `op`: provider | course | edition | listing | review
//                                                 (TrainingSavedResponse) · favorite (TrainingFavoriteResponse)
//                                                 · request (201 TrainingRequestResponse; 200 replay) ·
//                                                 transition (TrainingTransitionResponse) · message
//                                                 (TrainingMessageResponse). `request`, `transition` and
//                                                 `message` require `Idempotency-Key`.
// Refusals: 403 wrong side / not allowed, 404 not a party (= missing id) or feature off, 409 with `reason`
// (TRAINING_CONFLICTS), 409 stale version (CF412) or key reuse (CF409), 400 invalid value.
import { z } from "zod";
import { type Actor, requireActor } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { toIso } from "../_shared/requirements.ts";
import { createdRow, idempotencyKey, parseJsonBody, parseQuery } from "../_shared/validation.ts";
import { TRAINING_REQUEST_STATUSES } from "../../../src/domain/training.ts";
import {
  type CourseInput,
  type EditionInput,
  KEYED_OPS,
  type RequestInput,
  type TrainingQuery,
  trainingQuery,
  type TrainingWrite,
  trainingWrite,
  type TransitionInput,
} from "../../../src/lib/validation/training.ts";
import type {
  TrainingCatalogResponse,
  TrainingCommitment,
  TrainingCourse,
  TrainingCourseResponse,
  TrainingEdition,
  TrainingFavoriteResponse,
  TrainingFavoritesResponse,
  TrainingInboxResponse,
  TrainingMessage,
  TrainingMessageResponse,
  TrainingMessagesResponse,
  TrainingRequest,
  TrainingRequestResponse,
  TrainingRequestsResponse,
  TrainingReviewItem,
  TrainingReviewQueueResponse,
  TrainingSavedResponse,
  TrainingSessionsResponse,
  TrainingTransitionResponse,
  TrainingWorkspaceResponse,
} from "../../../src/types/api.ts";

const json = z.record(z.string(), z.unknown());
const total = z.number().int();
/** Paginated RPCs: one jsonb row plus the window-function total. */
const coursePage = z.array(z.object({ course: json, total }));
const requestPage = z.array(z.object({ request: json, total }));
const itemPage = z.array(z.object({ item: json, total }));

/** The row every save RPC returns. */
const savedRow = z.object({
  id: z.string(),
  status: z.string(),
  updated_at: z.string(),
  session_count: z.number().int().optional(),
  requests_cancelled: z.number().int().optional(),
});

export function toSaved(data: unknown): TrainingSavedResponse {
  const row = savedRow.parse(Array.isArray(data) ? data[0] : data);
  return {
    id: row.id,
    status: row.status,
    updatedAt: toIso(row.updated_at),
    ...(row.session_count === undefined ? {} : { sessionCount: row.session_count }),
    ...(row.requests_cancelled === undefined ? {} : { requestsCancelled: row.requests_cancelled }),
  };
}

const transitionRow = z.object({
  request_id: z.string(),
  status: z.enum(TRAINING_REQUEST_STATUSES),
  event_id: z.string(),
  offer_id: z.string().nullable(),
  updated_at: z.string(),
  replayed: z.boolean(),
});

export function toTransition(data: unknown): TrainingTransitionResponse {
  const row = transitionRow.parse(Array.isArray(data) ? data[0] : data);
  return {
    transition: {
      requestId: row.request_id,
      status: row.status,
      updatedAt: toIso(row.updated_at),
      offerId: row.offer_id,
    },
    replayed: row.replayed,
  };
}

const messageRow = z.object({
  id: z.string(),
  sender_side: z.enum(["professional", "provider"]),
  mine: z.boolean(),
  body: z.string(),
  created_at: z.string(),
});

export function toMessages(data: unknown): TrainingMessage[] {
  return z
    .array(messageRow)
    .parse(data)
    .map((r) => ({
      id: r.id,
      senderSide: r.sender_side,
      mine: r.mine,
      body: r.body,
      createdAt: toIso(r.created_at),
    }));
}

const sessionRow = z.object({
  request_id: z.string(),
  edition_id: z.string(),
  session_id: z.string(),
  course_title: z.string(),
  provider_name: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  time_zone: z.string(),
  location: z.string().nullable(),
  element: z.enum(["theory", "practical", "assessment"]),
  mode: z.enum(["onsite", "live", "mixed", "selfpaced"]),
  city: z.string().nullable(),
  status: z.enum(TRAINING_REQUEST_STATUSES),
});

export function toCommitments(data: unknown): TrainingCommitment[] {
  return z
    .array(sessionRow)
    .parse(data)
    .map((r) => ({
      requestId: r.request_id,
      editionId: r.edition_id,
      sessionId: r.session_id,
      courseTitle: r.course_title,
      providerName: r.provider_name,
      startsAt: toIso(r.starts_at),
      endsAt: toIso(r.ends_at),
      timeZone: r.time_zone,
      location: r.location,
      element: r.element,
      mode: r.mode,
      city: r.city,
      status: r.status,
    }));
}

/** RPC arguments of a course save: explicit columns, never the organization role (the RPC checks it). */
export function courseArgs(input: CourseInput) {
  return {
    p_organization_id: input.organizationId,
    p_id: input.id ?? null,
    p_expected_updated_at: input.expectedUpdatedAt ?? null,
    p_title: input.title,
    p_family: input.family,
    p_description: input.description,
    p_language: input.language,
    p_certificate_info: input.certificateInfo,
    p_issuer: input.issuer,
    p_scope: input.scope,
    p_approval_ref: input.approvalRef,
    p_aircraft: input.aircraft,
    p_engine: input.engine,
    p_category: input.category,
    p_prerequisites: input.prerequisites,
    p_syllabus: input.syllabus,
  };
}

export function editionArgs(input: EditionInput) {
  return {
    p_course_id: input.courseId,
    p_id: input.id ?? null,
    p_expected_updated_at: input.expectedUpdatedAt ?? null,
    p_mode: input.mode,
    p_provisional: input.provisional,
    p_capacity: input.capacity,
    p_price_unit: input.priceUnit,
    p_price_cents: input.priceCents,
    p_currency: input.currency,
    p_price_includes: input.priceIncludes,
    p_policy: input.policy,
    p_time_zone: input.timeZone,
    p_sessions: input.sessions,
    p_deadline: input.deadline,
    p_city: input.city,
    p_country: input.country,
  };
}

export function requestArgs(input: RequestInput, key: string, requestId: string) {
  return {
    p_idempotency_key: key,
    p_course_id: input.courseId,
    p_edition_id: input.editionId ?? null,
    p_kind: input.kind,
    p_applicant_name: input.applicantName,
    p_note: input.note,
    p_units: input.units,
    p_request_id: requestId,
  };
}

/** The side is the database's business: nothing here names the actor. */
export function transitionArgs(input: TransitionInput, key: string, requestId: string) {
  return {
    p_request_id: input.requestId,
    p_to: input.to,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_idempotency_key: key,
    p_reason: input.reason ?? null,
    p_offer_id: input.offerId ?? null,
    p_accept_terms: input.acceptTerms ?? null,
    p_outcome: input.outcome ?? null,
    p_quote_total_cents: input.quoteTotalCents ?? null,
    p_trace_id: requestId,
  };
}

async function rpc(actor: Actor, fn: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const { data, error } = await actor.client.rpc(fn, args);
  if (error) throw fromDatabaseError(error);
  return data;
}

async function loadMyRequests(actor: Actor): Promise<TrainingRequest[]> {
  const rows = z
    .array(z.object({ request: json }))
    .parse(await rpc(actor, "get_my_training_requests"));
  return rows.map((r) => r.request as unknown as TrainingRequest);
}

async function read(actor: Actor, query: TrainingQuery): Promise<unknown> {
  switch (query.view) {
    case "catalog": {
      const rows = coursePage.parse(
        await rpc(actor, "list_training_catalog", {
          p_q: query.q ?? null,
          p_family: query.family ?? null,
          p_mode: query.mode ?? null,
          p_language: query.language ?? null,
          p_country: query.country ?? null,
          p_from: query.from ?? null,
          p_to: query.to ?? null,
          p_offset: query.offset,
          p_limit: query.limit,
        }),
      );
      return {
        courses: rows.map(
          (r) =>
            r.course as unknown as TrainingCourse & {
              editions: TrainingEdition[];
            },
        ),
        total: rows[0]?.total ?? 0,
      } satisfies TrainingCatalogResponse;
    }
    case "course":
      return {
        course: json.parse(await rpc(actor, "get_training_course", { p_id: query.id })),
      } as unknown as TrainingCourseResponse;
    case "favorites": {
      const rows = z
        .array(z.object({ course: json }))
        .parse(await rpc(actor, "get_my_training_favorites"));
      return {
        courses: rows.map((r) => r.course as unknown as TrainingCourse),
      } satisfies TrainingFavoritesResponse;
    }
    case "requests":
      return {
        requests: await loadMyRequests(actor),
      } satisfies TrainingRequestsResponse;
    case "messages":
      return {
        messages: toMessages(
          await rpc(actor, "get_training_messages", {
            p_request_id: query.requestId,
          }),
        ),
      } satisfies TrainingMessagesResponse;
    case "inbox": {
      const rows = requestPage.parse(
        await rpc(actor, "get_training_inbox", {
          p_organization_id: query.organizationId,
          p_status: query.status ?? null,
          p_offset: query.offset,
          p_limit: query.limit,
        }),
      );
      return {
        requests: rows.map((r) => r.request as unknown as TrainingRequest),
        total: rows[0]?.total ?? 0,
      } satisfies TrainingInboxResponse;
    }
    case "workspace":
      return json.parse(
        await rpc(actor, "get_training_workspace", {
          p_organization_id: query.organizationId,
        }),
      ) as unknown as TrainingWorkspaceResponse;
    case "review-queue": {
      const rows = itemPage.parse(
        await rpc(actor, "get_training_review_queue", {
          p_offset: query.offset,
          p_limit: query.limit,
        }),
      );
      return {
        items: rows.map((r) => r.item as unknown as TrainingReviewItem),
        total: rows[0]?.total ?? 0,
      } satisfies TrainingReviewQueueResponse;
    }
    case "sessions":
      return {
        sessions: toCommitments(
          await rpc(actor, "get_my_training_sessions", {
            p_from: query.from,
            p_to: query.to,
          }),
        ),
      } satisfies TrainingSessionsResponse;
  }
}

async function write(
  actor: Actor,
  body: TrainingWrite,
  key: string | null,
  requestId: string,
): Promise<{ status?: number; data: unknown }> {
  switch (body.op) {
    case "provider": {
      const i = body.input;
      const rows = (await rpc(actor, "save_training_provider", {
        p_organization_id: i.organizationId,
        p_name: i.name,
        p_description: i.description,
        p_website: i.website,
        p_expected_updated_at: i.expectedUpdatedAt ?? null,
      })) as { organization_id?: string }[];
      // A provider's id is its organization's (1:1): the RPC returns `organization_id`.
      return { data: toSaved(rows.map((r) => ({ ...r, id: r.organization_id }))) };
    }
    case "course":
      return {
        data: toSaved(await rpc(actor, "save_training_course", courseArgs(body.input))),
      };
    case "edition":
      return {
        data: toSaved(await rpc(actor, "save_training_edition", editionArgs(body.input))),
      };
    case "listing": {
      const i = body.input;
      const fn =
        i.action === "cancel"
          ? "cancel_training_edition"
          : i.kind === "course"
            ? "submit_training_course"
            : "submit_training_edition";
      return {
        data: toSaved(
          await rpc(actor, fn, {
            p_id: i.id,
            p_expected_updated_at: i.expectedUpdatedAt,
            ...(i.action === "cancel" ? { p_reason: i.reason } : {}),
          }),
        ),
      };
    }
    case "review": {
      const i = body.input;
      return {
        data: toSaved(
          await rpc(actor, "review_training", {
            p_kind: i.kind,
            p_id: i.id,
            p_decision: i.decision,
            p_expected_updated_at: i.expectedUpdatedAt,
            p_note: i.note ?? null,
          }),
        ),
      };
    }
    case "favorite": {
      const saved = z.boolean().parse(
        await rpc(actor, "toggle_training_favorite", {
          p_course_id: body.input.courseId,
        }),
      );
      return {
        data: {
          courseId: body.input.courseId,
          saved,
        } satisfies TrainingFavoriteResponse,
      };
    }
    case "request": {
      const { id, replayed } = createdRow(
        await rpc(actor, "create_training_request", requestArgs(body.input, key!, requestId)),
      );
      const request = (await loadMyRequests(actor)).find((r) => r.id === id);
      if (!request) throw new ApiError("INTERNAL_ERROR");
      return {
        status: replayed ? 200 : 201,
        data: { request, replayed } satisfies TrainingRequestResponse,
      };
    }
    case "transition":
      return {
        data: toTransition(
          await rpc(
            actor,
            "transition_training_request",
            transitionArgs(body.input, key!, requestId),
          ),
        ),
      };
    case "message": {
      const { id, replayed } = createdRow(
        await rpc(actor, "send_training_message", {
          p_request_id: body.input.requestId,
          p_idempotency_key: key!,
          p_body: body.input.body,
        }),
      );
      return {
        status: replayed ? 200 : 201,
        data: { id, replayed } satisfies TrainingMessageResponse,
      };
    }
  }
}

export const handler = createHandler("training", {
  GET: async (ctx) => {
    const actor = await requireActor(ctx);
    const query = parseQuery(ctx.url, trainingQuery);
    return { data: await read(actor, query) };
  },

  POST: async (ctx) => {
    const actor = await requireActor(ctx);
    const body = await parseJsonBody(ctx.req, trainingWrite, {
      maxBytes: 128 * 1024,
    });
    const key = KEYED_OPS.includes(body.op) ? idempotencyKey(ctx.req, { required: true }) : null;
    return await write(actor, body, key, ctx.requestId);
  },
});

if (import.meta.main) Deno.serve(handler);
