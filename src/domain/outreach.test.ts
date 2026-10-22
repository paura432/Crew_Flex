import { describe, expect, it } from "vitest";
import {
  canDistributeOutreach,
  isIanaTimeZone,
  isOutreachUrgency,
  isValidQuietHours,
  OUTREACH_CONFLICTS,
} from "./outreach";

const NOW = Date.parse("2026-10-23T08:00:00.000Z");
const need = (over: Partial<Parameters<typeof canDistributeOutreach>[0]> = {}) => ({
  status: "open" as const,
  urgency: "aog" as const,
  startsAt: "2026-10-25T06:00:00.000Z",
  ...over,
});

describe("outreach domain (BR-26)", () => {
  it("distributes the declared urgency only: urgent and AOG, never planned (C-8)", () => {
    expect(isOutreachUrgency("urgent")).toBe(true);
    expect(isOutreachUrgency("aog")).toBe(true);
    expect(isOutreachUrgency("planned")).toBe(false);
  });

  it("offers the button on an open, not started, not yet distributed Urgent/AOG need only", () => {
    expect(canDistributeOutreach(need(), false, NOW)).toBe(true);
    expect(canDistributeOutreach(need({ urgency: "urgent" }), false, NOW)).toBe(true);
    expect(canDistributeOutreach(need(), true, NOW)).toBe(false);
    expect(canDistributeOutreach(need({ urgency: "planned" }), false, NOW)).toBe(false);
    for (const status of ["draft", "paused", "covered", "closed"] as const) {
      expect(canDistributeOutreach(need({ status }), false, NOW), status).toBe(false);
    }
    expect(canDistributeOutreach(need({ startsAt: "2026-10-23T08:00:00.000Z" }), false, NOW)).toBe(
      false,
    );
  });

  it("keeps the SQLSTATE order CFO01…CFO04", () => {
    expect(OUTREACH_CONFLICTS).toEqual([
      "OUTREACH_NOT_OPEN",
      "OUTREACH_PLANNED",
      "OUTREACH_ALREADY_SENT",
      "OUTREACH_STARTED",
    ]);
  });

  it("accepts IANA names the runtime knows, never offsets, POSIX strings or junk (v1.8 `localDay`)", () => {
    for (const zone of [
      "Europe/Madrid",
      "Europe/Lisbon",
      "UTC",
      "America/Argentina/Buenos_Aires",
    ]) {
      expect(isIanaTimeZone(zone), zone).toBe(true);
    }
    for (const zone of ["", "Mars/Olympus", "+01:00", "UTC+3", "Europe/Madrid ", "x".repeat(65)]) {
      expect(isIanaTimeZone(zone), zone).toBe(false);
    }
  });

  it("v1.8 «Horas de silencio no válidas.»: both or neither, HH:MM, never the same time", () => {
    expect(isValidQuietHours(null, null)).toBe(true);
    expect(isValidQuietHours("22:00", "07:00")).toBe(true);
    expect(isValidQuietHours("09:00", "17:30")).toBe(true);
    expect(isValidQuietHours("22:00", null)).toBe(false);
    expect(isValidQuietHours(null, "07:00")).toBe(false);
    expect(isValidQuietHours("22:00", "22:00")).toBe(false);
    expect(isValidQuietHours("24:00", "07:00")).toBe(false);
    expect(isValidQuietHours("7:00", "08:00")).toBe(false);
  });
});
