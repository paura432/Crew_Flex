import { describe, expect, it } from "vitest";
import type { TrainingCommitment } from "@/types/api";
import { sessionsIcs } from "./ics";

const session: TrainingCommitment = {
  requestId: "00000000-0000-4000-8000-0000000000a1",
  editionId: "00000000-0000-4000-8000-0000000000b1",
  sessionId: "00000000-0000-4000-8000-0000000000c1",
  courseTitle: "B1, A320; módulo\\práctico",
  providerName: "Academia",
  startsAt: "2026-11-02T08:30:00.000Z",
  endsAt: "2026-11-02T16:00:00.000Z",
  timeZone: "Europe/Madrid",
  location: "Hangar 3\nBarajas",
  element: "practical",
  mode: "onsite",
  city: "Madrid",
  status: "confirmed",
};

describe("sessionsIcs (V19-030)", () => {
  it("writes one private UTC event per session, escaped, with CRLF lines", () => {
    const ics = sessionsIcs(
      [session, { ...session, sessionId: "s2", location: null }],
      "2026-10-29T10:00:00.000Z",
    );
    expect(ics.split("\r\n")).toEqual([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CrewFlex//Formacion//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:00000000-0000-4000-8000-0000000000c1@training.crewflex.invalid",
      "DTSTAMP:20261029T100000Z",
      "DTSTART:20261102T083000Z",
      "DTEND:20261102T160000Z",
      "SUMMARY:B1\\, A320\\; módulo\\\\práctico",
      "LOCATION:Hangar 3\\nBarajas",
      "CLASS:PRIVATE",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:s2@training.crewflex.invalid",
      "DTSTAMP:20261029T100000Z",
      "DTSTART:20261102T083000Z",
      "DTEND:20261102T160000Z",
      "SUMMARY:B1\\, A320\\; módulo\\\\práctico",
      "LOCATION:Madrid",
      "CLASS:PRIVATE",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ]);
  });

  it("is a valid empty calendar without sessions", () => {
    expect(sessionsIcs([], "2026-10-29T10:00:00.000Z")).toContain(
      "METHOD:PUBLISH\r\nEND:VCALENDAR\r\n",
    );
  });
});
