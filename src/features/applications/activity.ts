import { TERMINAL_APPLICATION_STATUSES } from "@/domain/applications";
import { listOpportunities } from "@/features/opportunities/api";
import { listMyApplications } from "./api";

/** Opportunities read for the calendar dots and the feed (the function's page maximum). */
const DOTS = 50;

/**
 * The three reads of «Mi espacio»: compatible and possible-on-rest opportunities, own applications.
 * Read once by the page; the hero's counters and this section share them.
 */
export const loadActivity = () =>
  Promise.all([
    listOpportunities({ eligible: "1", limit: DOTS }),
    // BR-14.1 «Posible en descanso»; a failed read only leaves those rows out.
    listOpportunities({ rest: "1", limit: DOTS }),
    listMyApplications(),
  ]);
export type ActivityReads = Awaited<ReturnType<typeof loadActivity>>;

/**
 * The counters: the hero's v1.8 pair (compatible, confirmed) and the Next-only pair (in progress, to
 * accept); null when the read failed (shown as «—»).
 */
export function activityCounts([compatible, , applications]: ActivityReads) {
  const mine = applications.ok ? applications.data.applications : null;
  return {
    compatible: compatible.ok ? compatible.data.total : null,
    confirmed: mine ? mine.filter((a) => a.status === "confirmed").length : null,
    active: mine
      ? mine.filter((a) => !TERMINAL_APPLICATION_STATUSES.includes(a.status)).length
      : null,
    toAccept: mine ? mine.filter((a) => a.status === "proposed").length : null,
  };
}
