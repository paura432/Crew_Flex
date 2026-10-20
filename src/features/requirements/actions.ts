"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { idempotencyKeySchema } from "@/lib/validation/idempotency";
import {
  closeWorkRequirementInput,
  createWorkRequirementInput,
} from "@/lib/validation/work-requirement";
import type { ApiErrorCode } from "@/types/api";
import { closeRequirement, createRequirement } from "./api";

export type CreateRequirementState =
  | { status: "idle" }
  | {
      status: "error";
      code: ApiErrorCode;
      message: string;
      fieldErrors?: FieldErrors;
      requestId?: string;
    };

/**
 * Validates on the server too (never trusts the client), then delegates to the Edge Function.
 * `idempotencyKey` identifies this logical submission: a retry with the same key returns the
 * requirement created by the first attempt instead of a duplicate.
 */
export async function createRequirementAction(
  input: unknown,
  idempotencyKey: unknown,
): Promise<CreateRequirementState> {
  const parsed = createWorkRequirementInput.safeParse(input);
  const key = idempotencyKeySchema.safeParse(idempotencyKey);
  if (!parsed.success || !key.success) {
    return {
      status: "error",
      code: "VALIDATION_ERROR",
      message: "common.checkFields",
      fieldErrors: parsed.success
        ? { form: "v.idempotencyKey.invalid" }
        : toFieldErrors(parsed.error),
    };
  }

  const result = await createRequirement(parsed.data, key.data);
  if (!result.ok) {
    return {
      status: "error",
      code: result.error.code,
      message: result.error.message,
      fieldErrors: Object.fromEntries(
        (result.error.issues ?? []).map((issue) => [
          issue.path.split(".")[0] ?? "form",
          issue.message,
        ]),
      ),
      requestId: result.requestId,
    };
  }
  redirect(`/app/organization/requirements/${result.data.requirement.id}`);
}

export type CloseRequirementResult =
  { ok: true } | { ok: false; code: ApiErrorCode; message: string; requestId?: string };

/** V1.8 `job.status` → closed. Terminal: the database refuses any later status change. */
export async function closeRequirementAction(id: unknown): Promise<CloseRequirementResult> {
  const parsed = closeWorkRequirementInput.safeParse({ id, status: "closed" });
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", message: "v.requirement.id" };
  const result = await closeRequirement(parsed.data.id);
  if (!result.ok) {
    return {
      ok: false,
      code: result.error.code,
      message: result.error.message,
      requestId: result.requestId,
    };
  }
  revalidatePath("/app/organization", "layout");
  return { ok: true };
}
