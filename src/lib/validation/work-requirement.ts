// Shared by the requirement form, the server action and the `work-requirements` Edge Function.
// Imports must stay Deno-compatible: relative paths with `.ts`, bare "zod" (mapped in deno.json).
// Messages are i18n keys (`v.*`, messages/*.json) resolved by the UI.
import { z } from "./zod.ts";
import {
  BASE_HOURS_MAX,
  BASE_HOURS_MIN,
  CONTRACT_TYPES,
  EU_COUNTRIES,
  HEADCOUNT_MAX,
  MAX_REQUIREMENT_DAYS,
  MAX_SHIFTS,
  REQUIREMENT_LEVELS,
  REQUIREMENT_STATUSES,
  REQUIREMENT_TIME_ZONES,
  SHIFTS,
  shiftEnvelope,
  shiftIssues,
  URGENCIES,
  type WorkRequirement,
} from "../../domain/work-requirement.ts";

const DAY_MS = 86_400_000;

export const requirementQualificationInput = z.strictObject({
  qualificationTypeId: z.uuid("v.qualification.select"),
  level: z.enum(REQUIREMENT_LEVELS, "v.qualification.level"),
});

/**
 * How far in the past a new requirement may start: the time it takes to fill the form plus clock skew.
 * Anything earlier is refused, as V1.8 did («La fecha de inicio no puede estar en el pasado.»).
 */
export const START_GRACE_MS = 15 * 60 * 1000;

/** Money and hours carry at most two decimals (as the database stores them). */
const twoDecimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
const amount = (key: string, min: number, max: number, exclusiveMin = false) =>
  z
    .number(key)
    .refine((n) => (exclusiveMin ? n > min : n >= min) && n <= max && twoDecimals(n), key);

/** One shift of the v1.8 ShiftEditor (v2-09): UTC instants and 0.25–24 base hours. */
export const requirementShiftInput = z.strictObject({
  startsAt: z.iso.datetime({ offset: true, error: "v.start.required" }),
  endsAt: z.iso.datetime({ offset: true, error: "v.end.required" }),
  baseHours: amount("v.requirement.shifts.hours", BASE_HOURS_MIN, BASE_HOURS_MAX),
});

/**
 * Informative conditions without real money (v2-12, OD-7; T-62): the v1.8 demo fields and ranges. Every key is
 * optional (absent = not stated); unknown keys — commissions included — are refused. Same rules as the CHECK
 * `work_requirements_conditions_valid`.
 */
export const requirementConditionsInput = z.strictObject({
  hourlyRate: amount("v.requirement.conditions.hourlyRate", 0, 2000, true).optional(),
  overtimeRate: amount("v.requirement.conditions.overtimeRate", 0, 2000).optional(),
  perDiem: amount("v.requirement.conditions.perDiem", 0, 2000).optional(),
  shiftHours: amount(
    "v.requirement.conditions.shiftHours",
    BASE_HOURS_MIN,
    BASE_HOURS_MAX,
  ).optional(),
  contractType: z.enum(CONTRACT_TYPES, "v.requirement.conditions.contractType").optional(),
  budgetMandatory: z.boolean().optional(),
  maxMobilizationHours: z
    .number("v.requirement.conditions.mobilization")
    .int("v.requirement.conditions.mobilization")
    .min(1, "v.requirement.conditions.mobilization")
    .max(168, "v.requirement.conditions.mobilization")
    .optional(),
  arrival: z
    .string("v.requirement.conditions.arrival")
    .trim()
    .min(1, "v.requirement.conditions.arrival")
    .max(160, "v.requirement.conditions.arrival")
    .optional(),
  flights: z.boolean().optional(),
  accommodation: z.boolean().optional(),
  localTransport: z.boolean().optional(),
  meals: z.boolean().optional(),
  ownTools: z.boolean().optional(),
});
export type RequirementConditionsInput = z.infer<typeof requirementConditionsInput>;

/**
 * The same keys and ranges for rows read back from the database (Edge Functions): no trimming transform, so a
 * stored value is parsed as it is — the CHECK already refuses what `trim()` would change (security review MEDIUM-1).
 */
export const requirementConditionsRow = requirementConditionsInput.extend({
  arrival: z.string().min(1).max(160).optional(),
});

