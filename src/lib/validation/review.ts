// Platform-admin qualification review (phase 6, migration 20261015130400; evidence required for every
// decision since 20261027300000, P12 / T-170 — v1.8 «Evidencia / observaciones de la revisión»). Shared by
// the review form, the server action and the `qualification-reviews` Edge Function. Deno-compatible imports.
// The reviewer is the JWT subject; their role is read from the database, never from the payload.
import { z } from "./zod.ts";

export const REVIEW_DECISIONS = ["verified", "rejected"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];
export const REVIEW_NOTE_MAX = 500;

export const reviewQualificationInput = z.strictObject({
  qualificationId: z.uuid("v.invalid"),
  decision: z.enum(REVIEW_DECISIONS, "v.invalid"),
  /** The `updatedAt` of the declaration the reviewer looked at (409 if it changed since). */
  expectedUpdatedAt: z.iso.datetime({ offset: true, error: "v.invalid" }),
  /** Evidence of a verification (platform only) or reason of a rejection (the owner reads it). */
  note: z
    .string("v.review.evidenceRequired")
    .trim()
    .min(1, "v.review.evidenceRequired")
    .max(REVIEW_NOTE_MAX, "v.review.noteMax"),
});
export type ReviewQualificationInput = z.infer<typeof reviewQualificationInput>;
