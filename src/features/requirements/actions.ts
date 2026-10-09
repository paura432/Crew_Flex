"use server";

import { redirect } from "next/navigation";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
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

/** Validates on the server too (never trusts the client), then delegates to the Edge Function. */
export async function createRequirementAction(input: unknown): Promise<CreateRequirementState> {
  const parsed = createWorkRequirementInput.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      code: "VALIDATION_ERROR",
      message: "Check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const result = await createRequirement(parsed.data);
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
