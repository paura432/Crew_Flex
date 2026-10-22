// The requirement builder's form state (v2 diff area 30: v2-09 shifts, v2-10 country, v2-12 terms, v2-13 summary,
// v2-14 drafts/autosave/duplicate). Pure: no React, no I/O. Inputs are kept as strings (what the controls hold);
// `draftToFields` turns them into the shared schema's payload, which validates everything (the form shows its
// issues, the server action and the Edge Function check it again).
import {
  type ContractType,
  DEFAULT_COUNTRY,
  DEFAULT_TIME_ZONE,
  type EuCountry,
  type RequirementConditions,
  type RequirementLevel,
  type RequirementShift,
  type RequirementTimeZone,
  type Shift,
  sortShifts,
  type Urgency,
  type WorkRequirement,
} from "@/domain/work-requirement";
import { toLocalInput, toUtcIso } from "@/lib/format";
import type { ZodError } from "@/lib/validation/zod";
import type { FieldErrors } from "@/lib/validation/errors";

export interface ConditionsDraft {
  hourlyRate: string;
  shiftHours: string;
  overtimeRate: string;
  perDiem: string;
  contractType: ContractType | "";
  maxMobilizationHours: string;
  arrival: string;
  budgetMandatory: boolean;
  flights: boolean;
  accommodation: boolean;
  localTransport: boolean;
  meals: boolean;
  ownTools: boolean;
}

export interface RequirementDraft {
  title: string;
  location: string;
  country: EuCountry | "";
  timeZone: RequirementTimeZone | "";
  headcount: string;
  urgency: Urgency;
  shift: Shift;
  /** `datetime-local` values (UTC, BR-10). Ignored while there are shifts: the period is their envelope. */
  startsAt: string;
  endsAt: string;
  /** Sorted shifts, ISO UTC. */
  shifts: RequirementShift[];
  /** The «add a shift» inputs (`datetime-local`, hours). */
  nextShift: { startsAt: string; endsAt: string; baseHours: string };
  qualifications: [string, RequirementLevel][];
  conditions: ConditionsDraft;
  description: string;
}

/** v1.8 «Movilización máxima»: 48 h, 12 h for AOG while the value is still one of those two defaults. */
export const mobilizationFor = (urgency: Urgency, current: string) =>
  current === "12" || current === "48" ? (urgency === "aog" ? "12" : "48") : current;

/** A new requirement: the v1.8 builder defaults (Company2.jsx:30-69 — 50 €/h, 8 h, 60 €/h extra, 30 €/día,
 * Contractor, flights/hotel/transport included, 48 h, ES, Europe/Madrid). `arrival` is the localized default. */
export function emptyDraft(arrival: string): RequirementDraft {
  return {
    title: "",
    location: "",
    country: DEFAULT_COUNTRY,
    timeZone: DEFAULT_TIME_ZONE,
    headcount: "1",
    urgency: "planned",
    shift: "day",
    startsAt: "",
    endsAt: "",
    shifts: [],
    nextShift: { startsAt: "", endsAt: "", baseHours: "8" },
    qualifications: [],
    conditions: {
      hourlyRate: "50",
      shiftHours: "8",
      overtimeRate: "60",
      perDiem: "30",
      contractType: "contractor",
      maxMobilizationHours: "48",
      arrival,
      budgetMandatory: false,
      flights: true,
      accommodation: true,
      localTransport: true,
      meals: false,
      ownTools: false,
    },
    description: "",
  };
}

const str = (n: number | undefined) => (n === undefined ? "" : String(n));

/** A saved requirement (edit) or a copy (duplicate) in the form. Terms not stated stay empty / unchecked. */
export function draftFromRequirement(r: WorkRequirement): RequirementDraft {
  const c: RequirementConditions = r.conditions ?? {};
  return {
    title: r.title,
    location: r.location,
    country: r.country ?? "",
    timeZone: r.timeZone ?? "",
    headcount: String(r.headcount),
    urgency: r.urgency,
    shift: r.shift,
    startsAt: toLocalInput(r.startsAt),
    endsAt: toLocalInput(r.endsAt),
    shifts: sortShifts(r.shifts ?? []),
    nextShift: { startsAt: "", endsAt: "", baseHours: str(c.shiftHours) || "8" },
    qualifications: r.qualifications.map((q) => [q.qualificationTypeId, q.level]),
    conditions: {
      hourlyRate: str(c.hourlyRate),
      shiftHours: str(c.shiftHours),
      overtimeRate: str(c.overtimeRate),
      perDiem: str(c.perDiem),
      contractType: c.contractType ?? "",
      maxMobilizationHours: str(c.maxMobilizationHours),
      arrival: c.arrival ?? "",
      budgetMandatory: c.budgetMandatory ?? false,
      flights: c.flights ?? false,
      accommodation: c.accommodation ?? false,
      localTransport: c.localTransport ?? false,
      meals: c.meals ?? false,
      ownTools: c.ownTools ?? false,
    },
    description: r.description ?? "",
  };
}

