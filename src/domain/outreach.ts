// «Distribuir aviso Urgente / AOG» and the professional's notice preferences (package outreach: v2 diff
// 30 v2-17 / ORG-06, 20 N-10 / TEC-07 #12–#17; SCOPE-2 LATER, local only; BUSINESS_RULES BR-26,
// technical defaults T-120…T-129). Pure: no I/O, no framework imports. Shared by Next.js and the Edge
// Functions. The audience itself is computed by the database in ONE function (`requirement_outreach`,
// migration 20261024400200): this module names its inputs, its conflicts and when the button is offered.
import type { Urgency, WorkRequirement } from "./work-requirement.ts";

/** v1.8 connected «Horas mínimas que necesitas para movilizarte» (0–720, `server/app.mjs:73`). */
export const MOBILIZATION_HOURS_MAX = 720;
/** v1.8 connected «Zona horaria IANA para avisos», default Europe/Madrid (`server/app.mjs:71`). */
export const DEFAULT_NOTICE_TIME_ZONE = "Europe/Madrid";
/** The column's bound (migration 20261024400100). */
export const TIME_ZONE_MAX = 64;
/** v1.8 «Silencio desde/hasta (opcional)»: `HH:MM`, 24 h (`server/app.mjs:71`). */
export const QUIET_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Urgencies that are distributed (C-8: the declared urgency, never deduced from the start date). */
export const OUTREACH_URGENCIES = ["urgent", "aog"] as const satisfies readonly Urgency[];
export type OutreachUrgency = (typeof OUTREACH_URGENCIES)[number];

export const isOutreachUrgency = (urgency: Urgency): urgency is OutreachUrgency =>
  (OUTREACH_URGENCIES as readonly Urgency[]).includes(urgency);

/**
 * Stable reasons of a refused distribution (409 `reason`). The SQL raises them as SQLSTATE `CFO01`… in
 * this order (`supabase/functions/_shared/errors.ts`), a family apart from `CFA..` and `CFV..`.
 */
export const OUTREACH_CONFLICTS = [
  "OUTREACH_NOT_OPEN", // CFO01: draft, paused, covered or closed (v1.8 «Publica o reanuda la oferta primero.»)
  "OUTREACH_PLANNED", // CFO02: a planned need is not distributed (the button is not offered)
  "OUTREACH_ALREADY_SENT", // CFO03: one distribution per requirement (T-125)
  "OUTREACH_STARTED", // CFO04: the period has started — nobody can apply any more
  "OUTREACH_DAILY_LIMIT", // CFO05: the organization distributed OUTREACH_DAILY_MAX needs in the last 24 h
] as const;
export type OutreachConflict = (typeof OUTREACH_CONFLICTS)[number];

/**
 * T-128 (security review MEDIUM-1): below this many professionals of the external pool eligible for the
 * need, the number of notices is not reported (`notified: null`) — with so few, it would tell the
 * organization who opted in, declared what mobilization or is asleep. The notices are still created.
 */
export const OUTREACH_REPORT_MIN = 5;
/** T-128: distributions per organization in any 24 h (bounds how often the count can be read). */
export const OUTREACH_DAILY_MAX = 10;

/** The professional's preferences as stored (T-120…T-123). */
export interface NoticePreferences {
  urgentOptIn: boolean;
  aogOptIn: boolean;
  /** Null = not declared: no outreach reaches them (v1.8 «Sin movilización declarada…»). */
  mobilizationHours: number | null;
  timeZone: string;
  /** `HH:MM` or null; both or neither. */
  quietStart: string | null;
  quietEnd: string | null;
}

/** What a professional who never saved the form has (v1.8 connected defaults: nothing opted in). */
export const DEFAULT_NOTICE_PREFERENCES: NoticePreferences = {
  urgentOptIn: false,
  aogOptIn: false,
  mobilizationHours: null,
  timeZone: DEFAULT_NOTICE_TIME_ZONE,
  quietStart: null,
  quietEnd: null,
};

const IANA_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+){0,2}$/;

/**
 * An IANA zone name the runtime knows («Europe/Madrid», «UTC»), as v1.8 `localDay` checks it with
 * `Intl.DateTimeFormat` (`server/rules.mjs:8`). The shape excludes offsets («+01:00», which newer
 * runtimes accept as a zone) and is the database CHECK's; the database also checks its own zone list.
 */
export function isIanaTimeZone(value: string): boolean {
  if (value.length === 0 || value.length > TIME_ZONE_MAX || !IANA_NAME.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * v1.8 «Horas de silencio no válidas.» (`server/app.mjs:71`): both or neither, `HH:MM`; also never the
 * same time (T-123: v1.8 read it as «silent all day»).
 */
export function isValidQuietHours(start: string | null, end: string | null): boolean {
  if (start === null && end === null) return true;
  if (start === null || end === null) return false;
  return QUIET_TIME_PATTERN.test(start) && QUIET_TIME_PATTERN.test(end) && start !== end;
}

/**
 * Whether «Distribuir aviso Urgente / AOG» is offered (v1.8 `Account.jsx:69`: only on a published
 * job): an urgent or AOG need that is open, has not started and was not distributed yet. The database
 * re-checks every condition (CFO01…CFO05).
 */
export function canDistributeOutreach(
  requirement: Pick<WorkRequirement, "status" | "urgency" | "startsAt">,
  distributed: boolean,
  now: number,
): boolean {
  return (
    !distributed &&
    isOutreachUrgency(requirement.urgency) &&
    requirement.status === "open" &&
    Date.parse(requirement.startsAt) > now
  );
}
