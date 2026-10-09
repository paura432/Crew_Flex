"use server";

import { revalidatePath } from "next/cache";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";
import {
  availabilityWindowIdQuery,
  createAvailabilityWindowInput,
} from "@/lib/validation/availability";
import type { ApiErrorBody, ApiResponse } from "@/types/api";
import {
  createAvailabilityWindow,
  deleteAvailabilityWindow,
  updateAvailabilityWindow,
} from "./api";

export type AvailabilityActionResult =
  | { ok: true }
  | {
      ok: false;
      code: ApiErrorBody["code"];
      message: string;
      fieldErrors?: FieldErrors;
      requestId?: string;
    };

const PATH = "/app/professional/availability";

function fromResponse(result: ApiResponse<unknown>): AvailabilityActionResult {
  if (result.ok) {
    revalidatePath(PATH);
    revalidatePath("/app/professional");
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

const invalid = (fieldErrors: FieldErrors): AvailabilityActionResult => ({
  ok: false,
  code: "VALIDATION_ERROR",
  message: "Check the highlighted fields.",
  fieldErrors,
});

/** Server-side validation first (never trusts the client), then the Edge Function. */
export async function createWindowAction(input: unknown): Promise<AvailabilityActionResult> {
  const parsed = createAvailabilityWindowInput.safeParse(input);
  if (!parsed.success) return invalid(toFieldErrors(parsed.error));
  return fromResponse(await createAvailabilityWindow(parsed.data));
}

export async function updateWindowAction(
  id: unknown,
  input: unknown,
): Promise<AvailabilityActionResult> {
  const idParsed = availabilityWindowIdQuery.safeParse({ id });
  if (!idParsed.success) return invalid({ form: "Invalid window." });
  const parsed = createAvailabilityWindowInput.safeParse(input);
  if (!parsed.success) return invalid(toFieldErrors(parsed.error));
  return fromResponse(await updateAvailabilityWindow(idParsed.data.id, parsed.data));
}

export async function deleteWindowAction(id: unknown): Promise<AvailabilityActionResult> {
  const idParsed = availabilityWindowIdQuery.safeParse({ id });
  if (!idParsed.success) return invalid({ form: "Invalid window." });
  return fromResponse(await deleteAvailabilityWindow(idParsed.data.id));
}
