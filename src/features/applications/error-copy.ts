// Client-side copy of a refused application action (imports Notice, which holds client hooks:
// server components must not import this module).
import { actionErrorCopy, type NoticeState } from "@/components/ui/Notice";
import type { ApplicationConflict } from "@/domain/applications";
import { translateKey, type MessageResolver } from "@/i18n/validation";

/** A refused transition names the server check (409 + reason); anything else as every form does. */
export function applicationErrorCopy(
  t: MessageResolver,
  result: { code: string; message: string; reason?: ApplicationConflict; requestId?: string },
): NoticeState {
  if (result.code === "CONFLICT") {
    // Without a reason: the optimistic version check (another tab or the other party moved first).
    const key = result.reason ? `applications.conflict.${result.reason}` : "applications.stale";
    return { tone: "danger", text: translateKey(t, key), requestId: result.requestId };
  }
  return actionErrorCopy(t, result);
}
