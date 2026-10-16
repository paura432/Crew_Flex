// Platform-admin qualification review (phase 6, migration 20261015130400). Shared by the review
// form, the server action and the `qualification-reviews` Edge Function. Deno-compatible imports.
// The reviewer is the JWT subject; their role is read from the database, never from the payload.
import { z } from "zod";

export const REVIEW_DECISIONS = ["verified", "rejected"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];
export const REVIEW_NOTE_MAX = 500;

export const reviewQualificationInput = z
  .strictObject({
    qualificationId: z.uuid("v.invalid"),
    decision: z.enum(REVIEW_DECISIONS, "v.invalid"),
    /** The `updatedAt` of the declaration the reviewer looked at (409 if it changed since). */
    expectedUpdatedAt: z.iso.datetime({ offset: true, error: "v.invalid" }),
    note: z
      .string("v.invalid")
      .trim()
      .max(REVIEW_NOTE_MAX, "v.review.noteMax")
      .transform((value) => (value.length === 0 ? null : value))
      .nullable()
      .default(null),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "rejected" && value.note === null) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "v.review.reasonRequired" });
    }
  });
export type ReviewQualificationInput = z.infer<typeof reviewQualificationInput>;
