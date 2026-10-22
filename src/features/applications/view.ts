// Presentation decisions for applications (M08), kept out of JSX. Pure; server- and client-safe.
import type { Tone } from "@/components/ui/StatusChip";
import type { ApplicationStatus, ApplicationTransition } from "@/domain/applications";

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
