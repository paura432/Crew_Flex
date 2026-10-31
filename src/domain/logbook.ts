// Personal logbook (M14, N-12; v1.8 `src/components/v11/Logbook2.jsx` + connected `server/app.mjs:140`,
// BUSINESS_RULES BR-17). Pure rules shared by the Next.js app and the `professional-logbook` Edge
// Function (Deno: relative imports only). The database re-checks every limit and the «no future
// date» rule (migration 20261023200000), so a direct PostgREST write cannot bypass them.
//
// A logbook entry is self-declared, private to its owner and never an official record (FD-25): no
// organization, manager or platform admin reads it. Only the owner's own act shares entries: applying
// copies the ones marked `cvRelevant` (and not archived) into that application's Candidate Pack copy
// (BR-25, T-112; `PACK_EXPERIENCE_MAX` in ./candidate-pack.ts).

/** v1.8 demo «Categoría de tarea» (first = default). Codes; labels live in the catalogs. */
export const LOGBOOK_CATEGORIES = [
  "defect_rectification",
  "inspection",
  "component_replacement",
  "troubleshooting",
  "sheet_metal_structures",
  "cabin_interiors",
] as const;
export type LogbookCategory = (typeof LOGBOOK_CATEGORIES)[number];

/** v1.8 demo «Entorno» (first = default). */
export const LOGBOOK_ENVIRONMENTS = [
  "line_maintenance",
  "base_maintenance",
  "engine_bay_check",
  "aog_intervention",
  "workshop",
] as const;
export type LogbookEnvironment = (typeof LOGBOOK_ENVIRONMENTS)[number];

/**
 * v1.8 `AIRCRAFT` (`src/business.js:8`), offered as suggestions only: the connected beta stores the
 * aircraft as free text (≤ 100), so a registration such as «A320 EC-QAA» stays possible (T-20).
 */
export const LOGBOOK_AIRCRAFT_SUGGESTIONS = [
  "A320 Family",
  "B737 NG",
  "B737 MAX",
  "ATR 72",
  "Embraer E-Jets",
  "A330",
  "A350",
  "B787",
  "EC135/145",
  "Cessna 172",
  "Piper PA-28",
  "Robinson R44",
] as const;

export const LOGBOOK_LIMITS = {
  aircraft: 100,
  ata: 10,
  description: 3000,
  /** Hours of one entry: 0–24 in steps of 0.1 (v1.8 connected `amount(hours, 0, 24)`, `step=0.1`). */
  hoursMax: 24,
} as const;

/**
 * «Today» for the logbook is the calendar day in Madrid, as the v1.8 server decides it
 * (`localDay('Europe/Madrid')`, T-19). The database uses the same zone.
 */
export const LOGBOOK_TIME_ZONE = "Europe/Madrid";

// sv-SE formats as ISO `YYYY-MM-DD`.
const LOGBOOK_DAY = new Intl.DateTimeFormat("sv-SE", {
  timeZone: LOGBOOK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `YYYY-MM-DD` of `now` in {@link LOGBOOK_TIME_ZONE}. */
export function logbookToday(now: Date = new Date()): string {
  return LOGBOOK_DAY.format(now);
}

/** «El logbook registra actividad realizada, no futura.» — a date after today (Madrid) is refused. */
export const isFutureLogbookDate = (date: string, now: Date = new Date()) =>
  date > logbookToday(now);

/** 0 ≤ hours ≤ 24 with at most one decimal (the 0.1 step of the form). */
export function isValidLogbookHours(hours: number): boolean {
  if (!Number.isFinite(hours) || hours < 0 || hours > LOGBOOK_LIMITS.hoursMax) return false;
  const tenths = hours * 10;
  return Math.abs(tenths - Math.round(tenths)) < 1e-9;
}
