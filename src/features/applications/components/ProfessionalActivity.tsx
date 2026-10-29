import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { TERMINAL_APPLICATION_STATUSES } from "@/domain/applications";
import { requirementDays } from "@/domain/work-requirement";
import { assignmentDays, type CalendarWindow } from "@/features/availability/calendar";
import { listOpportunities } from "@/features/opportunities/api";
import { HomeOpportunities } from "@/features/opportunities/components/HomeOpportunities";
import { HOME_FEED, homeOpportunities, miniCalendar } from "@/features/opportunities/home";
import { HomeSection } from "@/features/professional/components/HomeSection";
import type { Locale } from "@/i18n/config";
import { formatMonth, formatPeriod } from "@/i18n/format";
import { listMyApplications } from "../api";
import { APPLICATION_TONE } from "../view";

/** Opportunities read for the calendar dots and the feed (the function's page maximum). */
const DOTS = 50;

/** lucide `CheckCircle`, the v1.8 mark of an application row (`TechnicianHome.jsx:15`). */
const CHECK_CIRCLE = "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3";

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

/**
 * v1.8 technician home (`TechnicianHome.jsx:15`, `ConnectedHome.jsx:15`, T-161): the passport card (the
 * `hero` slot) next to the month with «Asignado» and the red dot, «Oportunidades para ti» (a day filters
 * it) and the latest own applications. A failing feed says so in place; it never breaks «Mi espacio».
 */
export async function ProfessionalActivity({
  reads: [compatible, possible, applications],
  windows,
  month,
  today,
  hero,
}: {
  reads: ActivityReads;
  /** Own availability windows (the calendar's day states). */
  windows: CalendarWindow[];
  /** `YYYY-MM` shown by the calendar. */
  month: string;
  /** `YYYY-MM-DD` (UTC). */
  today: string;
  /** The v1.8 `.personal-passport` card, rendered on the server. */
  hero: ReactNode;
}) {
  const [t, tDomain, locale] = await Promise.all([
    getTranslations("professional.activity"),
    getTranslations("domain"),
    getLocale() as Promise<Locale>,
  ]);
  const mine = applications.ok ? applications.data.applications : [];
  const confirmed = mine.filter((a) => a.status === "confirmed");
  // BR-4.9 / T-16: only `confirmed` marks (and protects) a day; a failed read just omits the marks.
  const assigned = assignmentDays(confirmed.map((a) => a.requirement));
  const rows = homeOpportunities(
    compatible.ok ? compatible.data.opportunities : [],
    possible.ok ? possible.data.opportunities : [],
    windows,
    today,
  ).map((r) => ({ ...r, period: formatPeriod(locale, r.startsAt, r.endsAt) }));

  return (
    <>
      <HomeOpportunities
        key={month}
        hero={hero}
        month={month}
        monthTitle={formatMonth(locale, `${month}-01T00:00:00Z`)}
        today={today}
        days={miniCalendar(windows, month, assigned, rows)}
        rows={rows}
        failed={!compatible.ok}
      />
      <HomeSection
        id="home-applications"
        kicker={t("applicationsKicker")}
        title={t("applicationsTitle")}
        href="/app/professional/applications"
        viewAll={t("viewAll")}
      >
        {!applications.ok ? (
          <p className="p-5 text-sm text-danger" role="alert">
            {t("loadError")}
          </p>
        ) : mine.length === 0 ? (
          <div className="space-y-2 p-8 text-center text-sm">
            <h3 className="text-base font-semibold">{t("noApplications")}</h3>
            <p className="text-muted">{t("noApplicationsHint")}</p>
            <ButtonLink href="/app/professional/opportunities">
              {t("searchOpportunities")}
            </ButtonLink>
          </div>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {mine.slice(0, HOME_FEED).map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-3 p-5 sm:flex-nowrap sm:gap-4"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="hidden size-6 shrink-0 sm:block"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={CHECK_CIRCLE} />
                </svg>
                <span className="min-w-0 flex-1 basis-full sm:basis-auto">
                  <span className="block font-semibold break-words">{a.requirement.title}</span>
                  <span className="block text-muted tabular-nums">
                    {a.requirement.organizationName} ·{" "}
                    {t("days", { count: requirementDays(a.requirement) })}
                  </span>
                </span>
                <span className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                  <StatusChip tone={APPLICATION_TONE[a.status]}>
                    {tDomain(`applicationStatus.${a.status}`)}
                  </StatusChip>
                  <ButtonLink
                    href={`/app/professional/applications#a-${a.id}`}
                    aria-label={`${t("follow")} · ${a.requirement.title}`}
                  >
                    {t("follow")}
                  </ButtonLink>
                </span>
              </li>
            ))}
          </ul>
        )}
      </HomeSection>
    </>
  );
}
