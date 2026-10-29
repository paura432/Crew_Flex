// Shared by the availability form, the server actions and the `professional-availability`
// Edge Function. Deno-compatible imports (relative, `.ts`, bare "zod"). Messages are i18n keys
// (`v.*`, messages/*.json) resolved by the UI; the API returns the keys in `issues[].message`.
import { z } from "./zod.ts";
import {
  AVAILABILITY_STATUSES,
  CYCLE_DAYS,
  MAX_CYCLE_DAYS,
  ROTATIONS,
} from "../../domain/availability.ts";

const DAY_MS = 86_400_000;
export const MAX_WINDOW_DAYS = 366;

const isoDateTime = (key: string) => z.iso.datetime({ offset: true, error: key });

function refinePeriod(value: { startsAt: string; endsAt: string }, ctx: z.RefinementCtx) {
  const start = Date.parse(value.startsAt);
  const end = Date.parse(value.endsAt);
  if (end <= start) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "v.end.afterStart" });
  } else if (end - start > MAX_WINDOW_DAYS * DAY_MS) {
    ctx.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "v.window.maxDays",
    });
  }
}

export const createAvailabilityWindowInput = z
  .strictObject({
    startsAt: isoDateTime("v.start.required"),
    endsAt: isoDateTime("v.end.required"),
    status: z.enum(AVAILABILITY_STATUSES, "v.window.status"),
  })
  .superRefine(refinePeriod);
export type CreateAvailabilityWindowInput = z.infer<typeof createAvailabilityWindowInput>;

/** Full replacement of a window's fields (no partial updates: keeps the period rule simple). */
export const updateAvailabilityWindowInput = createAvailabilityWindowInput;
export type UpdateAvailabilityWindowInput = CreateAvailabilityWindowInput;

export const MAX_REPLACE_DAYS = 62;

/**
 * Whole UTC days set at once (shift-cycle generator): `status: null` clears the day. Applied in one
 * transaction by `replace_availability_days` (migration 20261019120000), which re-validates.
 */
/** The generator's chosen pattern (private preference, table `availability_rotations`). */
export const availabilityRotationInput = z
  .strictObject({
    pattern: z.enum(ROTATIONS, "v.rotation.pattern"),
    anchor: z.iso.date("v.day.invalid"),
    customCycle: z
      .array(z.enum(CYCLE_DAYS, "v.rotation.cycle"))
      .max(MAX_CYCLE_DAYS, "v.rotation.cycle"),
  })
  .refine((r) => r.pattern !== "custom" || r.customCycle.length >= 1, {
    path: ["customCycle"],
    message: "v.rotation.cycle",
  });
export type AvailabilityRotationInput = z.infer<typeof availabilityRotationInput>;

export const replaceAvailabilityDaysInput = z
  .strictObject({
    days: z
      .array(
        z.strictObject({
          date: z.iso.date("v.day.invalid"),
          status: z.enum(AVAILABILITY_STATUSES, "v.window.status").nullable(),
        }),
        "v.days.required",
      )
      .max(MAX_REPLACE_DAYS, "v.days.tooMany")
      .refine((days) => new Set(days.map((d) => d.date)).size === days.length, "v.days.duplicate"),
    rotation: availabilityRotationInput.optional(),
    /** `version` of the calendar the draft was made on (GET); a stale one gets 409 CONFLICT. */
    expectedVersion: z
      .string()
      .regex(/^[0-9a-f]{32}$/, "v.days.version")
      .optional(),
  })
  // Days may be empty only when the call just saves the pattern.
  .refine((v) => v.days.length > 0 || v.rotation !== undefined, {
    path: ["days"],
    message: "v.days.required",
  });
export type ReplaceAvailabilityDaysInput = z.infer<typeof replaceAvailabilityDaysInput>;

export const availabilityWindowIdQuery = z.strictObject({
  id: z.uuid("v.window.id"),
});

export const listAvailabilityQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
