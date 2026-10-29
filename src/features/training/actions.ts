"use server";

import { revalidatePath } from "next/cache";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { idempotencyKeySchema } from "@/lib/validation/idempotency";
import { KEYED_OPS, trainingWrite } from "@/lib/validation/training";
import type { ApiErrorBody, ApiErrorCode } from "@/types/api";
import { write } from "./api";

export type TrainingActionResult =
  | { ok: true; data: unknown }
  | {
      ok: false;
      code: ApiErrorCode;
      message: string;
      /** The server check that refused a 409 (`TRAINING_CONFLICTS`); the UI names it. */
      reason?: ApiErrorBody["reason"];
      fieldErrors?: FieldErrors;
      requestId?: string;
    };

/**
 * The one server action of the training module: validates the same `trainingWrite` union the Edge Function parses,
 * then forwards it with the user's JWT. Actor, organization role and every business rule are decided on the server.
 */
export async function trainingWriteAction(
  body: unknown,
  key?: unknown,
): Promise<TrainingActionResult> {
  const parsed = trainingWrite.safeParse(body);
  if (!parsed.success)
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "common.checkFields",
      fieldErrors: toFieldErrors(parsed.error),
    };
  let idempotencyKey: string | undefined;
  if (KEYED_OPS.includes(parsed.data.op)) {
    const k = idempotencyKeySchema.safeParse(key);
    if (!k.success)
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "common.checkFields",
        fieldErrors: { form: "v.idempotencyKey.invalid" },
      };
    idempotencyKey = k.data;
  }
  const result = await write<unknown>(parsed.data, idempotencyKey);
  if (result.ok) {
    revalidatePath("/app", "layout");
    return { ok: true, data: result.data };
  }
  return {
    ok: false,
    code: result.error.code,
    message: result.error.message,
    reason: result.error.reason,
    fieldErrors: Object.fromEntries(
      (result.error.issues ?? []).map((i) => [i.path.split(".").at(-1) ?? "form", i.message]),
    ),
    requestId: result.requestId,
  };
}
