"use server";

import { redirect } from "next/navigation";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { idempotencyKeySchema } from "@/lib/validation/idempotency";
import { createWorkRequirementInput } from "@/lib/validation/work-requirement";
import type { ApiErrorCode } from "@/types/api";
import { createRequirement } from "./api";

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
