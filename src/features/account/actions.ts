"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { closeAccountWord, createInvitationInput } from "@/lib/validation/account";
import { toFieldErrors } from "@/lib/validation/errors";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type { AccountCloseResponse, InvitationResponse } from "@/types/api";
import type { CloseAccountState, InviteState } from "./state";

/**
 * «Cerrar cuenta» (v1.8 `account.close`, M-3 default T-42): the confirmation word of the UI language
 * must be typed; the `account` function closes the account in one transaction (refused with accepted or
 * confirmed applications → «Resuelve primero…»). Then this device's session cookies are cleared — the
 * server already ended every session — and the login says «Cuenta cerrada.».
 */
export async function closeAccountAction(
  _prev: CloseAccountState,
  formData: FormData,
): Promise<CloseAccountState> {
  const confirm = String(formData.get("confirm") ?? "").trim();
  if (confirm !== closeAccountWord(await getLocale()))
    return { status: "error", code: "CONFIRM_WORD" };

  const result = await invokeEdgeFunction<AccountCloseResponse>("account", {
    method: "DELETE",
    body: { confirm },
  });
  if (!result.ok) {
    return {
      status: "error",
      code:
        result.error.reason === "ACTIVE_COMMITMENTS" ||
        result.error.reason === "ACTIVE_TRAINING_SEATS"
          ? result.error.reason
          : result.error.code,
      requestId: result.requestId,
    };
  }
  const supabase = await createServerSupabase();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?closed=1");
}

/** «Invitar» (platform admin, T-40): the `invitations` function e-mails the link; the code never returns. */
export async function createInvitationAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const values = {
    email: String(formData.get("email") ?? ""),
    accountType: String(formData.get("accountType") ?? ""),
  };
  const parsed = createInvitationInput.safeParse({ ...values, email: values.email.trim() });
  if (!parsed.success) {
    return {
      status: "error",
      code: "VALIDATION_ERROR",
      fieldErrors: toFieldErrors(parsed.error),
      values,
    };
  }
  const result = await invokeEdgeFunction<InvitationResponse>("invitations", {
    method: "POST",
    body: parsed.data,
  });
  if (!result.ok) {
    return { status: "error", code: result.error.code, values, requestId: result.requestId };
  }
  return { status: "sent", email: result.data.invitation.email };
}