const requirementFields = {
  title: z.string("v.title.required").trim().min(3, "v.title.min").max(120, "v.title.max"),
  location: z
    .string("v.location.required")
    .trim()
    .min(2, "v.location.min")
    .max(80, "v.location.max"),
  startsAt: z.iso.datetime({ offset: true, error: "v.start.required" }),
  endsAt: z.iso.datetime({ offset: true, error: "v.end.required" }),
  shift: z.enum(SHIFTS, "v.shift.invalid"),
  headcount: z
    .number("v.headcount.number")
    .int("v.headcount.int")
    .min(1, "v.headcount.min")
    .max(HEADCOUNT_MAX, "v.headcount.max"),
  urgency: z.enum(URGENCIES, "v.urgency.invalid"),
  // At least one, and a hard one, unless the requirement is saved as a draft (R-D4, T-63): see the refinement.
  qualifications: z.array(requirementQualificationInput).max(20, "v.qualifications.max"),
  // Requirement builder (v2-09/10/12, LOCAL 20261023600000). Optional: absent = not stated, so older clients keep
  // working; the form always sends country and zone (default ES, Europe/Madrid).
  country: z.enum(EU_COUNTRIES, "v.requirement.country").optional(),
  timeZone: z.enum(REQUIREMENT_TIME_ZONES, "v.requirement.timeZone").optional(),
  description: z
    .string("v.requirement.description")
    .trim()
    .max(4000, "v.requirement.description")
    .optional(),
  /** 1–366 shifts; the period (`startsAt`/`endsAt`) must be their envelope. Absent = one continuous period. */
  shifts: z.array(requirementShiftInput).max(MAX_SHIFTS, "v.requirement.shifts.tooMany").optional(),
  conditions: requirementConditionsInput.optional(),
  /**
   * Recruiter (D-12 provisional, LOCAL 20261024500100, BR-27): the represented client a staffing agency publishes
   * for — an ACTIVE representation of that organization (the database checks it). Full replacement like the other
   * terms: absent = no client. A staffing agency must send it to publish (`clientRequired`, CFR01 otherwise).
   */
  onBehalfOfClientId: z.uuid("v.requirement.client.select").optional(),
  /**
   * `draft` saves an incomplete requirement (v1.8 «Guardar borrador»: no qualification-count and no
   * start-in-the-future rule); `publish` (or nothing) applies every creation rule — on an edit, `publish` also
   * publishes a draft (draft → open).
   */
  intent: z.enum(["draft", "publish"]).optional(),
};
type RequirementFields = z.infer<z.ZodObject<typeof requirementFields>>;

/**
 * The creation rules (BR-1.3/BR-1.4), shared by create and edit (M05: «with the creation validations»). A draft
 * (`intent: "draft"`, R-D4) skips the start-in-the-future and the qualification-count rules; the period, shifts
 * and terms must still be well formed (every requirement row has them).
 */
function refineRequirement(
  value: RequirementFields,
  ctx: z.core.$RefinementCtx<RequirementFields>,
) {
  const draft = value.intent === "draft";
  const start = Date.parse(value.startsAt);
  const end = Date.parse(value.endsAt);
  if (!draft && start < Date.now() - START_GRACE_MS) {
    ctx.addIssue({ code: "custom", path: ["startsAt"], message: "v.start.future" });
  }
  if (end <= start) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "v.end.afterStart" });
  } else if (end - start > MAX_REQUIREMENT_DAYS * DAY_MS) {
    ctx.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "v.requirement.maxDays",
    });
  }
  if (!draft && value.qualifications.length === 0) {
    ctx.addIssue({ code: "custom", path: ["qualifications"], message: "v.qualifications.min" });
  }
  const ids = value.qualifications.map((q) => q.qualificationTypeId);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({
      code: "custom",
      path: ["qualifications"],
      message: "v.qualifications.duplicate",
    });
  }
  if (
    !draft &&
    value.qualifications.length > 0 &&
    !value.qualifications.some((q) => q.level === "hard")
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["qualifications"],
      message: "v.qualifications.hard",
    });
  }
  if (value.shifts?.length) {
    for (const { index, issue } of shiftIssues(value.shifts, value.timeZone)) {
      ctx.addIssue({
        code: "custom",
        path: index < 0 ? ["shifts"] : ["shifts", index],
        message: `v.requirement.shifts.${issue}`,
      });
    }
    const envelope = shiftEnvelope(value.shifts);
    if (
      envelope &&
      (Date.parse(envelope.startsAt) !== start || Date.parse(envelope.endsAt) !== end)
    ) {
      ctx.addIssue({ code: "custom", path: ["shifts"], message: "v.requirement.shifts.envelope" });
    }
  }
}

export const createWorkRequirementInput = z
  .strictObject({ organizationId: z.uuid("v.organization.required"), ...requirementFields })
  .superRefine(refineRequirement);
export type CreateWorkRequirementInput = z.infer<typeof createWorkRequirementInput>;

/**
 * Edit (M05, owner 2026-10-22): the whole requirement again, with the version the client loaded
 * (`updatedAt`, ms). The database refuses it once the requirement received an application (409
 * `HAS_APPLICATIONS`), when it changed since (409) and when closed (409). The organization never changes.
 */
export const updateWorkRequirementInput = z
  .strictObject({
    id: z.uuid("v.requirement.id"),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    ...requirementFields,
  })
  .superRefine(refineRequirement);
export type UpdateWorkRequirementInput = z.infer<typeof updateWorkRequirementInput>;

/** Every field of the create/edit payload, from a requirement as the API returns it (edit form, publish check). */
export function toRequirementFields(r: WorkRequirement) {
  return {
    title: r.title,
    location: r.location,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    shift: r.shift,
    headcount: r.headcount,
    urgency: r.urgency,
    qualifications: r.qualifications.map((q) => ({
      qualificationTypeId: q.qualificationTypeId,
      level: q.level,
    })),
    ...(r.country ? { country: r.country } : {}),
    ...(r.timeZone ? { timeZone: r.timeZone } : {}),
    ...(r.description ? { description: r.description } : {}),
    ...(r.shifts?.length ? { shifts: r.shifts } : {}),
    ...(r.conditions ? { conditions: r.conditions } : {}),
    ...(r.client ? { onBehalfOfClientId: r.client.id } : {}),
  };
}

