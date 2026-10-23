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

/**
 * v2-15 «Ver expediente» / «Cerrar expediente»: the page URL with `?pack=<application id>` set (open) or removed
 * (close); every other search param (filters, page) is kept.
 */
export function withPackParam(href: string, applicationId: string | null): string {
  const url = new URL(href, "http://local");
  if (applicationId) url.searchParams.set("pack", applicationId);
  else url.searchParams.delete("pack");
  return `${url.pathname}${url.search}`;
}

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
