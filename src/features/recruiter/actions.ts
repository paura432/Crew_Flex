"use server";

import { revalidatePath } from "next/cache";
import { toFieldErrors } from "@/lib/validation/errors";
import {
  addRepresentedClientInput,
  representedClientActionInput,
} from "@/lib/validation/recruiter";
import type { ApiErrorBody, ApiResponse } from "@/types/api";
import { actOnRepresentedClient, addRepresentedClient } from "./api";
import type { FieldErrors } from "@/lib/validation/errors";

export type RecruiterActionResult =
  | { ok: true }
  | {
      ok: false;
      code: ApiErrorBody["code"];
      message: string;
      fieldErrors?: FieldErrors;
      requestId?: string;
    };

const invalid = (fieldErrors: FieldErrors): RecruiterActionResult => ({
  ok: false,
  code: "VALIDATION_ERROR",
  message: "common.checkFields",
  fieldErrors,
});

function toResult(result: ApiResponse<unknown>, paths: string[]): RecruiterActionResult {
  if (result.ok) {
    for (const path of paths) revalidatePath(path);
    return { ok: true };
  }
  return {
    ok: false,
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

/** «Añadir cliente»: validated here too, then the Edge Function (role from the DB) and the audited RPC. */
export async function addClientAction(input: unknown): Promise<RecruiterActionResult> {
  const parsed = addRepresentedClientInput.safeParse(input);
  if (!parsed.success) return invalid(toFieldErrors(parsed.error));
  return toResult(await addRepresentedClient(parsed.data), ["/app/recruiter"]);
}

/** «Revocar»: final; the agency's admin/manager only (re-checked by the function and the RPC). */
export async function revokeClientAction(id: unknown): Promise<RecruiterActionResult> {
  const parsed = representedClientActionInput.safeParse({ id, action: "revoke" });
  if (!parsed.success) return invalid(toFieldErrors(parsed.error));
  return toResult(await actOnRepresentedClient(parsed.data), [
    "/app/recruiter",
    "/app/organization/requirements",
  ]);
}

/** «Registrar evidencia y activar» (platform admin, never for their own agency). */
export async function activateClientAction(
  id: unknown,
  note: unknown,
): Promise<RecruiterActionResult> {
  const parsed = representedClientActionInput.safeParse({ id, action: "activate", note });
  if (!parsed.success) return invalid(toFieldErrors(parsed.error));
  return toResult(await actOnRepresentedClient(parsed.data), ["/app/admin/representations"]);
}
