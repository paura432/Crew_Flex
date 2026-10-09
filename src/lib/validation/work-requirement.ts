// Shared by the requirement form, the server action and the `work-requirements` Edge Function.
// Imports must stay Deno-compatible: relative paths with `.ts`, bare "zod" (mapped in deno.json).
import { z } from "zod";
import {
  HEADCOUNT_MAX,
  MAX_REQUIREMENT_DAYS,
  REQUIREMENT_LEVELS,
  SHIFTS,
  URGENCIES,
} from "../../domain/work-requirement.ts";

const DAY_MS = 86_400_000;

export const requirementQualificationInput = z.strictObject({
  qualificationTypeId: z.uuid("Select a qualification"),
  level: z.enum(REQUIREMENT_LEVELS, "Choose hard or soft"),
});

export const createWorkRequirementInput = z
  .strictObject({
    organizationId: z.uuid("Organization is required"),
    title: z
      .string("Title is required")
      .trim()
      .min(3, "Title must have at least 3 characters")
      .max(120, "Title must have at most 120 characters"),
    location: z
      .string("Location is required")
      .trim()
      .min(2, "Location must have at least 2 characters")
      .max(80, "Location must have at most 80 characters"),
    startsAt: z.iso.datetime({ offset: true, error: "Start date and time are required" }),
    endsAt: z.iso.datetime({ offset: true, error: "End date and time are required" }),
    shift: z.enum(SHIFTS, "Choose a shift"),
    headcount: z
      .number("Headcount must be a number")
      .int("Headcount must be a whole number")
      .min(1, "Headcount must be at least 1")
      .max(HEADCOUNT_MAX, `Headcount must be at most ${HEADCOUNT_MAX}`),
    urgency: z.enum(URGENCIES, "Choose an urgency"),
    qualifications: z
      .array(requirementQualificationInput)
      .min(1, "Add at least one qualification")
      .max(20, "At most 20 qualifications"),
  })
  .superRefine((value, ctx) => {
    const start = Date.parse(value.startsAt);
    const end = Date.parse(value.endsAt);
    if (end <= start) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End must be after start" });
    } else if (end - start > MAX_REQUIREMENT_DAYS * DAY_MS) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: `A requirement can last at most ${MAX_REQUIREMENT_DAYS} days`,
      });
    }
    const ids = value.qualifications.map((q) => q.qualificationTypeId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["qualifications"],
        message: "Each qualification can only be added once",
      });
    }
    if (value.qualifications.length > 0 && !value.qualifications.some((q) => q.level === "hard")) {
      ctx.addIssue({
        code: "custom",
        path: ["qualifications"],
        message: "At least one qualification must be a hard requirement",
      });
    }
  });
export type CreateWorkRequirementInput = z.infer<typeof createWorkRequirementInput>;

export const listWorkRequirementsQuery = z.strictObject({
  id: z.uuid().optional(),
  organizationId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListWorkRequirementsQuery = z.infer<typeof listWorkRequirementsQuery>;

export const evaluateRequirementInput = z.strictObject({
  requirementId: z.uuid("A valid requirement id is required"),
});
export type EvaluateRequirementInput = z.infer<typeof evaluateRequirementInput>;
