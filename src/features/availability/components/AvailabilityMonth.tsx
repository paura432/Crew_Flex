import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { formatMonth } from "@/i18n/format";
import {
  calendarDays,
  DAY_STYLE,
  monthOffset,
  shiftMonth,
  WEEKDAYS,
  type CalendarWindow,
  type DayState,
} from "../calendar";

const LEGEND: DayState[] = ["available", "aog_only", "unavailable", "mixed", "none"];

/**
 * Read-only month of the professional's own availability (V1.8 TechnicianHome mini calendar):
 * day states with BR-4.8 precedence, today marked, month navigation by link. Editing stays on the
 * availability page.
 */
export async function AvailabilityMonth({
  windows,
  month,
  today,
  hrefFor,
}: {
  windows: CalendarWindow[];
  month: string;
  today: string;
  hrefFor: (month: string) => string;
}) {
  const [t, locale] = await Promise.all([getTranslations("availability"), getLocale()]);
  const days = calendarDays(windows, month);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-semibold first-letter:uppercase" aria-live="polite">
          {formatMonth(locale, `${month}-01T00:00:00Z`)}
        </p>
        <div className="flex gap-1">
          <Link
            href={hrefFor(shiftMonth(month, -1))}
            aria-label={t("prevMonth")}
            className="grid size-9 place-items-center rounded-lg border border-line hover:bg-canvas pointer-coarse:size-11"
          >
            ←
          </Link>
          <Link
            href={hrefFor(shiftMonth(month, 1))}
            aria-label={t("nextMonth")}
            className="grid size-9 place-items-center rounded-lg border border-line hover:bg-canvas pointer-coarse:size-11"
          >
            →
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted uppercase">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {t(`weekday.${d}`)}
          </div>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1" aria-label={t("calendarLabel")}>
        {Array.from({ length: monthOffset(month) }, (_, i) => (
          <li key={`pad-${i}`} aria-hidden />
        ))}
        {days.map((day) => (
          <li
            key={day.date}
            aria-label={`${day.date}: ${t(`day.${day.state}`)}`}
            aria-current={day.date === today ? "date" : undefined}
            className={`grid min-h-9 place-items-center rounded-md border text-sm font-semibold tabular-nums ${DAY_STYLE[day.state]} ${day.date === today ? "ring-2 ring-accent" : ""} ${day.date < today ? "opacity-60" : ""}`}
          >
            {Number(day.date.slice(-2))}
          </li>
        ))}
      </ol>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {LEGEND.map((state) => (
          <li key={state} className="flex items-center gap-1.5">
            <span aria-hidden className={`size-3 rounded-sm border ${DAY_STYLE[state]}`} />
            {t(`day.${state}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
