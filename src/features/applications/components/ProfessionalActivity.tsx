import { getLocale, getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { Metric } from "@/components/ui/Metric";
import { Panel } from "@/components/ui/Panel";
import { StatusChip } from "@/components/ui/StatusChip";
import { TERMINAL_APPLICATION_STATUSES } from "@/domain/applications";
import { assignmentDays, type CalendarWindow } from "@/features/availability/calendar";
import { listOpportunities } from "@/features/opportunities/api";
import { HomeOpportunities } from "@/features/opportunities/components/HomeOpportunities";
import { HOME_FEED, homeOpportunities, miniCalendar } from "@/features/opportunities/home";
import type { Locale } from "@/i18n/config";
import { formatMonth, formatPeriod } from "@/i18n/format";
import { listMyApplications } from "../api";
import { APPLICATION_TONE } from "../view";

/** Opportunities read for the calendar dots and the feed (the function's page maximum). */
const DOTS = 50;

/**
 * v1.8 technician home (`TechnicianHome.jsx:15`, `ConnectedHome.jsx:15`): counters, the month with
 * «Asignado» and the red dot next to «Oportunidades para ti» (a day filters it), and the latest own
 * applications. A failing feed says so in place; it never breaks «Mi espacio».
 */
export async function ProfessionalActivity({
  windows,
  month,
  today,
}: {
  /** Own availability windows (the calendar's day states). */
  windows: CalendarWindow[];
  /** `YYYY-MM` shown by the calendar. */
  month: string;
  /** `YYYY-MM-DD` (UTC). */
  today: string;
}) {
  const [t, tDomain, locale, compatible, possible, applications] = await Promise.all([
    getTranslations("professional.activity"),
    getTranslations("domain"),
    getLocale() as Promise<Locale>,
    listOpportunities({ eligible: "1", limit: DOTS }),
    // BR-14.1 «Posible en descanso»; a failed read only leaves those rows out.
    listOpportunities({ rest: "1", limit: DOTS }),
    listMyApplications(),
  ]);
  const mine = applications.ok ? applications.data.applications : [];
  const active = mine.filter((a) => !TERMINAL_APPLICATION_STATUSES.includes(a.status));
  const toAccept = mine.filter((a) => a.status === "proposed").length;
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
    <section aria-label={t("label")} className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label={t("compatible")}
          value={compatible.ok ? compatible.data.total : "—"}
          tone={compatible.ok && compatible.data.total > 0 ? "ok" : "neutral"}
        />
        <Metric label={t("active")} value={applications.ok ? active.length : "—"} />
        <Metric
          label={t("toAccept")}
          value={applications.ok ? toAccept : "—"}
          tone={toAccept > 0 ? "warn" : "neutral"}
        />
        <Metric label={t("confirmed")} value={applications.ok ? confirmed.length : "—"} />
      </dl>
      <HomeOpportunities
        key={month}
        month={month}
        monthTitle={formatMonth(locale, `${month}-01T00:00:00Z`)}
        today={today}
        days={miniCalendar(windows, month, assigned, rows)}
        rows={rows}
        failed={!compatible.ok}
      />
      <Panel
        title={t("applicationsTitle")}
        actions={
          <ButtonLink href="/app/professional/applications" variant="ghost">
            {t("viewAll")}
          </ButtonLink>
        }
      >
        {!applications.ok ? (
          <p className="text-sm text-danger" role="alert">
            {t("loadError")}
          </p>
        ) : mine.length === 0 ? (
          <div className="space-y-2 text-sm">
            <p className="font-semibold">{t("noApplications")}</p>
            <p className="text-muted">{t("noApplicationsHint")}</p>
            <ButtonLink href="/app/professional/opportunities">
              {t("searchOpportunities")}
            </ButtonLink>
          </div>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {mine.slice(0, HOME_FEED).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold break-words">{a.requirement.title}</span>
                  <span className="block text-muted tabular-nums">
                    {a.requirement.organizationName} ·{" "}
                    {formatPeriod(locale, a.requirement.startsAt, a.requirement.endsAt)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusChip tone={APPLICATION_TONE[a.status]}>
                    {tDomain(`applicationStatus.${a.status}`)}
                  </StatusChip>
                  <ButtonLink
                    size="sm"
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
      </Panel>
    </section>
  );
}
