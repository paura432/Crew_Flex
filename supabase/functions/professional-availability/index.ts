// Professional availability windows — own data only.
//   GET    /professional-availability?limit=        → list own windows (RLS) + calendar `version`
//   POST   /professional-availability { startsAt, endsAt, status }   (Idempotency-Key: 201 · 200 replay)
//   PATCH  /professional-availability?id=<uuid> { startsAt, endsAt, status }
//   DELETE /professional-availability?id=<uuid>
//   PUT    /professional-availability { days: [{ date, status|null }], rotation?, expectedVersion? }
//          (Idempotency-Key) → sets whole UTC days atomically (shift-cycle generator), RPC
//          replace_availability_days; 409 CONFLICT when `expectedVersion` is stale (W5-03)
// The technician id is ALWAYS the JWT subject: the body never carries ownership. RLS enforces
// `technician_profile_id = auth.uid()` as a second layer.
import { z } from "zod";
import { requireActor, type Actor } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { createdRow, idempotencyKey, parseJsonBody, parseQuery } from "../_shared/validation.ts";
import { AVAILABILITY_STATUSES, CYCLE_DAYS, ROTATIONS } from "../../../src/domain/availability.ts";
import {
  availabilityWindowIdQuery,
  createAvailabilityWindowInput,
  listAvailabilityQuery,
  replaceAvailabilityDaysInput,
  type ReplaceAvailabilityDaysInput,
  updateAvailabilityWindowInput,
} from "../../../src/lib/validation/availability.ts";
import type {
  AvailabilityDaysResponse,
  AvailabilityRotation,
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

const rotationRow = z.object({
  pattern: z.enum(ROTATIONS),
  anchor: z.string(),
  custom_cycle: z.array(z.enum(CYCLE_DAYS)),
});

export function toRotation(raw: unknown): AvailabilityRotation {
  const r = rotationRow.parse(raw);
  return { pattern: r.pattern, anchor: r.anchor.slice(0, 10), customCycle: r.custom_cycle };
}

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

/** RPC arguments of the calendar save; no `expectedVersion` (older clients) means no check. */
export const replaceDaysArgs = (input: ReplaceAvailabilityDaysInput, key: string) => ({
  p_idempotency_key: key,
  p_days: input.days,
  p_rotation: input.rotation ?? null,
  p_expected_version: input.expectedVersion ?? null,
});

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
    // Read before the rows: a write landing in between makes the next save conflict (safe side)
    // instead of passing with rows the client never saw.
    const version = await actor.client.rpc("availability_version");
    if (version.error) throw fromDatabaseError(version.error);
    const [windows, rotation] = await Promise.all([
      actor.client
        .from("availability_windows")
        .select(SELECT)
        .eq("technician_profile_id", actor.id)
        .order("starts_at", { ascending: true })
        .limit(limit),
      actor.client
        .from("availability_rotations")
        .select("pattern, anchor, custom_cycle")
        .eq("technician_profile_id", actor.id)
        .maybeSingle(),
    ]);
    if (windows.error) throw fromDatabaseError(windows.error);
    if (rotation.error) throw fromDatabaseError(rotation.error);
    return {
      data: {
        windows: (windows.data ?? []).map(toWindow),
        rotation: rotation.data ? toRotation(rotation.data) : null,
        version: z.string().parse(version.data),
      } satisfies AvailabilityListResponse,
    };
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

  PUT: async (ctx) => {
    const actor = await requireActor(ctx);
    const input = await parseJsonBody(ctx.req, replaceAvailabilityDaysInput);
    await requireTechnician(actor);
    const applied = await actor.client.rpc(
      "replace_availability_days",
      replaceDaysArgs(input, idempotencyKey(ctx.req)),
    );
    if (applied.error) throw fromDatabaseError(applied.error);
    const { id, replayed } = createdRow(applied.data);
    return { data: { changeId: id, replayed } satisfies AvailabilityDaysResponse };
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
