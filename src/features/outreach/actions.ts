"use server";

import { revalidatePath } from "next/cache";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { noticePreferencesInput, outreachRequirementInput } from "@/lib/validation/outreach";
import type { ApiErrorBody, ApiResponse, OutreachDistribution } from "@/types/api";
import { distributeOutreach, saveNoticePreferences } from "./api";

type Failure = {
  ok: false;
  code: ApiErrorBody["code"];
  message: string;
  fieldErrors?: FieldErrors;
  requestId?: string;
  /** 409 reason (`OUTREACH_CONFLICTS`). */
  reason?: ApiErrorBody["reason"];
};

export type NoticePreferencesActionResult = { ok: true } | Failure;
export type DistributeOutreachActionResult =
  { ok: true; distribution: OutreachDistribution } | Failure;

const failure = (result: Extract<ApiResponse<unknown>, { ok: false }>): Failure => ({
  ok: false,
  code: result.error.code,
  message: result.error.message,
  reason: result.error.reason,
  fieldErrors: Object.fromEntries(
    (result.error.issues ?? []).map((issue) => [issue.path.split(".")[0] ?? "form", issue.message]),
  ),
  requestId: result.requestId,
});

/** N-10: re-validated here (never trusts the client), again by the Edge Function and the database. */
export async function saveNoticePreferencesAction(
  input: unknown,
): Promise<NoticePreferencesActionResult> {
  const parsed = noticePreferencesInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "common.checkFields",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }
  const result = await saveNoticePreferences(parsed.data);
  if (!result.ok) return failure(result);
  revalidatePath("/app/settings");
  return { ok: true };
}

/** v2-17 «Distribuir aviso Urgente / AOG»: the database decides the audience; we get a count. */
export async function distributeOutreachAction(
  requirementId: unknown,
): Promise<DistributeOutreachActionResult> {
  const parsed = outreachRequirementInput.safeParse({ requirementId });
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", message: "v.invalid" };
  const result = await distributeOutreach(parsed.data.requirementId);
  if (!result.ok) return failure(result);
  revalidatePath(`/app/organization/requirements/${parsed.data.requirementId}`);
  return { ok: true, distribution: result.data.distribution };
}
