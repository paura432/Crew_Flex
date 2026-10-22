// In-app notices («Avisos internos», v2-18; migration 20261023800000). Read and mark only: the database
// writes every notice in the transaction of the event that causes it (triggers) and renders it from
// the ids at read time, re-checking access. Any signed-in account (professional or organization).
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
} from "../../../src/domain/notices.ts";
import { listNoticesQuery, markNoticesReadInput } from "../../../src/lib/validation/notices.ts";
import type {
  Notice,
  NoticeCountResponse,
  NoticeListResponse,
  NoticeReadResponse,
} from "../../../src/types/api.ts";

// Ids are checked as UUIDs: the server action builds the redirect from them (defence in depth).
const noticeRow = z.object({
  id: z.uuid(),
  kind: z.enum(NOTICE_KINDS),
  audience: z.enum(NOTICE_AUDIENCES),
  created_at: z.string(),
  read_at: z.string().nullable(),
  application_id: z.uuid(),
  application_status: z.enum(APPLICATION_STATUSES).nullable(),
  requirement_status: z.enum(NOTICE_REQUIREMENT_STATUSES).nullable(),
  requirement_id: z.uuid(),
  requirement_title: z.string(),
  organization_name: z.string().nullable(),
  candidate_name: z.string().nullable(),
  candidate_ref: z.string().nullable(),
  total: z.number().int(),
});

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
  };
}

/** Rows of one page and the total the window function counted (0 for an empty page). */
export function toNoticePage(data: unknown): { notices: Notice[]; total: number } {
  const rows = z.array(z.unknown()).parse(data);
  return {
    notices: rows.map(toNotice),
    total:
      rows.length === 0 ? 0 : noticeRow.shape.total.parse((rows[0] as { total: unknown }).total),
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
