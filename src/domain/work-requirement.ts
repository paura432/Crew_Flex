import { EU_COUNTRIES, type EuCountry } from "./organization.ts";
import type { RepresentationStatus } from "./recruiter.ts";
import {
  LICENCE_CATEGORIES,
  type Aircraft,
  type Engine,
  type ProfessionalCategory,
  type Skill,
} from "./passport.ts";

export const SHIFTS = ["day", "night", "split", "flexible"] as const;
export type Shift = (typeof SHIFTS)[number];

export const URGENCIES = ["planned", "urgent", "aog"] as const;
export type Urgency = (typeof URGENCIES)[number];

// `cancelled` is a legacy value no transition reaches any more (M05, T-14); `paused` is v1.8's «Pausada».
export const REQUIREMENT_STATUSES = [
  "draft",
  "open",
  "paused",
  "covered",
  "cancelled",
  "closed",
] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const REQUIREMENT_LEVELS = ["hard", "soft"] as const;
export type RequirementLevel = (typeof REQUIREMENT_LEVELS)[number];

export const HEADCOUNT_MAX = 50;
export const MAX_REQUIREMENT_DAYS = 366;

/**
 * The job's country (v1.8 `server/rules.mjs:1`, OD-6/D-04 default T-61): the 27 EU members, ISO 3166-1 alpha-2.
 * Mirrored by the CHECK `work_requirements_country_eu` (PGlite suite requirement-builder compares both).
 */
// One list for the organization's country (admin-org, T-51) and the job's country: re-exported, not copied.
export { EU_COUNTRIES, type EuCountry };
export const DEFAULT_COUNTRY: EuCountry = "ES";

/**
 * The base's IANA zone (v1.8 connected «Zona IANA de la base», default Europe/Madrid; T-61): the EU members'
 * zones and UTC, a fixed list both the browser (Intl) and PostgreSQL know. It only tells local dates apart (one
 * shift per local start date); every instant is still stored and shown in UTC (BR-10). Mirrored by the CHECK
 * `work_requirements_timezone_known`.
 */
export const REQUIREMENT_TIME_ZONES = [
  "UTC",
  "Europe/Vienna",
  "Europe/Brussels",
  "Europe/Sofia",
  "Europe/Zagreb",
  "Asia/Nicosia",
  "Europe/Prague",
  "Europe/Copenhagen",
  "Europe/Tallinn",
  "Europe/Helsinki",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Athens",
  "Europe/Budapest",
  "Europe/Dublin",
  "Europe/Rome",
  "Europe/Riga",
  "Europe/Vilnius",
  "Europe/Luxembourg",
  "Europe/Malta",
  "Europe/Amsterdam",
  "Europe/Warsaw",
  "Europe/Lisbon",
  "Atlantic/Madeira",
  "Atlantic/Azores",
  "Europe/Bucharest",
  "Europe/Bratislava",
  "Europe/Ljubljana",
  "Europe/Madrid",
  "Atlantic/Canary",
  "Africa/Ceuta",
  "Europe/Stockholm",
] as const;
export type RequirementTimeZone = (typeof REQUIREMENT_TIME_ZONES)[number];
export const DEFAULT_TIME_ZONE: RequirementTimeZone = "Europe/Madrid";

