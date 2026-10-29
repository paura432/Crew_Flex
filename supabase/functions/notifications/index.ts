// In-app notices («Avisos internos», v2-18; migration 20261023800000). Read and mark only: the database
// writes every notice in the transaction of the event that causes it (triggers) and renders it from
// the ids at read time, re-checking access. Any signed-in account (professional or organization).
// Since 20261024400200 (package outreach, v2-17) a third kind, `outreach`, is written by
// requirement_outreach(): about a requirement (no application), with the urgency it was sent for.
// Since 20261029100400 (training, ADR-003) a fourth kind, `training`: a request event for the other
// party or a review decision for the provider; its subject ids and status come in `training`.
// GET   /notifications?offset=&limit=   → NoticeListResponse { notices, total, unread }
// GET   /notifications?view=count       → NoticeCountResponse { unread }   (the shell's bell)
// PATCH /notifications { id }           → NoticeReadResponse { marked: 1, unread, notice }; 404 when
//                                          the id is not one of the caller's notices
// PATCH /notifications { all: true }    → NoticeReadResponse { marked, unread, notice: null }
// Identity from the JWT only (the RPCs read auth.uid()); no recipient is ever taken from the request.
import { z } from "zod";
import { type Actor, requireActor } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { toIso } from "../_shared/requirements.ts";
import { parseJsonBody, parseQuery } from "../_shared/validation.ts";
import { APPLICATION_STATUSES } from "../../../src/domain/applications.ts";
import {
  NOTICE_AUDIENCES,
  NOTICE_KINDS,
  NOTICE_REQUIREMENT_STATUSES,
  TRAINING_NOTICE_SUBJECTS,
} from "../../../src/domain/notices.ts";
import { OUTREACH_URGENCIES } from "../../../src/domain/outreach.ts";
import { listNoticesQuery, markNoticesReadInput } from "../../../src/lib/validation/notices.ts";
import type {
  Notice,
  NoticeCountResponse,
  NoticeListResponse,
  NoticeReadResponse,
} from "../../../src/types/api.ts";

// Ids are checked as UUIDs: the server action builds the redirect from them (defence in depth).
const noticeRow = z
  .object({
    id: z.uuid(),
    kind: z.enum(NOTICE_KINDS),
    audience: z.enum(NOTICE_AUDIENCES),
    created_at: z.string(),
    read_at: z.string().nullable(),
    // Null only for an outreach notice (v2-17, migration 20261024400200): it is about a requirement.
    application_id: z.uuid().nullable(),
    application_status: z.enum(APPLICATION_STATUSES).nullable(),
    requirement_status: z.enum(NOTICE_REQUIREMENT_STATUSES).nullable(),
    // Null only for a training notice (20261029100400).
    requirement_id: z.uuid().nullable(),
    requirement_title: z.string().nullable(),
    organization_name: z.string().nullable(),
    candidate_name: z.string().nullable(),
    candidate_ref: z.string().nullable(),
    total: z.number().int(),
    outreach_urgency: z.enum(OUTREACH_URGENCIES).nullish(),
    training_subject: z.enum(TRAINING_NOTICE_SUBJECTS).nullish(),
    training_request_id: z.uuid().nullish(),
    training_course_id: z.uuid().nullish(),
    training_edition_id: z.uuid().nullish(),
    training_organization_id: z.uuid().nullish(),
    training_status: z.string().nullish(),
    training_title: z.string().nullish(),
  })
  // An outreach notice is the reader's own (technician side), with its urgency and no application; a
  // training notice has its subject and status and no requirement; every other kind names an application.
  .refine((r) =>
    r.kind === "outreach"
      ? r.audience === "technician" && r.application_id === null && !!r.outreach_urgency
      : r.kind === "training"
        ? r.application_id === null &&
          r.requirement_id === null &&
          !!r.training_subject &&
          !!r.training_status
        : r.application_id !== null && r.requirement_id !== null,
  );
const totalOf = z.number().int();

/** One `get_my_notifications` row → the API contract (each side gets only its own fields). */
export function toNotice(raw: unknown): Notice {
  const r = noticeRow.parse(raw);
  const technician = r.audience === "technician";
  return {
    id: r.id,
    kind: r.kind,
    audience: r.audience,
    createdAt: toIso(r.created_at),
    readAt: r.read_at === null ? null : toIso(r.read_at),
    applicationId: r.application_id,
    requirementId: r.requirement_id,
    requirementTitle: r.requirement_title,
    organizationName: technician ? r.organization_name : null,
    applicationStatus: r.kind === "application" ? r.application_status : null,
    requirementStatus: r.kind === "requirement" ? r.requirement_status : null,
    candidate: technician ? null : { name: r.candidate_name, ref: r.candidate_ref },
    outreachUrgency: r.kind === "outreach" ? (r.outreach_urgency ?? null) : null,
    training:
      r.kind === "training" && r.training_subject && r.training_status
        ? {
            subject: r.training_subject,
            requestId: r.training_request_id ?? null,
            courseId: r.training_course_id ?? null,
            editionId: r.training_edition_id ?? null,
            organizationId: r.training_organization_id ?? null,
            status: r.training_status,
            title: r.training_title ?? null,
          }
        : null,
  };
}

/** Rows of one page and the total the window function counted (0 for an empty page). */
export function toNoticePage(data: unknown): { notices: Notice[]; total: number } {
  const rows = z.array(z.unknown()).parse(data);
  return {
    notices: rows.map(toNotice),
    total: rows.length === 0 ? 0 : totalOf.parse((rows[0] as { total: unknown }).total),
  };
}

async function readPage(
  actor: Actor,
  args: { p_id: string | null; p_offset: number; p_limit: number },
) {
  const { data, error } = await actor.client.rpc("get_my_notifications", args);
  if (error) throw fromDatabaseError(error);
  return toNoticePage(data);
}

async function unreadCount(actor: Actor): Promise<number> {
  const { data, error } = await actor.client.rpc("count_my_unread_notifications");
  if (error) throw fromDatabaseError(error);
  return z.number().int().min(0).parse(data);
}

export const handler = createHandler("notifications", {
  GET: async (ctx) => {
    const actor = await requireActor(ctx);
    const query = parseQuery(ctx.url, listNoticesQuery);
    if (query.view === "count") {
      return { data: { unread: await unreadCount(actor) } satisfies NoticeCountResponse };
    }
    let page = await readPage(actor, { p_id: null, p_offset: query.offset, p_limit: query.limit });
    // A page past the end has no row to carry the total: ask the first page for it.
    if (page.notices.length === 0 && query.offset > 0) {
      page = {
        notices: [],
        total: (await readPage(actor, { p_id: null, p_offset: 0, p_limit: 1 })).total,
      };
    }
    return {
      data: { ...page, unread: await unreadCount(actor) } satisfies NoticeListResponse,
    };
  },

  PATCH: async (ctx) => {
    const actor = await requireActor(ctx);
    const input = await parseJsonBody(ctx.req, markNoticesReadInput);
    const { data, error } = await actor.client.rpc("mark_notifications_read", {
      p_id: input.id ?? null,
    });
    if (error) throw fromDatabaseError(error);
    const marked = z.number().int().min(0).parse(data);
    if (input.id && marked === 0) throw new ApiError("NOT_FOUND"); // not the caller's (or gone)
    const notice = input.id
      ? ((await readPage(actor, { p_id: input.id, p_offset: 0, p_limit: 1 })).notices[0] ?? null)
      : null;
    return {
      data: { marked, unread: await unreadCount(actor), notice } satisfies NoticeReadResponse,
    };
  },
});

if (import.meta.main) Deno.serve(handler);
