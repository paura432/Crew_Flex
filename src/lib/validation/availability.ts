// Shared by the availability form, the server actions and the `professional-availability`
// Edge Function. Deno-compatible imports (relative, `.ts`, bare "zod").
import { z } from "zod";
import { AVAILABILITY_STATUSES } from "../../domain/availability.ts";

const DAY_MS = 86_400_000;
export const MAX_WINDOW_DAYS = 366;

const isoDateTime = (label: string) =>
  z.iso.datetime({ offset: true, error: `${label} must be a date and time (UTC)` });

function refinePeriod(value: { startsAt: string; endsAt: string }, ctx: z.RefinementCtx) {
  const start = Date.parse(value.startsAt);
  const end = Date.parse(value.endsAt);
  if (end <= start) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End must be after start" });
  } else if (end - start > MAX_WINDOW_DAYS * DAY_MS) {
    ctx.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: `A window can span at most ${MAX_WINDOW_DAYS} days`,
    });
  }
}

export const createAvailabilityWindowInput = z
  .strictObject({
    startsAt: isoDateTime("Start"),
    endsAt: isoDateTime("End"),
    status: z.enum(AVAILABILITY_STATUSES, "Choose available or unavailable"),
  })
  .superRefine(refinePeriod);
export type CreateAvailabilityWindowInput = z.infer<typeof createAvailabilityWindowInput>;

/** Full replacement of a window's fields (no partial updates: keeps the period rule simple). */
export const updateAvailabilityWindowInput = createAvailabilityWindowInput;
export type UpdateAvailabilityWindowInput = CreateAvailabilityWindowInput;

export const availabilityWindowIdQuery = z.strictObject({
  id: z.uuid("A valid window id is required"),
});

export const listAvailabilityQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
