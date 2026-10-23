// Queries of the Candidate Pack copy (v2-15 + v2-04, BR-25), served by the `applications` Edge Function next to
// its existing routes. Strict: the side (applicant or organization) comes from the database, never the request
// (S-2). Deno-compatible imports.
import { z } from "./zod.ts";

/** `GET /applications?view=pack&applicationId=` — one application's copy, for its two parties. */
export const applicationPackQuery = z.strictObject({
  view: z.literal("pack"),
  applicationId: z.uuid("v.application.id"),
});
export type ApplicationPackQuery = z.infer<typeof applicationPackQuery>;

/** `GET /applications?view=pack-preview` — what the caller's copy would contain now (professionals). */
export const packPreviewQuery = z.strictObject({ view: z.literal("pack-preview") });

/** The `view` values this module owns; anything else goes to the existing routes untouched. */
export const PACK_VIEWS = ["pack", "pack-preview"] as const;
export const isPackView = (view: string | null): view is (typeof PACK_VIEWS)[number] =>
  (PACK_VIEWS as readonly (string | null)[]).includes(view);
