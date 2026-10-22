// Shared by the notice-preferences form, the «Distribuir aviso» button, their server actions and the
// `notice-preferences` / `requirement-outreach` Edge Functions (package outreach, BUSINESS_RULES BR-26).
// Deno-compatible imports (relative, `.ts`). Messages are i18n keys (`v.outreach.*`, messages/*.json).
// Identity never travels in a payload: the owner / the organization role come from the JWT and the
// database. Every schema is strict, so `profileId`, `userId`, `organizationId`, `role`… are rejected.
import { z } from "./zod.ts";
import {
  isIanaTimeZone,
  isValidQuietHours,
  MOBILIZATION_HOURS_MAX,
  QUIET_TIME_PATTERN,
} from "../../domain/outreach.ts";

const quietTime = z
  .string("v.outreach.quietHours")
  .regex(QUIET_TIME_PATTERN, "v.outreach.quietHours")
  .nullable();

/** PUT body of `notice-preferences`: the whole form (v1.8 connected «Avisos de oportunidades»). */
export const noticePreferencesInput = z
  .strictObject({
    urgentOptIn: z.boolean("v.invalid"),
    aogOptIn: z.boolean("v.invalid"),
    /** Whole hours 0–720; null = not declared (no outreach reaches the professional). */
    mobilizationHours: z
      .number("v.outreach.mobilization")
      .int("v.outreach.mobilization")
      .min(0, "v.outreach.mobilization")
      .max(MOBILIZATION_HOURS_MAX, "v.outreach.mobilization")
      .nullable(),
    timeZone: z.string("v.outreach.timeZone").trim().refine(isIanaTimeZone, "v.outreach.timeZone"),
    quietStart: quietTime,
    quietEnd: quietTime,
  })
  .refine((input) => isValidQuietHours(input.quietStart, input.quietEnd), {
    path: ["quietStart"],
    message: "v.outreach.quietHours",
    // Also when another field is wrong, so the form shows every error at once; skipped only when the
    // two times themselves are already refused (their own message says it).
    when: ({ value }) => {
      const v = value as { quietStart?: unknown; quietEnd?: unknown };
      const shaped = (t: unknown) =>
        t === null || (typeof t === "string" && QUIET_TIME_PATTERN.test(t));
      return shaped(v?.quietStart) && shaped(v?.quietEnd);
    },
  });
export type NoticePreferencesInput = z.infer<typeof noticePreferencesInput>;

/** GET `requirement-outreach?requirementId=` and POST `{ requirementId }`. */
export const outreachRequirementInput = z.strictObject({
  requirementId: z.uuid("v.invalid"),
});
export type OutreachRequirementInput = z.infer<typeof outreachRequirementInput>;
