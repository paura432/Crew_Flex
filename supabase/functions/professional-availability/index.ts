// Professional availability windows — own data only.
//   GET    /professional-availability?limit=        → list own windows (RLS)
//   POST   /professional-availability { startsAt, endsAt, status }   (Idempotency-Key: 201 · 200 replay)
//   PATCH  /professional-availability?id=<uuid> { startsAt, endsAt, status }
//   DELETE /professional-availability?id=<uuid>
// The technician id is ALWAYS the JWT subject: the body never carries ownership. RLS enforces
// `technician_profile_id = auth.uid()` as a second layer.
import { z } from "zod";
import { requireActor, type Actor } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { createdRow, idempotencyKey, parseJsonBody, parseQuery } from "../_shared/validation.ts";
import { AVAILABILITY_STATUSES } from "../../../src/domain/availability.ts";
import {
  availabilityWindowIdQuery,
  createAvailabilityWindowInput,
  listAvailabilityQuery,
  updateAvailabilityWindowInput,
} from "../../../src/lib/validation/availability.ts";
import type {
  AvailabilityDeleteResponse,
  AvailabilityListResponse,
  AvailabilityWindow,
  AvailabilityWindowResponse,
} from "../../../src/types/api.ts";

const SELECT = "id, starts_at, ends_at, status, updated_at";

const row = z.object({
  id: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  status: z.enum(AVAILABILITY_STATUSES),
  updated_at: z.string(),
});

export function toWindow(raw: unknown): AvailabilityWindow {
  const r = row.parse(raw);
  return {
    id: r.id,
    startsAt: new Date(r.starts_at).toISOString(),
    endsAt: new Date(r.ends_at).toISOString(),
    status: r.status,
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

/** Professionals only: the technician profile must exist for the actor. */
async function requireTechnician(actor: Actor): Promise<void> {
  const { data, error } = await actor.client
    .from("technician_profiles")
    .select("profile_id")
    .eq("profile_id", actor.id)
    .maybeSingle();
  if (error) throw fromDatabaseError(error);
  if (!data) throw new ApiError("FORBIDDEN", "Only professional accounts manage availability.");
}

export const handler = createHandler("professional-availability", {
  GET: async (ctx) => {
    const actor = await requireActor(ctx);
    const { limit } = parseQuery(ctx.url, listAvailabilityQuery);
    const { data, error } = await actor.client
      .from("availability_windows")
      .select(SELECT)
      .eq("technician_profile_id", actor.id)
      .order("starts_at", { ascending: true })
      .limit(limit);
    if (error) throw fromDatabaseError(error);
    return { data: { windows: (data ?? []).map(toWindow) } satisfies AvailabilityListResponse };
  },

  POST: async (ctx) => {
    const actor = await requireActor(ctx);
    const input = await parseJsonBody(ctx.req, createAvailabilityWindowInput);
    await requireTechnician(actor);
    const created = await actor.client.rpc("create_availability_window", {
      p_idempotency_key: idempotencyKey(ctx.req),
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
      p_status: input.status,
    });
    if (created.error) throw fromDatabaseError(created.error);
    const { id, replayed } = createdRow(created.data);
    const { data, error } = await actor.client
      .from("availability_windows")
      .select(SELECT)
      .eq("id", id)
      .eq("technician_profile_id", actor.id)
      .maybeSingle();
    if (error) throw fromDatabaseError(error);
    if (!data) throw new ApiError("NOT_FOUND"); // replay of a window deleted since
    return {
      status: replayed ? 200 : 201,
      data: { window: toWindow(data) } satisfies AvailabilityWindowResponse,
    };
  },

  PATCH: async (ctx) => {
    const actor = await requireActor(ctx);
    const { id } = parseQuery(ctx.url, availabilityWindowIdQuery);
    const input = await parseJsonBody(ctx.req, updateAvailabilityWindowInput);
    const { data, error } = await actor.client
      .from("availability_windows")
      .update({ starts_at: input.startsAt, ends_at: input.endsAt, status: input.status })
      .eq("id", id)
      .eq("technician_profile_id", actor.id)
      .select(SELECT)
      .maybeSingle();
    if (error) throw fromDatabaseError(error);
    if (!data) throw new ApiError("NOT_FOUND"); // missing or not owned look the same
    return { data: { window: toWindow(data) } satisfies AvailabilityWindowResponse };
  },

  DELETE: async (ctx) => {
    const actor = await requireActor(ctx);
    const { id } = parseQuery(ctx.url, availabilityWindowIdQuery);
    const { data, error } = await actor.client
      .from("availability_windows")
      .delete()
      .eq("id", id)
      .eq("technician_profile_id", actor.id)
      .select("id")
      .maybeSingle();
    if (error) throw fromDatabaseError(error);
    if (!data) throw new ApiError("NOT_FOUND");
    return { data: { deleted: true, id } satisfies AvailabilityDeleteResponse };
  },
});

if (import.meta.main) Deno.serve(handler);
