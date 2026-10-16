import "server-only";
import type { UpdatePreferencesInput } from "@/lib/validation/preferences";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type { PreferencesResponse } from "@/types/api";

/** Own preferences through the `user-preferences` Edge Function (any account type). */
export const updatePreferences = (input: UpdatePreferencesInput) =>
  invokeEdgeFunction<PreferencesResponse>("user-preferences", { method: "PATCH", body: input });
