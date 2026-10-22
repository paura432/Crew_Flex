// «Mi espacio» (v1.8 `TechnicianHome.jsx:15`, `ConnectedHome.jsx:15`, `homeModel.js:6-15`): the rows of
// «Oportunidades para ti» and the mini calendar's day → opportunities map. Pure, UTC days (BR-10); the
// eligibility itself always comes from the `opportunities` function (shared engine, BR-3).
import {
  assignmentDays,
  calendarDays,
  dayStart,
  type CalendarWindow,
  type DayState,
} from "@/features/availability/calendar";
import type { Opportunity } from "@/types/api";

/** Rows of the feed (v1.8: `slice(0,5)`). */
export const HOME_FEED = 5;

export interface HomeOpportunity {
  id: string;
  title: string;
  organizationName: string;
  location: string;
  /** Hard requirement codes (licence, type rating): v1.8 connected «{org} · {base} · {categoría}». */
  licences: string[];
  startsAt: string;
  endsAt: string;
  /** true = compatible now; false = «Posible en descanso» (BR-14.1). */
  published: boolean;
  /**
   * UTC days from today where it shows on the calendar: every day of a compatible one; only the rest
   * days (no window at all) of a possible one, the days the professional could publish (v1.8).
   */
  days: string[];
  /** `YYYY-MM` of its first such day: «Revisar fechas» opens the calendar on that month. */
  month: string;
}

const touched = (windows: readonly CalendarWindow[], date: string) => {
  const start = dayStart(date);
  return windows.some(
    (w) => Date.parse(w.startsAt) < start + 86_400_000 && Date.parse(w.endsAt) > start,
  );
};

/** Compatible opportunities first (in the function's order), then the possible-on-rest ones. */
export function homeOpportunities(
  compatible: readonly Opportunity[],
  possible: readonly Opportunity[],
  windows: readonly CalendarWindow[],
  today: string,
): HomeOpportunity[] {
  const seen = new Set<string>();
  const rows: HomeOpportunity[] = [];
  for (const [list, published] of [
    [compatible, true],
    [possible, false],
  ] as const) {
    for (const { requirement: r } of list) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const days = [...assignmentDays([r])].filter(
        (d) => d >= today && (published || !touched(windows, d)),
      );
      rows.push({
        id: r.id,
        title: r.title,
        organizationName: r.organizationName,
        location: r.location,
        licences: r.qualifications.filter((q) => q.level === "hard").map((q) => q.code),
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        published,
        days,
        month: (days[0] ?? r.startsAt).slice(0, 7),
      });
    }
  }
  return rows;
}

/**
 * The feed (v1.8 `TechnicianHome.jsx:9`): a selected day lists everything on it; otherwise the
 * compatible ones, or the possible-on-rest ones when there is no compatible one.
 */
export function homeFeed<T extends Pick<HomeOpportunity, "days" | "published">>(
  rows: readonly T[],
  selected: string | null,
  limit = HOME_FEED,
): T[] {
  const compatible = rows.filter((r) => r.published);
  const list = selected
    ? rows.filter((r) => r.days.includes(selected))
    : compatible.length > 0
      ? compatible
      : [...rows];
  return list.slice(0, limit);
}

export interface MiniDay {
  date: string;
  state: DayState;
  /** A day of a confirmed assignment (v1.8 «Asignado», BR-4.9). */
  assigned: boolean;
  /** Opportunities on this day (the red dot). */
  offers: number;
  /** At least one of them only needs the rest day published. */
  potential: boolean;
}

/** One month of the mini calendar: own state (BR-4.8 precedence), assignment and opportunities. */
export function miniCalendar(
  windows: CalendarWindow[],
  month: string,
  assigned: ReadonlySet<string>,
  rows: readonly Pick<HomeOpportunity, "days" | "published">[],
): MiniDay[] {
  return calendarDays(windows, month).map((day) => {
    const here = rows.filter((r) => r.days.includes(day.date));
    return {
      date: day.date,
      state: day.state,
      assigned: assigned.has(day.date),
      offers: here.length,
      potential: here.some((r) => !r.published),
    };
  });
}