/** v1.8 «Contrato»: Contractor · Temporal · Permanente · Por proyecto (Company2.jsx:114). */
export const CONTRACT_TYPES = ["contractor", "temporary", "permanent", "project"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

/** v1.8 connected `validateJob` (server/rules.mjs:7): at most 366 shifts of at most 24 h each. */
export const MAX_SHIFTS = 366;
export const BASE_HOURS_MIN = 0.25;
export const BASE_HOURS_MAX = 24;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** One shift of a requirement (v1.8 ShiftEditor): UTC instants and the base hours paid for it. */
export interface RequirementShift {
  startsAt: string;
  endsAt: string;
  baseHours: number;
}

/**
 * Informative terms of a requirement (v1.8 demo `Company2.jsx:114-125`, `Marketplace.jsx:11-44`; T-62). Money is
 * EUR and only displayed: no fee, commission, invoice or payment exists (OD-7, SCOPE OUT). Every key is optional
 * (absent = not stated). `budgetMandatory` is declared by the organization and not evaluated by the engine yet
 * (C-10, v2-11).
 */
export interface RequirementConditions {
  /** EUR per hour, (0, 2000]. */
  hourlyRate?: number;
  /** EUR per overtime hour, [0, 2000]. */
  overtimeRate?: number;
  /** EUR per day, [0, 2000]. */
  perDiem?: number;
  /** Hours of one working day, [0.25, 24] (v1.8 «Horas por turno»); the day rate is hourlyRate × shiftHours. */
  shiftHours?: number;
  contractType?: ContractType;
  /** v1.8 «Tratar presupuesto como requisito obligatorio». */
  budgetMandatory?: boolean;
  /** v1.8 «Movilización máxima (horas)», integer 1–168. */
  maxMobilizationHours?: number;
  /** v1.8 «Incorporación», 1–160 characters. */
  arrival?: string;
  flights?: boolean;
  accommodation?: boolean;
  localTransport?: boolean;
  meals?: boolean;
  ownTools?: boolean;
}

export interface RequiredQualification {
  qualificationTypeId: string;
  code: string;
  name: string;
  level: RequirementLevel;
}

/**
 * v1.8 profile requirements of a need (`server/rules.mjs:27` connected `eligible`, `src/business.js:140-150`
 * demo `matching`; C-10/D-02/D-03/OD-6 defaults T-80…T-86, BUSINESS_RULES BR-3.7–3.13), checked against the
 * professional's own passport declarations (BR-18). Every field is optional and «not required» when absent,
 * null or empty, so a requirement that states none keeps exactly its qualification + availability verdict.
 * Columns of `work_requirements` (`country` from the builder, 20261023600000; the rest 20261023900000), same
 * names as v1.8.
 */
export interface RequirementProfileRules {
  /** Country of the job (builder, T-61): the professional must declare a work permit for it (BR-3.7). */
  country?: EuCountry | null;
  /** The professional must declare this category (v1.8 `job.category`). */
  category?: ProfessionalCategory | null;
  /** «Aeronaves aceptadas»: the professional must declare at least one (v1.8 demo `aircraft.some`). */
  aircraft?: Aircraft[];
  /**
   * «Exigir habilitación de tipo»: a declared type rating of `category` on one of `aircraft`, valid for the
   * whole period (BR-2) and without restrictions (v1.8 `requiresLicense` / `requireType`).
   */
  requiresTypeRating?: boolean;
  /** «Motores»: at least one declared (v1.8 demo `engines.some`). */
  engines?: Engine[];
  /** «Experiencia mínima (años)», 0–60; an undeclared experience counts as 0 (v1.8 `profile.years||0`). */
  minYears?: number | null;
  /** «Capacidades obligatorias»: every one declared (v1.8 `requiredSkills` / `hardSkills`). */
  requiredSkills?: Skill[];
}

export interface WorkRequirement extends RequirementProfileRules {
  id: string;
  organizationId: string;
  title: string;
  location: string;
  startsAt: string;
  endsAt: string;
  shift: Shift;
  headcount: number;
  urgency: Urgency;
  status: RequirementStatus;
  createdAt: string;
  /**
   * Optimistic version for the edit (`work-requirements` PUT `expectedUpdatedAt`, ms precision; M05).
   * Optional: absent from functions older than the edit and from hand-built fixtures.
   */
  updatedAt?: string;
  qualifications: RequiredQualification[];
  // Terms of the requirement builder (LOCAL `20261023600000`). Optional: absent from functions older than it;
  // null = not stated (every requirement created before it).
  country?: EuCountry | null;
  timeZone?: RequirementTimeZone | null;
  description?: string | null;
  /** Sorted shifts; the period is their envelope. null = one continuous period. */
  shifts?: RequirementShift[] | null;
  conditions?: RequirementConditions | null;
  /** v1.8 «Archivada» (T-64): set once, on a closed requirement. */
  archivedAt?: string | null;
  /**
   * Recruiter (D-12 provisional, LOCAL `20261024500100`, BR-27): the represented client a staffing agency publishes
   * for, as the agency's members read it. Optional: absent from older functions; null = no client.
   */
  client?: RequirementClient | null;
}

/** The represented client of a requirement (never its contact e-mail here). */
export interface RequirementClient {
  id: string;
  name: string;
  status: RepresentationStatus;
}

/**
 * V1.8 «Vencida» (`business.js` `effectiveStatus`): an open requirement whose period has ended (BR-10:
 * UTC instants). Display only — derived at read time, never stored, never a transition; closing stays
 * an explicit action (BR-1.9).
 */
export const isExpired = (r: Pick<WorkRequirement, "status" | "endsAt">, nowMs: number) =>
  r.status === "open" && Date.parse(r.endsAt) <= nowMs;

/**
 * Status changes allowed on a requirement (M05, owner 2026-10-22; BR-1.9): open ↔ paused, a draft is
 * opened, anything not closed may be closed; `closed` is terminal. `covered` comes and goes with
 * confirmed applications only (D-06). Mirrored by `guard_requirement_status` (rls suite S).
 */
export function canChangeRequirementStatus(from: RequirementStatus, to: RequirementStatus) {
  if (from === "closed" || from === to) return false;
  return (
    to === "closed" ||
    (from === "open" && to === "paused") ||
    (from === "paused" && to === "open") ||
    (from === "draft" && to === "open")
  );
}

/**
 * V1.8 evaluates and publishes `published` jobs only: drafts (R-D4, T-63), paused and closed needs have no
 * candidate pool.
 */
export const isEvaluable = (r: Pick<WorkRequirement, "status">) =>
  r.status !== "draft" && r.status !== "paused" && r.status !== "closed";

/** v1.8 «Archivar» (T-64): one way, for a closed requirement or a draft (archiving a draft also closes it). */
export const canArchive = (r: Pick<WorkRequirement, "status"> & { archivedAt?: string | null }) =>
  !r.archivedAt && (r.status === "closed" || r.status === "draft");

// --- Shifts (v2-09, v1.8 connected ShiftEditor; T-60) ---------------------------------------------

/** `YYYY-MM-DD` of an instant in an IANA zone (v1.8 `localDay`). */
export function localDate(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export const sortShifts = <T extends Pick<RequirementShift, "startsAt" | "endsAt">>(
  shifts: readonly T[],
): T[] =>
  [...shifts].sort(
    (a, b) =>
      Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
      Date.parse(a.endsAt) - Date.parse(b.endsAt),
  );

export type ShiftIssue =
  "endBeforeStart" | "tooLong" | "hours" | "hoursExceed" | "overlap" | "sameLocalDay" | "tooMany";

/**
 * Why a list of shifts is not valid (v1.8 `validateJob`, server/rules.mjs:7): at most 366; each ends after it
 * starts, lasts ≤ 24 h («Divide los trabajos de varios días en jornadas de hasta 24 horas.») and pays 0.25–24 base
 * hours, never more than it lasts («Las horas base superan la duración del intervalo.»); sorted by start they do
 * not overlap («Las jornadas no pueden solaparse.», touching is fine) and start on different local dates of the
 * zone («Solo se admite una jornada por fecha local de inicio.»). `index` refers to the SORTED list (-1 = the
 * whole list). The same rules as `app_private.requirement_shifts_valid` (PGlite parity suite).
 */
export function shiftIssues(
  shifts: readonly RequirementShift[],
  timeZone: string | null | undefined,
): { index: number; issue: ShiftIssue }[] {
  const issues: { index: number; issue: ShiftIssue }[] = [];
  if (shifts.length > MAX_SHIFTS) issues.push({ index: -1, issue: "tooMany" });
  let previousEnd: number | undefined;
  let previousDay: string | undefined;
  sortShifts(shifts).forEach((shift, index) => {
    const start = Date.parse(shift.startsAt);
    const end = Date.parse(shift.endsAt);
    if (!(end > start)) issues.push({ index, issue: "endBeforeStart" });
    else if (end - start > DAY_MS) issues.push({ index, issue: "tooLong" });
    else if (shift.baseHours * HOUR_MS > end - start) issues.push({ index, issue: "hoursExceed" });
    if (!(shift.baseHours >= BASE_HOURS_MIN && shift.baseHours <= BASE_HOURS_MAX))
      issues.push({ index, issue: "hours" });
    const day = localDate(shift.startsAt, timeZone ?? "UTC");
    if (previousEnd !== undefined) {
      if (start < previousEnd) issues.push({ index, issue: "overlap" });
      else if (day === previousDay) issues.push({ index, issue: "sameLocalDay" });
    }
    previousEnd = end;
    previousDay = day;
  });
  return issues;
}

/** The period a list of shifts spans: first start → end of the last one (sorted by start). */
export function shiftEnvelope(
  shifts: readonly RequirementShift[],
): { startsAt: string; endsAt: string } | null {
  const sorted = sortShifts(shifts);
  const first = sorted[0];
  const last = sorted.at(-1);
  return first && last ? { startsAt: first.startsAt, endsAt: last.endsAt } : null;
}

/** v1.8 «{Σ} horas base en {n} jornadas», two decimals. */
export const totalBaseHours = (shifts: readonly Pick<RequirementShift, "baseHours">[]) =>
  Math.round(shifts.reduce((sum, s) => sum + s.baseHours, 0) * 100) / 100;

/** UTC calendar days a continuous period touches (its last instant is `endsAt − 1 ms`, as BR-2.4). */
export function periodDays(startsAt: string, endsAt: string): number {
  const first = Math.floor(Date.parse(startsAt) / DAY_MS);
  const last = Math.floor((Date.parse(endsAt) - 1) / DAY_MS);
  return Math.max(0, last - first + 1);
}

/**
 * v1.8 «{n} días» / «{n} jornadas» (`job.days.length`): the published shifts, or the UTC days of the continuous
 * period (D-06 Q6: one application = the whole period).
 */
export const requirementDays = (
  r: Pick<WorkRequirement, "startsAt" | "endsAt"> & { shifts?: readonly unknown[] | null },
) => r.shifts?.length || periodDays(r.startsAt, r.endsAt);

/** v1.8 «{n} jornadas requeridas» (days × people): `requirementDays` × headcount. */
export const requiredShiftDays = (
  r: Pick<WorkRequirement, "startsAt" | "endsAt" | "headcount"> & {
    shifts?: readonly RequirementShift[] | null;
  },
) => requirementDays(r) * r.headcount;

/** v1.8 «{tarifa × horas} / jornada de {h} h»: the day rate, when both are stated. */
export const dayRate = (conditions: RequirementConditions | null | undefined) =>
  conditions?.hourlyRate !== undefined && conditions.shiftHours !== undefined
    ? Math.round(conditions.hourlyRate * conditions.shiftHours * 100) / 100
    : null;

/**
 * v1.8 connected proposal «{h} h × {tarifa} €/h = {base} para el técnico» (app.mjs:118) without the commission
 * (OUT): base hours of the shifts × the hourly rate, when both exist. Informative only (OD-7).
 */
export function baseAmount(terms: {
  shifts?: readonly RequirementShift[] | null;
  conditions?: RequirementConditions | null;
}): { hours: number; hourlyRate: number; amount: number } | null {
  const rate = terms.conditions?.hourlyRate;
  if (!terms.shifts?.length || rate === undefined) return null;
  const hours = totalBaseHours(terms.shifts);
  return { hours, hourlyRate: rate, amount: Math.round(hours * rate * 100) / 100 };
}

// --- Duplicate (v2-14, v1.8 `duplicate`, Company2.jsx:140; T-65) ----------------------------------

/** v1.8 starts a copy 45 days from today. */
export const DUPLICATE_LEAD_DAYS = 45;

/**
 * The terms of a copy: «{prefix}{title}» (≤ 120 characters), the start moved to the same UTC time of day
 * `DUPLICATE_LEAD_DAYS` days from today, the end and every shift moved by the same amount (same duration and
 * pattern). Everything else is copied as it is; nothing frozen comes with it (v1.8 copied its pricingSnapshot,
 * hallazgo D1 #1). The copy is a new draft: nothing is saved until the organization saves it.
 */
export function duplicateSchedule<
  T extends Pick<WorkRequirement, "title" | "startsAt" | "endsAt"> & {
    shifts?: RequirementShift[] | null;
  },
>(source: T, nowMs: number, prefix: string): T {
  const start = Date.parse(source.startsAt);
  const timeOfDay = ((start % DAY_MS) + DAY_MS) % DAY_MS;
  const today = Math.floor(nowMs / DAY_MS) * DAY_MS;
  const delta = today + DUPLICATE_LEAD_DAYS * DAY_MS + timeOfDay - start;
  const move = (iso: string) => new Date(Date.parse(iso) + delta).toISOString();
  return {
    ...source,
    title: `${prefix}${source.title}`.slice(0, 120).trimEnd(),
    startsAt: move(source.startsAt),
    endsAt: move(source.endsAt),
    shifts: source.shifts
      ? source.shifts.map((s) => ({ ...s, startsAt: move(s.startsAt), endsAt: move(s.endsAt) }))
      : source.shifts,
  };
}

/**
 * T-83 (CHECK `work_requirements_type_rating_check`, ORG-03 #19): a type rating is asked for a licence category on at
 * least one accepted aircraft — v1.8 «Selecciona una aeronave si exiges habilitación de tipo.». One predicate for the
 * schema refinement and the form's pre-submit hint.
 */
export function typeRatingRuleIncomplete(rules: {
  requiresTypeRating?: boolean | null;
  category?: string | null;
  aircraft?: readonly string[] | null;
}): boolean {
  return (
    rules.requiresTypeRating === true &&
    !(
      rules.category != null &&
      (LICENCE_CATEGORIES as readonly string[]).includes(rules.category) &&
      (rules.aircraft?.length ?? 0) > 0
    )
  );
}
