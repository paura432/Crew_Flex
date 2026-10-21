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

export const createWorkRequirementInput = z
  .strictObject({
    organizationId: z.uuid("v.organization.required"),
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
  })
  .superRefine((value, ctx) => {
    const start = Date.parse(value.startsAt);
    const end = Date.parse(value.endsAt);
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
  });
export type CreateWorkRequirementInput = z.infer<typeof createWorkRequirementInput>;

/** Rows a list request returns when it does not ask for a limit. */
export const DEFAULT_LIST_LIMIT = 50;

export const listWorkRequirementsQuery = z.strictObject({
  id: z.uuid().optional(),
  organizationId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_LIST_LIMIT),
  status: z.enum(REQUIREMENT_STATUSES).optional(),
  /** Only needs whose period ends after this instant (the dashboard focus: open and not expired). */
  endsAfter: z.iso.datetime({ offset: true }).optional(),
});
export type ListWorkRequirementsQuery = z.infer<typeof listWorkRequirementsQuery>;

/** V1.8 `job.status` → closed (terminal). The only status change the API offers today. */
export const closeWorkRequirementInput = z.strictObject({
  id: z.uuid("v.requirement.id"),
  status: z.literal("closed"),
});
export type CloseWorkRequirementInput = z.infer<typeof closeWorkRequirementInput>;

export const evaluateRequirementInput = z.strictObject({
  requirementId: z.uuid("v.requirement.id"),
});
export type EvaluateRequirementInput = z.infer<typeof evaluateRequirementInput>;
