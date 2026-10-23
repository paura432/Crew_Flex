import { describe, expect, it } from "vitest";
import type { Opportunity } from "@/types/api";
import { HOME_FEED, homeFeed, homeOpportunities, miniCalendar } from "./home";

const opportunity = (id: string, startsAt: string, endsAt: string, eligible = true) =>
  ({
    requirement: {
      id,
      organizationName: "Demo MRO Madrid",
      title: `Need ${id}`,
      location: "Madrid (MAD)",
      startsAt,
      endsAt,
      shift: "day",
      headcount: 1,
      urgency: "planned",
      createdAt: "2026-10-01T00:00:00.000Z",
      qualifications: [
        { qualificationTypeId: "q1", code: "B1.1", name: "Part-66 B1.1", level: "hard" },
        { qualificationTypeId: "q2", code: "HF", name: "Human factors", level: "soft" },
      ],
    },
    match: { eligible },
    myApplication: null,
    applyBlocker: eligible ? null : "NOT_ELIGIBLE",
    possibleOnRest: !eligible,
  }) as unknown as Opportunity;

const TODAY = "2026-10-22";
// Own windows: 27 Oct available, 28 Oct blocked; 29 Oct has no window (rest).
const windows = [
  {
    id: "a",
    startsAt: "2026-10-27T00:00:00Z",
    endsAt: "2026-10-28T00:00:00Z",
    status: "available" as const,
  },
  {
    id: "u",
    startsAt: "2026-10-28T00:00:00Z",
    endsAt: "2026-10-29T00:00:00Z",
    status: "unavailable" as const,
  },
];

describe("homeOpportunities (N-03 / N-17 day → opportunities map)", () => {
  const rows = homeOpportunities(
    [opportunity("c", "2026-10-27T06:00:00Z", "2026-10-27T18:00:00Z")],
    [
      opportunity("p", "2026-10-27T06:00:00Z", "2026-10-30T06:00:00Z", false),
      opportunity("c", "2026-10-27T06:00:00Z", "2026-10-27T18:00:00Z", false), // already listed
    ],
    windows,
    TODAY,
  );

  it("compatible first, possible-on-rest after, each once; base and licence (hard codes) kept", () => {
    expect(rows.map((r) => [r.id, r.published])).toEqual([
      ["c", true],
      ["p", false],
    ]);
    expect(rows[0]).toMatchObject({ location: "Madrid (MAD)", licences: ["B1.1"] });
    // v1.8 «{tarifa} / h» only when the need states one (T-62 informative conditions).
    expect(rows.map((r) => r.hourlyRate)).toEqual([null, null]);
    expect(
      homeOpportunities(
        [
          {
            ...opportunity("r", "2026-10-27T06:00:00Z", "2026-10-27T18:00:00Z"),
            requirement: {
              ...opportunity("r", "2026-10-27T06:00:00Z", "2026-10-27T18:00:00Z").requirement,
              conditions: { hourlyRate: 52 },
            },
          } as Opportunity,
        ],
        [],
        windows,
        TODAY,
      )[0]!.hourlyRate,
    ).toBe(52);
  });

  it("a compatible need marks every day; a possible one only its rest days (no window) from today", () => {
    expect(rows[0]!.days).toEqual(["2026-10-27"]);
    // 27 is published, 28 blocked: only 29 and 30 would need publishing.
    expect(rows[1]!.days).toEqual(["2026-10-29", "2026-10-30"]);
    expect(rows[1]!.month).toBe("2026-10");
    const started = homeOpportunities(
      [opportunity("s", "2026-10-20T00:00:00Z", "2026-11-02T00:00:00Z")],
      [],
      [],
      TODAY,
    );
    expect(started[0]!.days[0]).toBe(TODAY); // past days never get a dot
    expect(started[0]!.days.at(-1)).toBe("2026-11-01"); // end exclusive
  });

  it("the mini calendar counts the dots, flags the possible ones and the assigned days", () => {
    const days = Object.fromEntries(
      miniCalendar(windows, "2026-10", new Set(["2026-10-24"]), rows).map((d) => [d.date, d]),
    );
    expect(days["2026-10-27"]).toMatchObject({ state: "available", offers: 1, potential: false });
    expect(days["2026-10-29"]).toMatchObject({ state: "none", offers: 1, potential: true });
    expect(days["2026-10-28"]).toMatchObject({ state: "unavailable", offers: 0 });
    expect(days["2026-10-24"]).toMatchObject({ assigned: true, offers: 0 });
    expect(days["2026-10-23"]!.assigned).toBe(false);
  });
});

describe("homeFeed (v1.8 TechnicianHome: selected day, else compatible, else possible)", () => {
  const row = (id: string, published: boolean, days: string[]) => ({ id, published, days });

  it("a selected day lists both kinds on that day", () => {
    const rows = [row("c", true, ["2026-10-27"]), row("p", false, ["2026-10-27", "2026-10-29"])];
    expect(homeFeed(rows, "2026-10-27").map((r) => r.id)).toEqual(["c", "p"]);
    expect(homeFeed(rows, "2026-10-29").map((r) => r.id)).toEqual(["p"]);
    expect(homeFeed(rows, "2026-10-30")).toEqual([]);
  });

  it("without a day: the compatible ones; the possible ones only when there is none", () => {
    expect(homeFeed([row("c", true, []), row("p", false, [])], null).map((r) => r.id)).toEqual([
      "c",
    ]);
    expect(homeFeed([row("p", false, [])], null).map((r) => r.id)).toEqual(["p"]);
  });

  it("five rows at most", () => {
    const many = Array.from({ length: 8 }, (_, i) => row(String(i), true, []));
    expect(homeFeed(many, null)).toHaveLength(HOME_FEED);
    expect(HOME_FEED).toBe(5);
  });
});
