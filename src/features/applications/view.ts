// Presentation decisions for applications (M08), kept out of JSX. Pure; client-safe.
import { actionErrorCopy, type NoticeState } from "@/components/ui/Notice";
import type { Tone } from "@/components/ui/StatusChip";
import type {
  ApplicationConflict,
  ApplicationStatus,
  ApplicationTransition,
} from "@/domain/applications";
import { translateKey, type MessageResolver } from "@/i18n/validation";

export const APPLICATION_TONE: Record<ApplicationStatus, Tone> = {
  received: "info",
  shortlisted: "info",
  proposed: "warn",
  accepted: "warn",
  confirmed: "ok",
  finished: "neutral",
  rejected: "danger",
  withdrawn: "neutral",
  cancelled: "danger",
};

export type TransitionLabel =
  | "propose"
  | "repropose"
  | "cancelAccepted"
  | "cancelAssignment"
  | Exclude<ApplicationStatus, "received" | "proposed" | "cancelled">;

/** Catalog key (`applications.action.*`) of the button for one transition. */
export function transitionLabelKey(t: Pick<ApplicationTransition, "from" | "to">): TransitionLabel {
  if (t.to === "proposed") return t.from === "accepted" ? "repropose" : "propose";
  if (t.to === "cancelled") return t.from === "confirmed" ? "cancelAssignment" : "cancelAccepted";
  if (t.to === "received") throw new Error("no transition into received");
  return t.to;
}

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
