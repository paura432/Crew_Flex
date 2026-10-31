// What the «Avisos» page and the shell show for a notice: the copy key and the one place it leads to,
// the page intro and the unread badge. Pure (the page, the server action and the tests share it). The link is
// derived from the notice the server returned, never from the browser.
import { TRAINING_STATUS_LABEL_KEYS } from "@/domain/training";
import type { Notice } from "@/types/api";

/** A training notice's status as its `training.status.*` key; null for one the catalog does not name. */
export const trainingStatusKey = (status: string) =>
  Object.hasOwn(TRAINING_STATUS_LABEL_KEYS, status)
    ? TRAINING_STATUS_LABEL_KEYS[status as keyof typeof TRAINING_STATUS_LABEL_KEYS]
    : null;

/** v1.8 «Actualización de candidatura»; the organization also learns of a NEW application (HIRE-07 #7). */
export function noticeTitleKey(
  notice: Pick<
    Notice,
    "kind" | "audience" | "applicationStatus" | "requirementStatus" | "outreachUrgency"
  >,
) {
  // ADR-003: one key for every training event; the description carries the status (UI batch V19-02…).
  if (notice.kind === "training") return "training";
  // v1.8 `app.mjs:104` «{modo}: {título}» (v2-17): the mode it was distributed for.
  if (notice.kind === "outreach") {
    return notice.outreachUrgency === "aog" ? "outreachAog" : "outreachUrgent";
  }
  if (notice.kind === "requirement") {
    return notice.requirementStatus === "paused"
      ? "requirementPaused"
      : notice.requirementStatus === "closed"
        ? "requirementClosed"
        : "requirementResumed";
  }
  return notice.audience === "organization" && notice.applicationStatus === "received"
    ? "newApplication"
    : "applicationUpdate";
}

/**
 * Technician side: the card in «Mis candidaturas» (v1.8 went to `applications`); organization side:
 * the applications of that requirement, at the applicant's card; an outreach notice: the opportunity
 * itself (v1.8 «Ver oportunidades»: decide whether to apply).
 */
export function noticeHref(
  notice: Pick<Notice, "kind" | "audience" | "applicationId" | "requirementId" | "training">,
) {
  // Training (ADR-003): the professional's requests or the provider's workspace.
  if (notice.kind === "training") {
    return notice.audience === "technician"
      ? "/app/training/requests"
      : "/app/organization/training";
  }
  if (notice.kind === "outreach") return `/app/professional/opportunities/${notice.requirementId}`;
  return notice.audience === "technician"
    ? `/app/professional/applications#a-${notice.applicationId}`
    : `/app/organization/requirements/${notice.requirementId}/applications#a-${notice.applicationId}`;
}

/** The page's intro names what this account receives (v1.8 ✗ SH-06 #14: one technician text for all). */
export function noticesIntroKey(account: { professional: boolean; manages: boolean }) {
  return account.professional ? (account.manages ? "both" : "technician") : "organization";
}

/** The count on the bell and the menu entry: hidden at 0, capped at «99+». */
export const unreadBadge = (count: number | null) =>
  count === null || count <= 0 ? null : count > 99 ? "99+" : String(count);
