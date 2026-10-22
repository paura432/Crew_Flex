// Shared by the requirement form, the server action and the `work-requirements` Edge Function.
// Imports must stay Deno-compatible: relative paths with `.ts`, bare "zod" (mapped in deno.json).
// Messages are i18n keys (`v.*`, messages/*.json) resolved by the UI.
import { z } from "./zod.ts";
import {
  HEADCOUNT_MAX,
  MAX_REQUIREMENT_DAYS,
  REQUIREMENT_LEVELS,
  REQUIREMENT_STATUSES,
  SHIFTS,
  URGENCIES,
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
  qualifications: z
    .array(requirementQualificationInput)
    .min(1, "v.qualifications.min")
    .max(20, "v.qualifications.max"),
};
type RequirementFields = z.infer<z.ZodObject<typeof requirementFields>>;

/** The creation rules (BR-1.3/BR-1.4), shared by create and edit (M05: «with the creation validations»). */
function refineRequirement(
  value: RequirementFields,
  ctx: z.core.$RefinementCtx<RequirementFields>,
) {
  const start = Date.parse(value.startsAt);
  const end = Date.parse(value.endsAt);
  if (start < Date.now() - START_GRACE_MS) {
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
  const ids = value.qualifications.map((q) => q.qualificationTypeId);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({
      code: "custom",
      path: ["qualifications"],
      message: "v.qualifications.duplicate",
    });
  }
  if (value.qualifications.length > 0 && !value.qualifications.some((q) => q.level === "hard")) {
    ctx.addIssue({
      code: "custom",
      path: ["qualifications"],
      message: "v.qualifications.hard",
    });
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

export const REQUIREMENT_LIST_ORDERS = ["starts_asc", "created_desc"] as const;
export type RequirementListOrder = (typeof REQUIREMENT_LIST_ORDERS)[number];

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
});
export type ListWorkRequirementsQuery = z.infer<typeof listWorkRequirementsQuery>;

/** Status changes the API offers (M05): pause, resume (`open`), close (terminal). */
export const REQUIREMENT_STATUS_ACTIONS = ["paused", "open", "closed"] as const;
export const changeRequirementStatusInput = z.strictObject({
  id: z.uuid("v.requirement.id"),
  status: z.enum(REQUIREMENT_STATUS_ACTIONS),
});
export type ChangeRequirementStatusInput = z.infer<typeof changeRequirementStatusInput>;

export const evaluateRequirementInput = z.strictObject({
  requirementId: z.uuid("v.requirement.id"),
});
export type EvaluateRequirementInput = z.infer<typeof evaluateRequirementInput>;
