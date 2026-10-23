"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { NavIcon } from "@/components/layout/NavLinks";
import { Button, ButtonLink } from "@/components/ui/Button";
import { shiftMonth } from "@/features/availability/calendar";
import { AvailabilityMonth } from "@/features/availability/components/AvailabilityMonth";
import { HomeSection } from "@/features/professional/components/HomeSection";
import type { Locale } from "@/i18n/config";
import { formatDate, formatEuro } from "@/i18n/format";
import { homeFeed, type HomeOpportunity, type MiniDay } from "../home";

export type HomeRow = HomeOpportunity & { period: string };

/**
 * v1.8 «Mi espacio» top and feed (N-03, N-17, N-22, T-161): the passport card next to the calendar card
 * (`.personal-top`, two columns from `xl` as v1.8 above 1050 px), then «Oportunidades para ti» at full
 * width. Pressing a day filters the feed to it («Oportunidades · {día}», «Quitar selección de fecha»);
 * without a day the feed lists the compatible opportunities, or the possible-on-rest ones when there is
 * none. Data, days and periods come ready from the server; the only client state is the selected day
 * (reset with the month: `key`). The hero is a server component passed as a slot.
 */
export function HomeOpportunities({
  hero,
  month,
  monthTitle,
  today,
  days,
  rows,
  failed,
}: {
  hero: ReactNode;
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
  const calendarHref = `/app/professional/availability?month=${month}`;

  function clearDay() {
    const day = selected;
    setSelected(null);
    // The button goes away with the selection: focus returns to the day it cleared.
    if (day) document.getElementById(`mini-day-${day}`)?.focus();
  }

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        {hero}
        {/* v1.8 `.home-calendar`: kicker, the month, the grid, legend, note and the CTA at the foot. */}
        <section
          aria-labelledby="home-month"
          className="flex flex-col rounded-2xl border border-line bg-white p-5 sm:p-6"
        >
          <AvailabilityMonth
            kicker={t("overview.calendarTitle")}
            title={monthTitle}
            month={month}
            today={today}
            days={days}
            selected={selected}
            onSelect={setSelected}
            prevHref={`/app/professional?month=${shiftMonth(month, -1)}`}
            nextHref={`/app/professional?month=${shiftMonth(month, 1)}`}
          />
          <ButtonLink href={calendarHref} className="mt-4 self-start">
            <NavIcon href="/app/professional/availability" className="size-4" />
            {t("overview.openAvailability")}
          </ButtonLink>
        </section>
      </div>
      <HomeSection
        id="home-opportunities"
        kicker={t("activity.kicker")}
        title={
          selected
            ? t("activity.opportunitiesDay", { day: formatDate(locale, selected) })
            : t("activity.opportunitiesTitle")
        }
        href="/app/professional/opportunities"
        viewAll={t("activity.viewAll")}
      >
        <div aria-live="polite">
          {selected && (
            <Button variant="ghost" size="sm" className="m-3 mb-0" onClick={clearDay}>
              {t("activity.clearDay")}
            </Button>
          )}
          {failed ? (
            <p className="p-5 text-sm text-danger" role="alert">
              {t("activity.loadError")}
            </p>
          ) : feed.length === 0 ? (
            // v1.8 `.home-empty`: centred title, hint and «Abrir mi calendario».
            <div className="space-y-2 p-8 text-center text-sm">
              <h3 className="text-base font-semibold">
                {selected ? t("activity.noOpportunitiesDay") : t("activity.noOpportunities")}
              </h3>
              <p className="text-muted">{t("activity.noOpportunitiesHint")}</p>
              <ButtonLink href={calendarHref}>{t("activity.openCalendar")}</ButtonLink>
            </div>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {feed.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 p-5 sm:flex-nowrap sm:gap-4"
                >
                  {/* v1.8 `.feed-mark` (hidden ≤ 390 px): teal, or red for «posible en descanso». */}
                  <span
                    aria-hidden
                    className={`hidden size-10 shrink-0 place-items-center rounded-[10px] sm:grid ${r.published ? "bg-ok-bg text-ok" : "bg-danger-bg text-danger"}`}
                  >
                    <NavIcon href="/app/professional/availability" className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1 basis-full sm:basis-auto">
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
                  {/* v1.8 `.feed-rate`: the hourly rate (when the need states one) over the button. */}
                  <span className="flex w-full items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-end">
                    {r.hourlyRate !== null && (
                      <b className="tabular-nums">
                        {t("activity.rate", { amount: formatEuro(locale, r.hourlyRate) })}
                      </b>
                    )}
                    {r.published ? (
                      <ButtonLink
                        href={`/app/professional/opportunities/${r.id}`}
                        aria-label={`${t("activity.viewOffer")} · ${r.title}`}
                      >
                        {t("activity.viewOffer")}
                      </ButtonLink>
                    ) : (
                      <ButtonLink
                        href={`/app/professional/availability?month=${r.month}`}
                        aria-label={`${t("activity.reviewDates")} · ${r.title}`}
                      >
                        {t("activity.reviewDates")}
                      </ButtonLink>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </HomeSection>
    </>
  );
}
