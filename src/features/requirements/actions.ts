"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { idempotencyKeySchema } from "@/lib/validation/idempotency";
import {
  changeRequirementStatusInput,
  createWorkRequirementInput,
  updateWorkRequirementInput,
} from "@/lib/validation/work-requirement";
import type { ApplicationConflict } from "@/domain/applications";
import type { ApiErrorCode } from "@/types/api";
import { createRequirement, setRequirementStatus, updateRequirement } from "./api";

export type CreateRequirementState =
  | { status: "idle" }
  | {
      status: "error";
      code: ApiErrorCode;
      message: string;
      fieldErrors?: FieldErrors;
      requestId?: string;
      /** 409 reason (`HAS_APPLICATIONS` when editing, D-06). */
      reason?: ApplicationConflict;
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

/**
 * Edit (M05, owner 2026-10-22): same validation as create plus the version the form was loaded with;
 * the database refuses it once the requirement has ever received an application (CFA12).
 */
export async function updateRequirementAction(input: unknown): Promise<CreateRequirementState> {
  const parsed = updateWorkRequirementInput.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      code: "VALIDATION_ERROR",
      message: "common.checkFields",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }
  const result = await updateRequirement(parsed.data);
  if (!result.ok) {
    return {
      status: "error",
      code: result.error.code,
      message: result.error.message,
      reason: result.error.reason,
      fieldErrors: Object.fromEntries(
        (result.error.issues ?? []).map((issue) => [
          issue.path.split(".")[0] ?? "form",
          issue.message,
        ]),
      ),
      requestId: result.requestId,
    };
  }
  revalidatePath("/app/organization", "layout");
  redirect(`/app/organization/requirements/${parsed.data.id}`);
}

export type RequirementStatusResult =
  { ok: true } | { ok: false; code: ApiErrorCode; message: string; requestId?: string };

/**
 * Pause, resume or close (M05, V1.8 `job.status`). The Edge Function checks the lifecycle and the
 * database enforces and audits it; closing is terminal.
 */
export async function changeRequirementStatusAction(
  id: unknown,
  status: unknown,
): Promise<RequirementStatusResult> {
  const parsed = changeRequirementStatusInput.safeParse({ id, status });
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", message: "v.requirement.id" };
  const result = await setRequirementStatus(parsed.data);
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
