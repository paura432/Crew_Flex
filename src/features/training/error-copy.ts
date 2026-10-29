// Client-side copy of a refused training action (imports Notice: server components must not import this module).
import { actionErrorCopy, type NoticeState } from "@/components/ui/Notice";
import { translateKey, type MessageResolver } from "@/i18n/validation";
import type { TrainingActionResult } from "./actions";

/** A 409 names the server check (`training.conflict.<REASON>`); without a reason it is the optimistic version check. */
export function trainingErrorCopy(
  t: MessageResolver,
  result: Extract<TrainingActionResult, { ok: false }>,
): NoticeState {
  if (result.code === "CONFLICT") {
    const key = result.reason ? `training.conflict.${result.reason}` : "training.stale";
    return { tone: "danger", text: translateKey(t, key), requestId: result.requestId };
  }
  const field = Object.values(result.fieldErrors ?? {})[0];
  if (result.code === "VALIDATION_ERROR" && field)
    return actionErrorCopy(t, { ...result, message: field });
  return actionErrorCopy(t, result);
}
