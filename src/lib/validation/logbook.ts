// Shared by the logbook form, the server actions and the `professional-logbook` Edge Function
// (M14, N-12, BUSINESS_RULES BR-17). Deno-compatible imports (relative, `.ts`). Messages are i18n
// keys (`v.logbook.*`, messages/*.json).
//
// Identity never travels in a payload: the owner is the JWT subject. Every schema is strict, so
// `technicianProfileId`, `userId`, `status`… are rejected.
import { z } from "./zod.ts";
import {
  isFutureLogbookDate,
  isValidLogbookHours,
  LOGBOOK_CATEGORIES,
  LOGBOOK_ENVIRONMENTS,
  LOGBOOK_LIMITS,
} from "../../domain/logbook.ts";

const fields = {
  entryDate: z.iso
    .date("v.logbook.date.invalid")
    .refine((date) => !isFutureLogbookDate(date), "v.logbook.date.future"),
  aircraft: z
    .string("v.logbook.aircraft.required")
    .trim()
    .min(1, "v.logbook.aircraft.required")
    .max(LOGBOOK_LIMITS.aircraft, "v.logbook.aircraft.max"),
  /** ATA chapter, optional; an empty string means none. */
  ata: z
    .string("v.logbook.ata")
    .trim()
    .max(LOGBOOK_LIMITS.ata, "v.logbook.ata")
    .transform((value) => value || null)
    .nullable()
    .optional(),
  hours: z.number("v.logbook.hours").refine(isValidLogbookHours, "v.logbook.hours"),
  category: z.enum(LOGBOOK_CATEGORIES, "v.logbook.category"),
  environment: z.enum(LOGBOOK_ENVIRONMENTS, "v.logbook.environment"),
  description: z
    .string("v.logbook.description.required")
    .trim()
    .min(1, "v.logbook.description.required")
    .max(LOGBOOK_LIMITS.description, "v.logbook.description.max"),
  /** «Seleccionable para expediente» (v1.8 `cvRelevant`): stored only; nothing reads it yet (D-07). */
  cvRelevant: z.boolean("v.invalid"),
};

export const createLogbookEntryInput = z.strictObject({
  ...fields,
  cvRelevant: fields.cvRelevant.default(false),
});
export type CreateLogbookEntryInput = z.infer<typeof createLogbookEntryInput>;

/**
 * PATCH: any subset of the fields, plus `archived` (v1.8 «Archivar» / «Restaurar»). At least one key.
 */
export const updateLogbookEntryInput = z
  .strictObject({ ...fields, archived: z.boolean("v.invalid") })
  .partial()
  .refine((input) => Object.keys(input).length > 0, "v.logbook.empty");
export type UpdateLogbookEntryInput = z.infer<typeof updateLogbookEntryInput>;

export const logbookEntryIdQuery = z.strictObject({
  id: z.uuid("v.logbook.id"),
});

export const LOGBOOK_VIEWS = ["active", "archived"] as const;
export type LogbookView = (typeof LOGBOOK_VIEWS)[number];

/** `GET ?view=active|archived&limit=` — newest first; `total` tells the UI when the list is cut. */
export const listLogbookQuery = z.strictObject({
  view: z.enum(LOGBOOK_VIEWS, "v.invalid").default("active"),
  limit: z.coerce
    .number("v.invalid")
    .int("v.invalid")
    .min(1, "v.invalid")
    .max(500, "v.invalid")
    .default(200),
});
