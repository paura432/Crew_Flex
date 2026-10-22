import { describe, expect, it } from "vitest";
import {
  isFutureLogbookDate,
  isValidLogbookHours,
  LOGBOOK_AIRCRAFT_SUGGESTIONS,
  LOGBOOK_CATEGORIES,
  LOGBOOK_ENVIRONMENTS,
  logbookToday,
} from "./logbook";

describe("logbook (BR-17)", () => {
  it("keeps the v1.8 option lists in their order (first = default)", () => {
    expect(LOGBOOK_CATEGORIES).toHaveLength(6);
    expect(LOGBOOK_CATEGORIES[0]).toBe("defect_rectification");
    expect(LOGBOOK_ENVIRONMENTS).toHaveLength(5);
    expect(LOGBOOK_ENVIRONMENTS[0]).toBe("line_maintenance");
    expect(LOGBOOK_AIRCRAFT_SUGGESTIONS).toHaveLength(12);
    expect(LOGBOOK_AIRCRAFT_SUGGESTIONS[0]).toBe("A320 Family");
  });

  it("«today» is the Madrid calendar day, not the UTC one (T-19)", () => {
    // 22:30 UTC on 22 Oct = 00:30 CEST on 23 Oct.
    expect(logbookToday(new Date("2026-10-22T22:30:00Z"))).toBe("2026-10-23");
    // Winter time (CET, UTC+1): 23:30 UTC on 31 Dec is already New Year in Madrid.
    expect(logbookToday(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    expect(logbookToday(new Date("2026-10-22T10:00:00Z"))).toBe("2026-10-22");
  });

  it("refuses only dates after today in Madrid", () => {
    const now = new Date("2026-10-22T22:30:00Z"); // 23 Oct in Madrid
    expect(isFutureLogbookDate("2026-10-23", now)).toBe(false);
    expect(isFutureLogbookDate("2026-10-22", now)).toBe(false);
    expect(isFutureLogbookDate("2026-10-24", now)).toBe(true);
  });

  it("hours: 0–24 in steps of 0.1", () => {
    for (const ok of [0, 0.1, 1.5, 3.5, 23.9, 24])
      expect(isValidLogbookHours(ok), `${ok}`).toBe(true);
    for (const bad of [-0.1, 24.1, 1.25, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isValidLogbookHours(bad), `${bad}`).toBe(false);
    }
    expect(isValidLogbookHours(0.1 + 0.2)).toBe(true); // 0.30000000000000004 is still 0.3
  });
});
