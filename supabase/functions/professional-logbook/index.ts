// Personal logbook (M14, N-12; BUSINESS_RULES BR-16) — own entries only. LOCAL ONLY.
//   GET    /professional-logbook?view=active|archived&limit=  → { entries, total } newest first (RLS)
//   POST   /professional-logbook { entryDate, aircraft, ata?, hours, category, environment,
//          description, cvRelevant? }  Idempotency-Key REQUIRED → 201 created · 200 replay · 409
//   PATCH  /professional-logbook?id=<uuid> { any subset of the fields, archived? } (edit, select for
//          the pack, archive, restore)
//   DELETE /professional-logbook?id=<uuid>
// User-JWT client ONLY (no service role): the table's owner-only RLS is the authorization and the
// owner is the JWT subject — the body never carries it. No organization, manager or platform-admin
// path exists: the logbook is private and self-declared (FD-25); `cvRelevant` is stored only.
import { z } from "zod";
import { requireActor, requireTechnician } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { createdRow, idempotencyKey, parseJsonBody, parseQuery } from "../_shared/validation.ts";
import { LOGBOOK_CATEGORIES, LOGBOOK_ENVIRONMENTS } from "../../../src/domain/logbook.ts";
import {
  createLogbookEntryInput,
  type CreateLogbookEntryInput,
  listLogbookQuery,
  logbookEntryIdQuery,
  updateLogbookEntryInput,
  type UpdateLogbookEntryInput,
} from "../../../src/lib/validation/logbook.ts";
import type {
  LogbookDeleteResponse,
  LogbookEntry,
  LogbookEntryResponse,
  LogbookListResponse,
} from "../../../src/types/api.ts";

const SELECT =
  "id, entry_date, aircraft, ata, hours, category, environment, description, cv_relevant, archived, created_at, updated_at";

const row = z.object({
  id: z.string(),
  entry_date: z.string(),
  aircraft: z.string(),
  ata: z.string().nullable(),
  // PostgREST renders numeric as a JSON number; accept a string too.
  hours: z.coerce.number(),
  category: z.enum(LOGBOOK_CATEGORIES),
  environment: z.enum(LOGBOOK_ENVIRONMENTS),
  description: z.string(),
  cv_relevant: z.boolean(),
  archived: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export function toLogbookEntry(raw: unknown): LogbookEntry {
  const r = row.parse(raw);
  return {
    id: r.id,
    entryDate: r.entry_date.slice(0, 10),
    aircraft: r.aircraft,
    ata: r.ata,
    hours: r.hours,
    category: r.category,
    environment: r.environment,
    description: r.description,
    cvRelevant: r.cv_relevant,
    archived: r.archived,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

/** RPC arguments of the idempotent create (`create_logbook_entry`, migration 20261023200000). */
export const createArgs = (input: CreateLogbookEntryInput, key: string) => ({
  p_idempotency_key: key,
  p_entry_date: input.entryDate,
  p_aircraft: input.aircraft,
  p_ata: input.ata ?? null,
  p_hours: input.hours,
  p_category: input.category,
  p_environment: input.environment,
  p_description: input.description,
  p_cv_relevant: input.cvRelevant,
});

/** PATCH body → the columns the owner may update (column grants re-check it). */
export function updateColumns(input: UpdateLogbookEntryInput): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  if (input.entryDate !== undefined) columns.entry_date = input.entryDate;
  if (input.aircraft !== undefined) columns.aircraft = input.aircraft;
  if (input.ata !== undefined) columns.ata = input.ata;
  if (input.hours !== undefined) columns.hours = input.hours;
  if (input.category !== undefined) columns.category = input.category;
  if (input.environment !== undefined) columns.environment = input.environment;
  if (input.description !== undefined) columns.description = input.description;
  if (input.cvRelevant !== undefined) columns.cv_relevant = input.cvRelevant;
  if (input.archived !== undefined) columns.archived = input.archived;
  return columns;
}

export const handler = createHandler("professional-logbook", {
  GET: async (ctx) => {
    const actor = await requireActor(ctx);
    const { view, limit } = parseQuery(ctx.url, listLogbookQuery);
    const { data, error, count } = await actor.client
      .from("logbook_entries")
      .select(SELECT, { count: "exact" })
      .eq("technician_profile_id", actor.id)
      .eq("archived", view === "archived")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw fromDatabaseError(error);
    const entries = (data ?? []).map(toLogbookEntry);
    return {
      data: { entries, total: count ?? entries.length } satisfies LogbookListResponse,
    };
  },

  POST: async (ctx) => {
    const actor = await requireActor(ctx);
    const key = idempotencyKey(ctx.req, { required: true });
    const input = await parseJsonBody(ctx.req, createLogbookEntryInput);
    await requireTechnician(actor, "Only professional accounts keep a logbook.");
    const created = await actor.client.rpc("create_logbook_entry", createArgs(input, key));
    if (created.error) throw fromDatabaseError(created.error);
    const { id, replayed } = createdRow(created.data);
    const { data, error } = await actor.client
      .from("logbook_entries")
      .select(SELECT)
      .eq("id", id)
      .eq("technician_profile_id", actor.id)
      .maybeSingle();
    if (error) throw fromDatabaseError(error);
    if (!data) throw new ApiError("NOT_FOUND"); // replay of an entry deleted since
    return {
      status: replayed ? 200 : 201,
      data: { entry: toLogbookEntry(data) } satisfies LogbookEntryResponse,
    };
  },

  PATCH: async (ctx) => {
    const actor = await requireActor(ctx);
    const { id } = parseQuery(ctx.url, logbookEntryIdQuery);
    const input = await parseJsonBody(ctx.req, updateLogbookEntryInput);
    const { data, error } = await actor.client
      .from("logbook_entries")
      .update(updateColumns(input))
      .eq("id", id)
      .eq("technician_profile_id", actor.id)
      .select(SELECT)
      .maybeSingle();
    if (error) throw fromDatabaseError(error);
    if (!data) throw new ApiError("NOT_FOUND"); // missing or not owned look the same
    return { data: { entry: toLogbookEntry(data) } satisfies LogbookEntryResponse };
  },

  DELETE: async (ctx) => {
    const actor = await requireActor(ctx);
    const { id } = parseQuery(ctx.url, logbookEntryIdQuery);
    const { data, error } = await actor.client
      .from("logbook_entries")
      .delete()
      .eq("id", id)
      .eq("technician_profile_id", actor.id)
      .select("id")
      .maybeSingle();
    if (error) throw fromDatabaseError(error);
    if (!data) throw new ApiError("NOT_FOUND");
    return { data: { deleted: true, id } satisfies LogbookDeleteResponse };
  },
});

if (import.meta.main) Deno.serve(handler);
