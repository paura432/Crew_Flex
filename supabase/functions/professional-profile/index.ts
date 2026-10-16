// Professional profile — own data only ("Mi pasaporte" identity, experience, mobility, visibility).
//   GET   /professional-profile                → own profile (profiles.display_name + technician_profiles)
//   PATCH /professional-profile { displayName, baseLocation, mobility, yearsExperience, currentStatus, visibility, expectedUpdatedAt? }
//         → atomic RPC update_professional_profile (all fields or none; 409 if changed since expectedUpdatedAt)
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
  // The passport version is technician_profiles.updated_at: every passport save touches it, while
  // profiles.updated_at also moves on a language change (that must not invalidate an open form).
  const updated = Date.parse(r.updated_at);
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

    // One RPC = one transaction: both tables are saved or neither is (I-3). SECURITY INVOKER, so
    // the column grants and RLS still decide what the caller may write.
    const { error } = await actor.client.rpc("update_professional_profile", {
      p_display_name: input.displayName,
      p_base_location: input.baseLocation,
      p_mobility: input.mobility,
      p_years_experience: input.yearsExperience,
      p_current_status: input.currentStatus,
      p_visibility: input.visibility,
      p_expected_updated_at: input.expectedUpdatedAt ?? null,
    });
    if (error) throw fromDatabaseError(error); // CF412 → CONFLICT (changed elsewhere since loaded)

    return { data: { profile: await readOwnProfile(actor) } satisfies ProfessionalProfileResponse };
  },
});

if (import.meta.main) Deno.serve(handler);
