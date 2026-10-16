"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/i18n/config";
import { updatePreferencesInput } from "@/lib/validation/preferences";
import { getSessionActor } from "@/server/session";
import type { ApiErrorBody } from "@/types/api";
import { updatePreferences } from "./api";

export type LocaleActionResult =
  | { ok: true; persisted: boolean }
  | { ok: false; code: ApiErrorBody["code"]; message: string; requestId?: string };

/**
 * Language switch (docs/product/I18N_STRATEGY.md §3): always remembers the choice in the locale
 * cookie (works before sign-in); when a session exists it is also persisted on the user's own
 * profile through the Edge Function, so it follows them to other devices. Never touches the
 * session or the current route — the caller refreshes the tree.
 */
export async function setLocaleAction(input: unknown): Promise<LocaleActionResult> {
  const parsed = updatePreferencesInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", message: "v.locale.invalid" };

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, parsed.data.locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });

  const actor = await getSessionActor();
  if (!actor) return { ok: true, persisted: false };

  const result = await updatePreferences(parsed.data);
  if (!result.ok) {
    return {
      ok: false,
      code: result.error.code,
      message: result.error.message,
      requestId: result.requestId,
    };
  }
  revalidatePath("/", "layout");
  return { ok: true, persisted: true };
}
