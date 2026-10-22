"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { shiftMonth } from "@/features/availability/calendar";
import { AvailabilityMonth } from "@/features/availability/components/AvailabilityMonth";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { homeFeed, type HomeOpportunity, type MiniDay } from "../home";

export type HomeRow = HomeOpportunity & { period: string };

/**
 * v1.8 «Mi espacio» calendar + «Oportunidades para ti» (N-03, N-17, N-22): pressing a day filters the
 * feed to it («Oportunidades · {día}», «Quitar selección de fecha»); without a day the feed lists the
 * compatible opportunities, or the possible-on-rest ones when there is none. Data, days and periods come
 * ready from the server; the only client state is the selected day (reset with the month: `key`).
 */
export function HomeOpportunities({
  month,
  monthTitle,
  today,
  days,
  rows,
  failed,
}: {
  month: string;
  monthTitle: string;
  today: string;
  days: MiniDay[];
  rows: HomeRow[];
  /** The compatible opportunities could not be read: the calendar still shows, the feed says so. */
  failed: boolean;
}) {
  const t = useTranslations("professional");
  const locale = useLocale() as Locale;
  const [selected, setSelected] = useState<string | null>(null);
  const feed = homeFeed(rows, selected);

  function clearDay() {
    const day = selected;
    setSelected(null);
    // The button goes away with the selection: focus returns to the day it cleared.
    if (day) document.getElementById(`mini-day-${day}`)?.focus();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title={t("overview.calendarTitle")}
        actions={
          <ButtonLink href={`/app/professional/availability?month=${month}`}>
            {t("overview.openAvailability")}
          </ButtonLink>
        }
      >
        <AvailabilityMonth
          title={monthTitle}
          month={month}
          today={today}
          days={days}
          selected={selected}
          onSelect={setSelected}
          prevHref={`/app/professional?month=${shiftMonth(month, -1)}`}
          nextHref={`/app/professional?month=${shiftMonth(month, 1)}`}
        />
      </Panel>
      <Panel
        title={
          selected
            ? t("activity.opportunitiesDay", { day: formatDate(locale, selected) })
            : t("activity.opportunitiesTitle")
        }
        actions={
          <ButtonLink href="/app/professional/opportunities" variant="ghost">
            {t("activity.viewAll")}
          </ButtonLink>
        }
      >
        <div aria-live="polite">
          {selected && (
            <Button variant="ghost" size="sm" className="mb-2" onClick={clearDay}>
              {t("activity.clearDay")}
            </Button>
          )}
          {failed ? (
            <p className="text-sm text-danger" role="alert">
              {t("activity.loadError")}
            </p>
          ) : feed.length === 0 ? (
            <div className="space-y-2 text-sm">
              <p className="font-semibold">
                {selected ? t("activity.noOpportunitiesDay") : t("activity.noOpportunities")}
              </p>
              <p className="text-muted">{t("activity.noOpportunitiesHint")}</p>
              <ButtonLink href={`/app/professional/availability?month=${month}`}>
                {t("activity.openCalendar")}
              </ButtonLink>
            </div>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {feed.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold break-words">{r.title}</span>
                    <span className="block text-muted">
                      {[r.organizationName, r.location, r.licences.join(", ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="block text-xs text-muted tabular-nums">
                      {r.period} ·{" "}
                      {r.published ? t("activity.compatibleLine") : t("activity.restLine")}
                    </span>
                  </span>
                  {r.published ? (
                    <ButtonLink
                      size="sm"
                      href={`/app/professional/opportunities/${r.id}`}
                      aria-label={`${t("activity.viewOffer")} · ${r.title}`}
                    >
                      {t("activity.viewOffer")}
                    </ButtonLink>
                  ) : (
                    <ButtonLink
                      size="sm"
                      href={`/app/professional/availability?month=${r.month}`}
                      aria-label={`${t("activity.reviewDates")} · ${r.title}`}
                    >
                      {t("activity.reviewDates")}
                    </ButtonLink>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
}
