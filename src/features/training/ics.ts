// v1.9 «Exportar sesiones .ics» (V19-030): the caller's confirmed training sessions as an RFC 5545 file. Pure.
// ponytail: no 75-octet line folding (v1.9 does not fold either); calendar apps read long lines. Fold if one refuses.
import type { TrainingCommitment } from "@/types/api";

const text = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/[;,]/g, "\\$&");
const utc = (iso: string) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

export function sessionsIcs(sessions: readonly TrainingCommitment[], now: string): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CrewFlex//Formacion//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...sessions.flatMap((s) => {
      const where = s.location ?? s.city;
      return [
        "BEGIN:VEVENT",
        `UID:${s.sessionId}@training.crewflex.invalid`,
        `DTSTAMP:${utc(now)}`,
        `DTSTART:${utc(s.startsAt)}`,
        `DTEND:${utc(s.endsAt)}`,
        `SUMMARY:${text(s.courseTitle)}`,
        ...(where ? [`LOCATION:${text(where)}`] : []),
        "CLASS:PRIVATE",
        "END:VEVENT",
      ];
    }),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