/** `"7,5"` and `"7.5"` both read as 7.5; empty → undefined; anything else NaN (the schema refuses it). */
const num = (value: string) => {
  const v = value.trim().replace(",", ".");
  return v === "" ? undefined : Number(v);
};

/** The period the form sends: the envelope of the shifts, else the two period inputs. */
export function draftPeriod(draft: RequirementDraft) {
  const sorted = sortShifts(draft.shifts);
  const first = sorted[0];
  const last = sorted.at(-1);
  return first && last
    ? { startsAt: first.startsAt, endsAt: last.endsAt }
    : { startsAt: toUtcIso(draft.startsAt), endsAt: toUtcIso(draft.endsAt) };
}

/** The shared schema's fields (create and edit) from the form. */
export function draftToFields(draft: RequirementDraft) {
  const c = draft.conditions;
  const conditions = Object.fromEntries(
    Object.entries({
      hourlyRate: num(c.hourlyRate),
      shiftHours: num(c.shiftHours),
      overtimeRate: num(c.overtimeRate),
      perDiem: num(c.perDiem),
      contractType: c.contractType || undefined,
      maxMobilizationHours: num(c.maxMobilizationHours),
      arrival: c.arrival.trim() || undefined,
      budgetMandatory: c.budgetMandatory,
      flights: c.flights,
      accommodation: c.accommodation,
      localTransport: c.localTransport,
      meals: c.meals,
      ownTools: c.ownTools,
    }).filter(([, value]) => value !== undefined),
  );
  return {
    title: draft.title,
    location: draft.location,
    ...draftPeriod(draft),
    shift: draft.shift,
    headcount: Number(draft.headcount),
    urgency: draft.urgency,
    qualifications: draft.qualifications.map(([qualificationTypeId, level]) => ({
      qualificationTypeId,
      level,
    })),
    ...(draft.country ? { country: draft.country } : {}),
    ...(draft.timeZone ? { timeZone: draft.timeZone } : {}),
    ...(draft.description.trim() ? { description: draft.description } : {}),
    ...(draft.shifts.length ? { shifts: sortShifts(draft.shifts) } : {}),
    conditions,
  };
}

/**
 * The shift the «add» inputs describe, or null when they are incomplete. Added as typed: the list's rules
 * (overlap, one per local date, ≤ 24 h, hours) are shown on the list and checked again on save.
 */
export function shiftFromInputs(next: RequirementDraft["nextShift"]): RequirementShift | null {
  const hours = num(next.baseHours);
  if (!next.startsAt || !next.endsAt || hours === undefined || Number.isNaN(hours)) return null;
  return { startsAt: toUtcIso(next.startsAt), endsAt: toUtcIso(next.endsAt), baseHours: hours };
}

/** After adding a shift, the inputs move to the same hours of the next day (the usual next one). */
export function nextDayInputs(
  shift: RequirementShift,
  baseHours: string,
): RequirementDraft["nextShift"] {
  const move = (iso: string) => toLocalInput(new Date(Date.parse(iso) + 86_400_000).toISOString());
  return { startsAt: move(shift.startsAt), endsAt: move(shift.endsAt), baseHours };
}

/**
 * Form field of an issue: the top-level field, or `conditions.<key>` so each condition shows its own error.
 * Used for the browser's Zod issues and the Edge Function's `issues[].path`.
 */
export const errorField = (path: string) =>
  path.startsWith("conditions.")
    ? path.split(".").slice(0, 2).join(".")
    : (path.split(".")[0] ?? "form");

export function toBuilderErrors(error: ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = errorField(issue.path.map(String).join(".")) || "form";
    errors[key] ??= issue.message;
  }
  return errors;
}

/** v1.8 `useDraft` (Professional2.jsx:10-27) key, one per organization and requirement (or the new one). */
export const autosaveKey = (organizationId: string, requirementId?: string) =>
  `crewflex:requirement-draft:${organizationId}:${requirementId ?? "new"}`;

export interface AutosavedDraft {
  savedAt: string;
  draft: RequirementDraft;
}

/** A stored autosave, or null when it is missing or not a draft of this shape (never trust storage). */
export function readAutosave(raw: string | null): AutosavedDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<AutosavedDraft>;
    const d = value.draft as Partial<RequirementDraft> | undefined;
    if (
      typeof value.savedAt !== "string" ||
      !d ||
      typeof d.title !== "string" ||
      !Array.isArray(d.shifts) ||
      !Array.isArray(d.qualifications) ||
      typeof d.conditions !== "object" ||
      d.conditions === null
    )
      return null;
    return value as AutosavedDraft;
  } catch {
    return null;
  }
}
