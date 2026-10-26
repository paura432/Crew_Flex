"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import type { MiniDay } from "@/features/opportunities/home";
import {
  ASSIGNED_STYLE,
  DAY_STYLE,
  isDayEditable,
  monthOffset,
  WEEKDAYS,
  type DayState,
} from "../calendar";

/** v1.8 `.mini-legend` order («Trabajo · Descanso · Disponible · Asignado · ● Oportunidades») plus our two states. */
const LEGEND: DayState[] = ["unavailable", "none", "available", "aog_only", "mixed"];

/**
 * «Mi espacio» month (v1.8 `TechnicianHome.jsx:15` / `ConnectedHome.jsx:15`): kicker «TU DISPONIBILIDAD»,
 * the month as the heading, own day states with BR-4.8 precedence, «Asignado» on the days of a confirmed
 * assignment, a red dot on days with opportunities. A day is a toggle (`aria-pressed`) that filters the
 * feed below; past days are disabled (demo). Month navigation by link (`?month=`). Editing stays on the
 * availability page.
 */
export function AvailabilityMonth({
  kicker,
  title,
  month,
  today,
  days,
  selected,
  onSelect,
  prevHref,
  nextHref,
}: {
  kicker: string;
  /** The month as a title, formatted on the server (X-18). */
  title: string;
  month: string;
  today: string;
  days: MiniDay[];
  selected: string | null;
  onSelect: (date: string | null) => void;
  prevHref: string;
  nextHref: string;
}) {
  const t = useTranslations("availability");
  const nav =
    "grid size-9 place-items-center rounded-lg border border-line hover:bg-canvas pointer-coarse:size-11";
  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">{kicker}</p>
          <h2 id="home-month" className="mt-1 text-lg font-semibold tracking-tight">
            {title}
          </h2>
        </div>
        <div className="flex gap-1">
          <Link href={prevHref} aria-label={t("prevMonth")} className={nav}>
            ←
          </Link>
          <Link href={nextHref} aria-label={t("nextMonth")} className={nav}>
            →
          </Link>
        </div>
      </div>
      {/* v1.8 «L M X J V S D»: one letter per weekday; the full names stay on the editable calendar. */}
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted uppercase">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {t(`weekdayShort.${d}`)}
          </div>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1" aria-label={t("calendarLabel")}>
        {Array.from({ length: monthOffset(month) }, (_, i) => (
          <li key={`pad-${i}`} aria-hidden />
        ))}
        {days.map((day) => {
          const state = day.assigned ? t("assignedDay") : t(`day.${day.state}`);
          const pressed = selected === day.date;
          const isToday = day.date === today;
          return (
            <li key={day.date}>
              <button
                id={`mini-day-${day.date}`}
                type="button"
                disabled={!isDayEditable(day.date, today)}
                aria-pressed={pressed}
                aria-current={isToday ? "date" : undefined}
                aria-label={t(day.potential ? "mini.offersPotential" : "mini.offers", {
                  date: day.date,
                  state,
                  count: day.offers,
                })}
                onClick={() => onSelect(pressed ? null : day.date)}
                className={`relative grid min-h-9 w-full place-items-center rounded-md border text-sm font-semibold tabular-nums enabled:hover:ring-2 enabled:hover:ring-navy/30 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:min-h-11 ${day.assigned ? ASSIGNED_STYLE : DAY_STYLE[day.state]} ${pressed ? "ring-2 ring-navy" : isToday ? "ring-2 ring-accent" : ""}`}
              >
                {Number(day.date.slice(-2))}
                {day.offers > 0 && (
                  <span
                    aria-hidden
                    className="absolute top-1 right-1 size-1.5 rounded-full bg-danger"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ol>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {LEGEND.map((state) => (
          <li key={state} className="flex items-center gap-1.5">
            <span aria-hidden className={`size-3 rounded-sm border ${DAY_STYLE[state]}`} />
            {t(`day.${state}`)}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden className={`size-3 rounded-sm border ${ASSIGNED_STYLE}`} />
          {t("assignedDay")}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-danger" />
          {t("mini.legendOffers")}
        </li>
      </ul>
      <p className="mt-2 text-xs text-muted">{t("mini.note")}</p>
    </div>
  );
}
