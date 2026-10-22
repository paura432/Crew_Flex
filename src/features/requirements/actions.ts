"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FieldErrors } from "@/lib/validation/errors";
import { idempotencyKeySchema } from "@/lib/validation/idempotency";
import {
  changeRequirementStatusInput,
  createWorkRequirementInput,
  updateWorkRequirementInput,
  viableCandidatesInput,
} from "@/lib/validation/work-requirement";
import { z } from "@/lib/validation/zod";
import type { ApiErrorBody, ApiErrorCode } from "@/types/api";
import {
  archiveRequirement,
  countViableCandidates,
  createRequirement,
  setRequirementStatus,
  updateRequirement,
} from "./api";
import { errorField, toBuilderErrors } from "./form";

export type CreateRequirementState =
  | { status: "idle" }
  | {
      status: "error";
      code: ApiErrorCode;
      message: string;
      fieldErrors?: FieldErrors;
      requestId?: string;
      /** 409 reason (`HAS_APPLICATIONS` when editing, D-06). */
      reason?: ApiErrorBody["reason"];
    };

/** The Edge Function's issues as form fields (`conditions.<key>` kept apart, see `errorField`). */
const issuesToFields = (issues: { path: string; message: string }[] | undefined): FieldErrors => {
  const errors: FieldErrors = {};
  for (const issue of issues ?? []) errors[errorField(issue.path) || "form"] ??= issue.message;
  return errors;
};

/**
 * Validates on the server too (never trusts the client), then delegates to the Edge Function.
 * `idempotencyKey` identifies this logical submission: a retry with the same key returns the
 * requirement created by the first attempt instead of a duplicate. `intent: "draft"` saves a draft.
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
        : toBuilderErrors(parsed.error),
    };
  }

  const result = await createRequirement(parsed.data, key.data);
  if (!result.ok) {
    return {
      status: "error",
      code: result.error.code,
      message: result.error.message,
      fieldErrors: issuesToFields(result.error.issues),
      requestId: result.requestId,
    };
  }
  revalidatePath("/app/organization", "layout");
  redirect(`/app/organization/requirements/${result.data.requirement.id}`);
}

/**
 * Edit (M05, owner 2026-10-22): same validation as create plus the version the form was loaded with;
 * the database refuses it once the requirement has ever received an application (CFA12). A draft is saved
 * as a draft (`intent: "draft"`) or published (`intent: "publish"`).
 */
export async function updateRequirementAction(input: unknown): Promise<CreateRequirementState> {
  const parsed = updateWorkRequirementInput.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      code: "VALIDATION_ERROR",
      message: "common.checkFields",
      fieldErrors: toBuilderErrors(parsed.error),
    };
  }
  const result = await updateRequirement(parsed.data);
  if (!result.ok) {
    return {
      status: "error",
      code: result.error.code,
      message: result.error.message,
      reason: result.error.reason,
      fieldErrors: issuesToFields(result.error.issues),
      requestId: result.requestId,
    };
  }
  revalidatePath("/app/organization", "layout");
  redirect(`/app/organization/requirements/${parsed.data.id}`);
}

export type RequirementStatusResult =
  | { ok: true }
  | {
      ok: false;
      code: ApiErrorCode;
      message: string;
      requestId?: string;
      /** 409 reason, e.g. ACTIVE_COMMITMENTS when closing with accepted/confirmed applications. */
      reason?: ApiErrorBody["reason"];
    };

/**
 * Pause, resume, publish a draft or close (M05, V1.8 `job.status`). The Edge Function checks the lifecycle
 * (and, to publish a draft, the creation rules: 400) and the database enforces and audits it; closing is
 * terminal.
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
      reason: result.error.reason,
    };
  }
  revalidatePath("/app/organization", "layout");
  return { ok: true };
}

/** v1.8 «Archivar» (one way, T-64): a closed requirement, or a draft (closed in the same step). */
export async function archiveRequirementAction(id: unknown): Promise<RequirementStatusResult> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", message: "v.requirement.id" };
  const result = await archiveRequirement(parsed.data);
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

export type ViableCountResult = { ok: true; viable: number } | { ok: false; code: ApiErrorCode };

/** The builder's live count (v2-13): a number only; failures just hide it. */
export async function countViableCandidatesAction(input: unknown): Promise<ViableCountResult> {
  const parsed = viableCandidatesInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR" };
  const result = await countViableCandidates(parsed.data);
  return result.ok
    ? { ok: true, viable: result.data.viable }
    : { ok: false, code: result.error.code };
}