/**
 * Publishing a draft through the status change (draft → open) applies the full creation rules to what is saved
 * (R-D4): the issues that keep it a draft; empty when it may be published.
 */
export function publishIssues(r: WorkRequirement) {
  const result = createWorkRequirementInput.safeParse({
    organizationId: r.organizationId,
    ...toRequirementFields(r),
  });
  return result.success ? [] : result.error.issues;
}

export const REQUIREMENT_LIST_ORDERS = ["starts_asc", "created_desc"] as const;
export type RequirementListOrder = (typeof REQUIREMENT_LIST_ORDERS)[number];

/** v1.8 «Archivada» (T-64) in the list: everything (default, as before), only the others, or only archived. */
export const REQUIREMENT_ARCHIVE_FILTERS = ["include", "exclude", "only"] as const;
export type RequirementArchiveFilter = (typeof REQUIREMENT_ARCHIVE_FILTERS)[number];

/** Rows a list request returns when it does not ask for a limit. */
export const DEFAULT_LIST_LIMIT = 50;

export const listWorkRequirementsQuery = z.strictObject({
  id: z.uuid().optional(),
  organizationId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_LIST_LIMIT),
  status: z.enum(REQUIREMENT_STATUSES).optional(),
  /** Only needs whose period ends after this instant (the dashboard focus: open and not expired). */
  endsAfter: z.iso.datetime({ offset: true }).optional(),
  /** Rows to skip (pagination of the requirements page). */
  offset: z.coerce.number().int().min(0).max(10000).default(0),
  /** `starts_asc` (soonest first: dashboard, focus) or `created_desc` (newest first: the list page). */
  order: z.enum(REQUIREMENT_LIST_ORDERS).default("starts_asc"),
  archived: z.enum(REQUIREMENT_ARCHIVE_FILTERS).default("include"),
});
export type ListWorkRequirementsQuery = z.infer<typeof listWorkRequirementsQuery>;

/** Status changes the API offers (M05): pause, resume / publish a draft (`open`), close (terminal). */
export const REQUIREMENT_STATUS_ACTIONS = ["paused", "open", "closed"] as const;
export const changeRequirementStatusInput = z.strictObject({
  id: z.uuid("v.requirement.id"),
  status: z.enum(REQUIREMENT_STATUS_ACTIONS),
});
export type ChangeRequirementStatusInput = z.infer<typeof changeRequirementStatusInput>;

/** v1.8 «Archivar» (one way, T-64): a closed requirement, or a draft (closed in the same step). */
export const archiveRequirementInput = z.strictObject({
  id: z.uuid("v.requirement.id"),
  archive: z.literal(true),
});
export type ArchiveRequirementInput = z.infer<typeof archiveRequirementInput>;

/** `PATCH /work-requirements` body: a status change or the archive. */
export const patchRequirementInput = z.union([
  changeRequirementStatusInput,
  archiveRequirementInput,
]);
export type PatchRequirementInput = z.infer<typeof patchRequirementInput>;

export const evaluateRequirementInput = z.strictObject({
  requirementId: z.uuid("v.requirement.id"),
});
export type EvaluateRequirementInput = z.infer<typeof evaluateRequirementInput>;

/**
 * v1.8 «{n} candidatos con requisitos y bloques viables» (v2-13, T-66): the builder's period, urgency and hard
 * qualifications, saved or not (`POST /matching-evaluate`). The answer is a count only.
 */
export const viableCandidatesInput = z
  .strictObject({
    organizationId: z.uuid("v.organization.required"),
    startsAt: z.iso.datetime({ offset: true, error: "v.start.required" }),
    endsAt: z.iso.datetime({ offset: true, error: "v.end.required" }),
    urgency: z.enum(URGENCIES, "v.urgency.invalid"),
    hardQualificationTypeIds: z
      .array(z.uuid("v.qualification.select"))
      .min(1, "v.qualifications.hard")
      .max(20, "v.qualifications.max"),
  })
  .superRefine((value, ctx) => {
    const start = Date.parse(value.startsAt);
    const end = Date.parse(value.endsAt);
    // A period that has not started only (as the database; security review LOW-2).
    if (start < Date.now() - START_GRACE_MS)
      ctx.addIssue({ code: "custom", path: ["startsAt"], message: "v.start.future" });
    if (end <= start)
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "v.end.afterStart" });
    else if (end - start > MAX_REQUIREMENT_DAYS * DAY_MS)
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "v.requirement.maxDays" });
  });
export type ViableCandidatesInput = z.infer<typeof viableCandidatesInput>;

/** `POST /matching-evaluate` body: a saved requirement's external matching, or the builder's live count. */
export const matchingEvaluateInput = z.union([evaluateRequirementInput, viableCandidatesInput]);
