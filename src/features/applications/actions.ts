"use server";

import { revalidatePath } from "next/cache";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { applyInput, transitionInput } from "@/lib/validation/applications";
import { idempotencyKeySchema } from "@/lib/validation/idempotency";
import type { ApiErrorBody, ApiErrorCode, ApiResponse } from "@/types/api";
import { applyToRequirement, transitionApplication } from "./api";

export type ApplicationActionResult =
  | { ok: true }
  | {
      ok: false;
      code: ApiErrorCode;
      message: string;
      /** Which server check refused a 409 (D-06); the UI names it. */
      reason?: ApiErrorBody["reason"];
      fieldErrors?: FieldErrors;
      requestId?: string;
    };

function toResult(result: ApiResponse<unknown>): ApplicationActionResult {
  if (result.ok) {
    // Both sides show applications: the professional's pages and the organization's.
    revalidatePath("/app", "layout");
    return { ok: true };
  }
  return {
    ok: false,
    code: result.error.code,
    message: result.error.message,
    reason: result.error.reason,
    fieldErrors: Object.fromEntries(
      (result.error.issues ?? []).map((i) => [i.path.split(".")[0] ?? "form", i.message]),
    ),
    requestId: result.requestId,
  };
}

const invalid = (fieldErrors: FieldErrors): ApplicationActionResult => ({
  ok: false,
  code: "VALIDATION_ERROR",
  message: "common.checkFields",
  fieldErrors,
});

/** Present an application (D-06 ∅ → received). The server re-checks everything (T-08, Q5). */
export async function applyAction(input: unknown, key: unknown): Promise<ApplicationActionResult> {
  const parsed = applyInput.safeParse(input);
  if (!parsed.success) return invalid(toFieldErrors(parsed.error));
  const idempotencyKey = idempotencyKeySchema.safeParse(key);
  if (!idempotencyKey.success) return invalid({ form: "v.idempotencyKey.invalid" });
  return toResult(await applyToRequirement(parsed.data, idempotencyKey.data));
}

/** One transition of the D-06 state machine; the actor comes from the JWT on the server. */
export async function transitionApplicationAction(
  input: unknown,
  key: unknown,
): Promise<ApplicationActionResult> {
  const parsed = transitionInput.safeParse(input);
  if (!parsed.success) return invalid(toFieldErrors(parsed.error));
  const idempotencyKey = idempotencyKeySchema.safeParse(key);
  if (!idempotencyKey.success) return invalid({ form: "v.idempotencyKey.invalid" });
  return toResult(await transitionApplication(parsed.data, idempotencyKey.data));
}
