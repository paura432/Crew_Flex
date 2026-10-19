import { describe, expect, it } from "vitest";
import { calendarDays, countDays, dayWindow, monthDays, monthOffset, shiftMonth } from "./calendar";

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
