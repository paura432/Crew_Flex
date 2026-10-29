// Inputs of the `notifications` Edge Function (in-app notices, v2-18). Strict objects: the reader is
// the JWT subject, never a field of the request (S-2). Deno-compatible imports.
import { z } from "./zod.ts";

export const NOTICES_PAGE_SIZE = 20;

export const listNoticesQuery = z.strictObject({
  /** The shell's bell: only the unread count. */
  view: z.enum(["count"]).optional(),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(NOTICES_PAGE_SIZE),
});
export type ListNoticesQuery = z.infer<typeof listNoticesQuery>;

/** Mark one notice (`id`) or every unread one (`all: true`) as read — exactly one of the two. */
export const markNoticesReadInput = z
  .strictObject({
    id: z.uuid("v.invalid").optional(),
    all: z.literal(true, "v.invalid").optional(),
  })
  .refine((v) => (v.id === undefined) !== (v.all === undefined), {
    path: ["id"],
    message: "v.invalid",
  });
export type MarkNoticesReadInput = z.infer<typeof markNoticesReadInput>;
