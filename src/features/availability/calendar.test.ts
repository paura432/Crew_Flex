import { describe, expect, it } from "vitest";
import {
  calendarDays,
  countDays,
  dayWindow,
  isDayEditable,
  monthDays,
  monthOffset,
  parseMonth,
  refusesPastStart,
  shiftMonth,
} from "./calendar";

const w = (id: string, startsAt: string, endsAt: string, status: "available" | "unavailable") => ({
  id,
  startsAt,
  endsAt,
  status,
});

describe("month helpers", () => {
  it("lists days, weekday offset and month navigation", () => {
    expect(monthDays("2026-10")).toHaveLength(31);
    expect(monthDays("2026-02")).toHaveLength(28);
    expect(monthOffset("2026-10")).toBe(3); // 1 Oct 2026 is a Thursday
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("builds whole-day UTC windows", () => {
    expect(dayWindow("2026-10-18")).toEqual({
      startsAt: "2026-10-18T00:00:00.000Z",
      endsAt: "2026-10-19T00:00:00.000Z",
    });
  });
});

describe("isDayEditable", () => {
  it("freezes past days and leaves today and later editable (UTC dates)", () => {
    expect(isDayEditable("2026-10-20", "2026-10-21")).toBe(false); // yesterday
    expect(isDayEditable("2026-10-21", "2026-10-21")).toBe(true); // today
    expect(isDayEditable("2026-10-22", "2026-10-21")).toBe(true); // tomorrow
    expect(isDayEditable("2025-12-31", "2026-01-01")).toBe(false); // across a year boundary
  });
});

describe("calendarDays", () => {
  const windows = [
    w("a", "2026-10-10T00:00:00Z", "2026-10-15T00:00:00Z", "available"),
    w("u", "2026-10-12T00:00:00Z", "2026-10-13T00:00:00Z", "unavailable"),
    w("p", "2026-10-20T08:00:00Z", "2026-10-20T16:00:00Z", "available"),
    w("s", "2026-10-25T00:00:00Z", "2026-10-26T00:00:00Z", "available"),
  ];
  const days = Object.fromEntries(calendarDays(windows, "2026-10").map((d) => [d.date, d]));

  it("marks fully available, unavailable-overridden, partial and empty days", () => {
    expect(days["2026-10-10"]!.state).toBe("available");
    expect(days["2026-10-12"]!.state).toBe("unavailable"); // BR-4.2 override
    expect(days["2026-10-20"]!.state).toBe("mixed"); // 8h window only
    expect(days["2026-10-01"]!.state).toBe("none");
    expect(days["2026-10-15"]!.state).toBe("none"); // end is exclusive
  });

  it("only exposes a toggleable window when exactly one single-day window covers the day", () => {
    expect(days["2026-10-25"]!.singleDayWindow?.id).toBe("s");
    expect(days["2026-10-11"]!.singleDayWindow).toBeNull(); // covered by a 5-day window
    expect(days["2026-10-12"]!.windows.map((x) => x.id).sort()).toEqual(["a", "u"]);
  });

  it("counts days per state over a range", () => {
    expect(countDays(windows, "available", "2026-10-01", "2026-11-01")).toBe(5); // 10,11,13,14,25
    expect(countDays(windows, "unavailable", "2026-10-01", "2026-11-01")).toBe(1);
  });
});

describe("aog_only day state (BR-4.8 display precedence)", () => {
  const day = (
    d: string,
    status: "available" | "unavailable" | "aog_only",
    from = "00:00",
    to = "24:00",
  ) => ({
    id: `${d}-${status}-${from}`,
    startsAt: `${d}T${from}:00Z`,
    endsAt:
      to === "24:00"
        ? new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString()
        : `${d}T${to}:00Z`,
    status,
  });
  const stateOf = (windows: ReturnType<typeof day>[]) =>
    calendarDays(windows, "2026-11").find((x) => x.date === "2026-11-10")!.state;

  it("a whole aog_only day is 'aog_only'; unavailable still wins; partial aog is mixed", () => {
    expect(stateOf([day("2026-11-10", "aog_only")])).toBe("aog_only");
    expect(stateOf([day("2026-11-10", "available"), day("2026-11-10", "aog_only")])).toBe(
      "aog_only",
    );
    expect(stateOf([day("2026-11-10", "aog_only"), day("2026-11-10", "unavailable")])).toBe(
      "unavailable",
    );
    expect(
      stateOf([day("2026-11-10", "available"), day("2026-11-10", "aog_only", "08:00", "12:00")]),
    ).toBe("mixed");
  });
});

describe("parseMonth", () => {
  it.each([
    ["2026-10", "2026-10"],
    ["2026-13", null],
    ["2026-1", null],
    ["2026-10-01", null],
    [undefined, null],
  ])("%s → %s", (input, expected) => {
    expect(parseMonth(input)).toBe(expected);
  });
});

describe("refusesPastStart (X-19, form only)", () => {
  const today = "2026-10-22";
  it("a new window may not start on a past day; today and later are fine", () => {
    expect(refusesPastStart("2026-10-21T23:59", null, today)).toBe(true);
    expect(refusesPastStart("2026-10-22T00:00", null, today)).toBe(false);
  });
  it("an ongoing window keeps its past start when only the end or status changes", () => {
    expect(refusesPastStart("2026-10-01T08:00", "2026-10-01T08:00", today)).toBe(false);
    expect(refusesPastStart("2026-10-02T08:00", "2026-10-01T08:00", today)).toBe(true);
  });
});
