// The professional's notice preferences («Avisos de oportunidades», package outreach N-10; migration
// 20261024400100, BUSINESS_RULES BR-26). Professional accounts only (403 otherwise); the owner is the JWT
// subject — the RPC writes `auth.uid()`'s row, no id travels in the body.
// GET /notice-preferences → NoticePreferencesResponse (the defaults while never saved: nothing opted in,
//                           no mobilization, Europe/Madrid, no quiet hours)
// PUT /notice-preferences { urgentOptIn, aogOptIn, mobilizationHours, timeZone, quietStart, quietEnd }
//                         → NoticePreferencesResponse (the stored row; the zone in the database's spelling)
// Only the in-app «Urgente/AOG» notices read them: no e-mail, SMS or push exists (OUT).
import { z } from "zod";
import { type Actor, requireActor, requireTechnician } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { toIso } from "../_shared/requirements.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import { DEFAULT_NOTICE_PREFERENCES } from "../../../src/domain/outreach.ts";
import {
  noticePreferencesInput,
  type NoticePreferencesInput,
} from "../../../src/lib/validation/outreach.ts";
import type { NoticePreferencesResponse } from "../../../src/types/api.ts";

const NOT_A_PROFESSIONAL = "Only professional accounts have notice preferences.";
const SELECT =
  "urgent_opt_in, aog_opt_in, mobilization_hours, time_zone, quiet_start, quiet_end, updated_at";

const preferencesRow = z.object({
  urgent_opt_in: z.boolean(),
  aog_opt_in: z.boolean(),
  mobilization_hours: z.number().int().nullable(),
  time_zone: z.string(),
  quiet_start: z.string().nullable(),
  quiet_end: z.string().nullable(),
  updated_at: z.string(),
});

/** Postgres `time` (`HH:MM:SS`) → the form's `HH:MM` (the column holds whole minutes). */
const toHourMinute = (value: string | null) => (value === null ? null : value.slice(0, 5));

/** The stored row, or the defaults when the professional never saved the form. */
export function toPreferences(raw: unknown): NoticePreferencesResponse["preferences"] {
  if (raw === null || raw === undefined) return { ...DEFAULT_NOTICE_PREFERENCES, updatedAt: null };
  const r = preferencesRow.parse(Array.isArray(raw) ? raw[0] : raw);
  return {
    urgentOptIn: r.urgent_opt_in,
    aogOptIn: r.aog_opt_in,
    mobilizationHours: r.mobilization_hours,
    timeZone: r.time_zone,
    quietStart: toHourMinute(r.quiet_start),
    quietEnd: toHourMinute(r.quiet_end),
    updatedAt: toIso(r.updated_at),
  };
}

/** RPC arguments: the form's values only — the owner is `auth.uid()` inside the function. */
export const saveArgs = (input: NoticePreferencesInput) => ({
  p_urgent_opt_in: input.urgentOptIn,
  p_aog_opt_in: input.aogOptIn,
  p_mobilization_hours: input.mobilizationHours,
  p_time_zone: input.timeZone,
  p_quiet_start: input.quietStart,
  p_quiet_end: input.quietEnd,
});

async function professional(ctx: Parameters<typeof requireActor>[0]): Promise<Actor> {
  const actor = await requireActor(ctx);
  await requireTechnician(actor, NOT_A_PROFESSIONAL);
  return actor;
}

export const handler = createHandler("notice-preferences", {
  GET: async (ctx) => {
    const actor = await professional(ctx);
    const { data, error } = await actor.client
      .from("technician_notice_preferences")
      .select(SELECT)
      .eq("profile_id", actor.id)
      .maybeSingle();
    if (error) throw fromDatabaseError(error);
    return { data: { preferences: toPreferences(data) } satisfies NoticePreferencesResponse };
  },

  PUT: async (ctx) => {
    const actor = await professional(ctx);
    const input = await parseJsonBody(ctx.req, noticePreferencesInput);
    const { data, error } = await actor.client.rpc("save_notice_preferences", saveArgs(input));
    if (error) {
      // The database's zone list has the last word (a name this runtime knows and Postgres does not).
      if (error.code === "22023") {
        throw new ApiError("VALIDATION_ERROR", undefined, [
          { path: "timeZone", message: "v.outreach.timeZone" },
        ]);
      }
      throw fromDatabaseError(error);
    }
    if (!Array.isArray(data) || data.length !== 1) throw new ApiError("INTERNAL_ERROR");
    return { data: { preferences: toPreferences(data) } satisfies NoticePreferencesResponse };
  },
});

if (import.meta.main) Deno.serve(handler);
