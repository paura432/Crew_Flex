// User preferences — own row only, any account type (professional or organization).
//   GET   /user-preferences            → { locale }
//   PATCH /user-preferences { locale } → persists profiles.preferred_locale for the JWT subject
// One reusable function instead of per-role endpoints. Identity from the JWT only; the column
// grant (`preferred_locale`) and `profiles_update_own` are the second layer.
import { z } from "zod";
import { requireActor, type Actor } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import { LOCALES } from "../../../src/i18n/config.ts";
import { updatePreferencesInput } from "../../../src/lib/validation/preferences.ts";
import type { PreferencesResponse } from "../../../src/types/api.ts";

const row = z.object({ preferred_locale: z.enum(LOCALES).nullable(), updated_at: z.string() });

export function toPreferences(raw: unknown): PreferencesResponse["preferences"] {
  const r = row.parse(raw);
  return { locale: r.preferred_locale, updatedAt: new Date(r.updated_at).toISOString() };
}

async function readOwn(actor: Actor): Promise<PreferencesResponse["preferences"]> {
  const { data, error } = await actor.client
    .from("profiles")
    .select("preferred_locale, updated_at")
    .eq("id", actor.id)
    .maybeSingle();
  if (error) throw fromDatabaseError(error);
  if (!data) throw new ApiError("NOT_FOUND");
  return toPreferences(data);
}

export const handler = createHandler("user-preferences", {
  GET: async (ctx) => {
    const actor = await requireActor(ctx);
    return { data: { preferences: await readOwn(actor) } satisfies PreferencesResponse };
  },

  PATCH: async (ctx) => {
    const actor = await requireActor(ctx);
    const input = await parseJsonBody(ctx.req, updatePreferencesInput);
    const { data, error } = await actor.client
      .from("profiles")
      .update({ preferred_locale: input.locale })
      .eq("id", actor.id)
      .select("preferred_locale, updated_at")
      .maybeSingle();
    if (error) throw fromDatabaseError(error);
    if (!data) throw new ApiError("NOT_FOUND");
    return { data: { preferences: toPreferences(data) } satisfies PreferencesResponse };
  },
});

if (import.meta.main) Deno.serve(handler);
