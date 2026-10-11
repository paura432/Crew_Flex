// Professional profile — own data only ("Mi pasaporte" identity, experience, mobility, visibility).
//   GET   /professional-profile                → own profile (profiles.display_name + technician_profiles)
//   PATCH /professional-profile { displayName, baseLocation, mobility, yearsExperience, currentStatus, visibility }
// The technician is ALWAYS the JWT subject: the body never carries ownership. Column grants and RLS
// (`profile_id = auth.uid()`, `display_name` the only writable profiles column) are the second layer;
// `platform_role`, `account_type` and `verification_status` are not reachable from here.
import { z } from "zod";
import { requireActor, type Actor } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import {
  MOBILITIES,
  PROFILE_VISIBILITIES,
  TECHNICIAN_STATUSES,
} from "../../../src/domain/professional.ts";
import { updateProfessionalProfileInput } from "../../../src/lib/validation/professional.ts";
import type { ProfessionalProfileResponse } from "../../../src/types/api.ts";

const SELECT =
  "profile_id, base_location, mobility, years_experience, current_status, visibility, updated_at, profiles!inner ( display_name, updated_at )";

const row = z.object({
  profile_id: z.string(),
  base_location: z.string().nullable(),
  mobility: z.enum(MOBILITIES),
  years_experience: z.number().int().nullable(),
  current_status: z.enum(TECHNICIAN_STATUSES),
  visibility: z.enum(PROFILE_VISIBILITIES),
  updated_at: z.string(),
  profiles: z.object({ display_name: z.string(), updated_at: z.string() }),
});

export function toProfile(raw: unknown): ProfessionalProfileResponse["profile"] {
  const r = row.parse(raw);
  const updated = Math.max(Date.parse(r.updated_at), Date.parse(r.profiles.updated_at));
  return {
    displayName: r.profiles.display_name,
    baseLocation: r.base_location,
    mobility: r.mobility,
    yearsExperience: r.years_experience,
    currentStatus: r.current_status,
    visibility: r.visibility,
    updatedAt: new Date(updated).toISOString(),
  };
}

async function readOwnProfile(actor: Actor): Promise<ProfessionalProfileResponse["profile"]> {
  const { data, error } = await actor.client
    .from("technician_profiles")
    .select(SELECT)
    .eq("profile_id", actor.id)
    .maybeSingle();
  if (error) throw fromDatabaseError(error);
  if (!data) throw new ApiError("FORBIDDEN", "Only professional accounts have a passport.");
  return toProfile(data);
}

export const handler = createHandler("professional-profile", {
  GET: async (ctx) => {
    const actor = await requireActor(ctx);
    return { data: { profile: await readOwnProfile(actor) } satisfies ProfessionalProfileResponse };
  },

  PATCH: async (ctx) => {
    const actor = await requireActor(ctx);
    const input = await parseJsonBody(ctx.req, updateProfessionalProfileInput);
    await readOwnProfile(actor); // professionals only (403 otherwise), before any write

    const technician = await actor.client
      .from("technician_profiles")
      .update({
        base_location: input.baseLocation,
        mobility: input.mobility,
        years_experience: input.yearsExperience,
        current_status: input.currentStatus,
        visibility: input.visibility,
      })
      .eq("profile_id", actor.id)
      .select("profile_id")
      .maybeSingle();
    if (technician.error) throw fromDatabaseError(technician.error);
    if (!technician.data) throw new ApiError("FORBIDDEN");

    const name = await actor.client
      .from("profiles")
      .update({ display_name: input.displayName })
      .eq("id", actor.id)
      .select("id")
      .maybeSingle();
    if (name.error) throw fromDatabaseError(name.error);
    if (!name.data) throw new ApiError("FORBIDDEN");

    return { data: { profile: await readOwnProfile(actor) } satisfies ProfessionalProfileResponse };
  },
});

if (import.meta.main) Deno.serve(handler);
