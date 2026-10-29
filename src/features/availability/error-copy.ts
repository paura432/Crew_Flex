// Client-side copy of a refused availability write (imports Notice, which holds client hooks: server
// components must not import this module).
import { actionErrorCopy, type NoticeState } from "@/components/ui/Notice";
import { translateKey, type MessageResolver } from "@/i18n/validation";
import type { ApiErrorBody } from "@/types/api";

/**
 * What the professional reads when a write is refused. BR-4.9 has the v1.8 connected literals: the
 * calendar save on a day of a confirmed assignment («No puedes modificar una fecha con asignación
 * confirmada.») and a window write that would cut one («Conserva la disponibilidad de tus asignaciones
 * confirmadas.»). A calendar save without a reason is the stale version (W5-03).
 */
export function availabilityErrorCopy(
  t: MessageResolver,
  result: { code: string; message: string; reason?: ApiErrorBody["reason"]; requestId?: string },
  write: "days" | "window",
): NoticeState {
  if (
    result.code === "CONFLICT" &&
    (result.reason === "ASSIGNMENT_PROTECTED" || write === "days")
  ) {
    const key =
      result.reason === "ASSIGNMENT_PROTECTED"
        ? `availability.protected.${write}`
        : "availability.cycle.conflict";
    return { tone: "danger", text: translateKey(t, key), requestId: result.requestId };
  }
  return actionErrorCopy(t, result);
}
