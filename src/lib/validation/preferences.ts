// Shared by the Settings form, the server action and the `user-preferences` Edge Function.
import { z } from "./zod.ts";
import { LOCALES } from "../../i18n/config.ts";

export const updatePreferencesInput = z.strictObject({
  locale: z.enum(LOCALES, "v.locale.invalid"),
});
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesInput>;
