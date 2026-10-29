"use server";

import { revalidatePath } from "next/cache";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import {
  archiveDocumentInput,
  documentIdQuery,
  updateDocumentInput,
} from "@/lib/validation/documents";
import type { ApiErrorBody, ApiResponse } from "@/types/api";
import { archiveDocument, deleteDocument, documentUrl, updateDocument } from "./api";

export type DocumentActionResult<T = undefined> =
  | { ok: true; data?: T }
  | {
      ok: false;
      code: ApiErrorBody["code"];
      message: string;
      fieldErrors?: FieldErrors;
      requestId?: string;
    };

const PATH = "/app/professional/documents";

function failure(
  result: Extract<ApiResponse<unknown>, { ok: false }>,
): DocumentActionResult<never> {
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

const invalid = (fieldErrors: FieldErrors): DocumentActionResult<never> => ({
  ok: false,
  code: "VALIDATION_ERROR",
  message: "common.checkFields",
  fieldErrors,
});

/** Re-validated here (never trusts the client) and again by the Edge Function. */
export async function updateDocumentAction(
  id: unknown,
  input: unknown,
): Promise<DocumentActionResult> {
  const idParsed = documentIdQuery.safeParse({ id });
  if (!idParsed.success) return invalid({ form: "v.document.id" });
  const parsed = updateDocumentInput.safeParse(input);
  if (!parsed.success) return invalid(toFieldErrors(parsed.error));
  const result = await updateDocument(idParsed.data.id, parsed.data);
  if (!result.ok) return failure(result);
  revalidatePath(PATH);
  return { ok: true };
}

/** N-19: to the trash (`true`) or back to the wallet (`false`). */
export async function archiveDocumentAction(
  id: unknown,
  archived: unknown,
): Promise<DocumentActionResult> {
  const idParsed = documentIdQuery.safeParse({ id });
  if (!idParsed.success) return invalid({ form: "v.document.id" });
  const parsed = archiveDocumentInput.safeParse({ archived });
  if (!parsed.success) return invalid({ form: "v.invalid" });
  const result = await archiveDocument(idParsed.data.id, parsed.data);
  if (!result.ok) return failure(result);
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteDocumentAction(id: unknown): Promise<DocumentActionResult> {
  const idParsed = documentIdQuery.safeParse({ id });
  if (!idParsed.success) return invalid({ form: "v.document.id" });
  const result = await deleteDocument(idParsed.data.id);
  if (!result.ok) return failure(result);
  revalidatePath(PATH);
  return { ok: true };
}

/** A fresh 60-second link each time; never stored or logged by the app. */
export async function documentUrlAction(id: unknown): Promise<DocumentActionResult<string>> {
  const idParsed = documentIdQuery.safeParse({ id });
  if (!idParsed.success) return invalid({ form: "v.document.id" });
  const result = await documentUrl(idParsed.data.id);
  if (!result.ok) return failure(result);
  return { ok: true, data: result.data.url };
}

/** After a browser-direct upload: refresh the server-rendered list. */
export async function refreshDocumentsAction(): Promise<void> {
  revalidatePath(PATH);
}
