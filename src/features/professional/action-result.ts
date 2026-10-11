import "server-only";
import { revalidatePath } from "next/cache";
import type { FieldErrors } from "@/lib/validation/errors";
import type { ApiErrorBody, ApiResponse } from "@/types/api";

/** Result shape shared by the passport and qualification server actions. */
export type ProfileActionResult =
  | { ok: true }
  | {
      ok: false;
      code: ApiErrorBody["code"];
      message: string;
      fieldErrors?: FieldErrors;
      requestId?: string;
    };

export const invalidResult = (fieldErrors: FieldErrors): ProfileActionResult => ({
  ok: false,
  code: "VALIDATION_ERROR",
  message: "Check the highlighted fields.",
  fieldErrors,
});

/** Maps the Edge Function envelope to a form result; revalidates the pages that show the data. */
export function fromProfessionalResponse(
  result: ApiResponse<unknown>,
  paths: string[],
): ProfileActionResult {
  if (result.ok) {
    for (const path of paths) revalidatePath(path);
    revalidatePath("/app/professional");
    revalidatePath("/app", "layout"); // the shell shows the display name
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
