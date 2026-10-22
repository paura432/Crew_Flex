"use server";

import { revalidatePath } from "next/cache";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import { idempotencyKeySchema } from "@/lib/validation/idempotency";
import {
  createLogbookEntryInput,
  logbookEntryIdQuery,
  updateLogbookEntryInput,
} from "@/lib/validation/logbook";
import type { ApiErrorBody, ApiResponse } from "@/types/api";
import { createLogbookEntry, deleteLogbookEntry, updateLogbookEntry } from "./api";

export type LogbookActionResult =
  | { ok: true }
  | {
      ok: false;
      code: ApiErrorBody["code"];
      message: string;
      fieldErrors?: FieldErrors;
      requestId?: string;
    };

const PATH = "/app/professional/logbook";

function fromResponse(result: ApiResponse<unknown>): LogbookActionResult {
  if (result.ok) {
    revalidatePath(PATH);
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

const invalid = (fieldErrors: FieldErrors): LogbookActionResult => ({
  ok: false,
  code: "VALIDATION_ERROR",
  message: "common.checkFields",
  fieldErrors,
});

/** Re-validated here (never trusts the client) and again by the Edge Function and the database. */
export async function createLogbookEntryAction(
  input: unknown,
  idempotencyKey: unknown,
): Promise<LogbookActionResult> {
  const parsed = createLogbookEntryInput.safeParse(input);
  if (!parsed.success) return invalid(toFieldErrors(parsed.error));
  const key = idempotencyKeySchema.safeParse(idempotencyKey);
  if (!key.success) return invalid({ form: "v.idempotencyKey.invalid" });
  return fromResponse(await createLogbookEntry(parsed.data, key.data));
}

/** Edit, «Seleccionable para expediente», archive and restore: any subset of the fields. */
export async function updateLogbookEntryAction(
  id: unknown,
  input: unknown,
): Promise<LogbookActionResult> {
  const idParsed = logbookEntryIdQuery.safeParse({ id });
  if (!idParsed.success) return invalid({ form: "v.logbook.id" });
  const parsed = updateLogbookEntryInput.safeParse(input);
  if (!parsed.success) return invalid(toFieldErrors(parsed.error));
  return fromResponse(await updateLogbookEntry(idParsed.data.id, parsed.data));
}

export async function deleteLogbookEntryAction(id: unknown): Promise<LogbookActionResult> {
  const idParsed = logbookEntryIdQuery.safeParse({ id });
  if (!idParsed.success) return invalid({ form: "v.logbook.id" });
  return fromResponse(await deleteLogbookEntry(idParsed.data.id));
}
