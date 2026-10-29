// Shared by the «Buscar candidatos» page and the `candidate-directory` Edge Function (package directory,
// BUSINESS_RULES BR-28). Deno-compatible imports (relative, `.ts`). Messages are i18n keys (`v.directory.*`,
// messages/*.json). Identity never travels in a payload: the organization role comes from the database; the
// schema is strict, so `profileId`, `userId`, `role`… are rejected. The catalog values (category, aircraft,
// country) are checked HERE (400); the database re-checks the other bounds (22023) and is the backstop for a
// direct PostgREST call.
import { z } from "./zod.ts";
import {
  DIRECTORY_BASE_MAX,
  DIRECTORY_MIN_YEARS_MAX,
  DIRECTORY_PAGE_MAX,
  isValidDirectoryWindow,
  utcDay,
} from "../../domain/directory.ts";
import {
  AIRCRAFT,
  ENGLISH_LEVELS,
  EU_COUNTRIES,
  PROFESSIONAL_CATEGORIES,
} from "../../domain/passport.ts";

const isoDate = z.string("v.directory.window").regex(/^\d{4}-\d{2}-\d{2}$/, "v.directory.window");
/** A whole number sent as a query string (`?minYears=5`, `?page=2`). */
const queryInt = (max: number, message: string) =>
  z
    .string(message)
    .regex(/^\d{1,4}$/, message)
    .transform(Number)
    .refine((n) => n <= max, message);

/**
 * GET `candidate-directory?…` (the page's URL state, every value a string). Unknown filters are refused,
 * so a client cannot ask about anything the card does not show (T-154).
 */
export const directorySearchQuery = z
  .strictObject({
    organizationId: z.uuid("v.invalid"),
    category: z.enum(PROFESSIONAL_CATEGORIES, "v.invalid").optional(),
    aircraft: z.enum(AIRCRAFT, "v.invalid").optional(),
    englishLevel: z.enum(ENGLISH_LEVELS, "v.invalid").optional(),
    minYears: queryInt(DIRECTORY_MIN_YEARS_MAX, "v.directory.minYears").optional(),
    country: z.enum(EU_COUNTRIES, "v.invalid").optional(),
    base: z.string("v.invalid").trim().max(DIRECTORY_BASE_MAX, "v.invalid").optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    page: queryInt(DIRECTORY_PAGE_MAX, "v.invalid")
      .refine((n) => n >= 1, "v.invalid")
      .optional(),
  })
  .refine((q) => isValidDirectoryWindow(q.from, q.to, utcDay(Date.now())), {
    path: ["from"],
    message: "v.directory.window",
  });
export type DirectorySearchQuery = z.infer<typeof directorySearchQuery>;
