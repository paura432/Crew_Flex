// Inputs of the `training` Edge Function (ADR-003, batch V19-01). Messages are i18n keys (`v.*`).
// Strict objects: identity, side and organization role never come from the body (S-2); the server
// decides who acts. Shared with the Next.js server actions (Deno-compatible relative imports).
import {
  CAPACITY_MAX,
  CATALOG_PAGE_SIZE,
  editionIssue,
  PRICE_CENTS_MAX,
  QUOTE_TOTAL_CENTS_MAX,
  SESSIONS_MAX,
  TRAINING_CURRENCIES,
  TRAINING_FAMILIES,
  TRAINING_LISTING_DECISIONS,
  TRAINING_MODES,
  TRAINING_OUTCOMES,
  TRAINING_PRICE_UNITS,
  TRAINING_PROVIDER_DECISIONS,
  TRAINING_REQUEST_KINDS,
  TRAINING_REQUEST_STATUSES,
  TRAINING_REVIEW_KINDS,
  TRAINING_SCOPES,
  TRAINING_SESSION_ELEMENTS,
  UNITS_MAX,
} from "../../domain/training.ts";
import { z } from "./zod.ts";

const text = (max: number, key: string) => z.string(key).trim().min(1, key).max(max, key);
const optionalText = (max: number, key: string) =>
  z
    .string(key)
    .trim()
    .max(max, key)
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : v));
const isoInstant = z.iso.datetime({ offset: true });
const version = z.iso.datetime({ offset: true });

// --- Reads --------------------------------------------------------------------------------------

export const catalogQuery = z.strictObject({
  view: z.literal("catalog"),
  q: z.string().trim().max(80).optional(),
  family: z.enum(TRAINING_FAMILIES).optional(),
  mode: z.enum(TRAINING_MODES).optional(),
  language: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(CATALOG_PAGE_SIZE),
});

/** One of the function's GET views (see `supabase/functions/training/index.ts`). */
export const trainingQuery = z.discriminatedUnion("view", [
  catalogQuery,
  z.strictObject({ view: z.literal("course"), id: z.uuid() }),
  z.strictObject({ view: z.literal("favorites") }),
  z.strictObject({ view: z.literal("requests") }),
  z.strictObject({ view: z.literal("messages"), requestId: z.uuid() }),
  z.strictObject({
    view: z.literal("inbox"),
    organizationId: z.uuid(),
    status: z.enum(TRAINING_REQUEST_STATUSES).optional(),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
  z.strictObject({ view: z.literal("workspace"), organizationId: z.uuid() }),
  z.strictObject({
    view: z.literal("review-queue"),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
  z.strictObject({ view: z.literal("sessions"), from: isoInstant, to: isoInstant }),
]);
export type TrainingQuery = z.infer<typeof trainingQuery>;

// --- Provider, course, edition -------------------------------------------------------------------

export const providerInput = z.strictObject({
  organizationId: z.uuid(),
  name: text(200, "v.training.name"),
  description: text(4000, "v.training.description"),
  website: optionalText(500, "v.training.website").refine(
    (v) => v === null || /^https:\/\//i.test(v),
    "v.training.website",
  ),
  expectedUpdatedAt: version.optional(),
});
export type ProviderInput = z.infer<typeof providerInput>;

export const courseInput = z
  .strictObject({
    organizationId: z.uuid(),
    id: z.uuid().optional(),
    expectedUpdatedAt: version.optional(),
    title: text(180, "v.training.title"),
    family: z.enum(TRAINING_FAMILIES, "v.training.family"),
    description: text(6000, "v.training.description"),
    aircraft: optionalText(160, "v.training.aircraft"),
    engine: optionalText(160, "v.training.engine"),
    category: optionalText(160, "v.training.category"),
    language: text(100, "v.training.language"),
    prerequisites: optionalText(3000, "v.training.prerequisites"),
    syllabus: optionalText(5000, "v.training.syllabus"),
    certificateInfo: text(2000, "v.training.certificateInfo"),
    issuer: text(200, "v.training.issuer"),
    scope: z.enum(TRAINING_SCOPES).default("general"),
    approvalRef: optionalText(300, "v.training.approvalRef"),
  })
  .superRefine((v, ctx) => {
    if (v.scope !== "general" && v.approvalRef === null)
      ctx.addIssue({ code: "custom", path: ["approvalRef"], message: "v.training.approvalRef" });
    if ((v.id === undefined) !== (v.expectedUpdatedAt === undefined))
      ctx.addIssue({ code: "custom", path: ["expectedUpdatedAt"], message: "v.training.version" });
  });
export type CourseInput = z.infer<typeof courseInput>;

export const sessionInput = z.strictObject({
  startsAt: isoInstant,
  endsAt: isoInstant,
  location: optionalText(200, "v.training.location"),
  element: z.enum(TRAINING_SESSION_ELEMENTS).default("theory"),
});

export const editionInput = z
  .strictObject({
    courseId: z.uuid(),
    id: z.uuid().optional(),
    expectedUpdatedAt: version.optional(),
    mode: z.enum(TRAINING_MODES, "v.training.mode"),
    provisional: z.boolean().default(false),
    deadline: isoInstant.nullable().default(null),
    capacity: z
      .number()
      .int()
      .min(1, "v.training.capacity")
      .max(CAPACITY_MAX, "v.training.capacity"),
    city: optionalText(180, "v.training.city"),
    country: optionalText(100, "v.training.country"),
    currency: z.enum(TRAINING_CURRENCIES).default("EUR"),
    priceUnit: z.enum(TRAINING_PRICE_UNITS, "v.training.priceUnit"),
    /** Per unit, in integer cents; null exactly for `quote`. */
    priceCents: z.number().int().min(0).max(PRICE_CENTS_MAX).nullable().default(null),
    priceIncludes: text(2000, "v.training.priceIncludes"),
    policy: text(3000, "v.training.policy"),
    timeZone: text(64, "v.training.timeZone"),
    sessions: z.array(sessionInput).max(SESSIONS_MAX, "v.training.sessions").default([]),
  })
  .superRefine((v, ctx) => {
    if ((v.priceUnit === "quote") !== (v.priceCents === null))
      ctx.addIssue({ code: "custom", path: ["priceCents"], message: "v.training.price" });
    if ((v.id === undefined) !== (v.expectedUpdatedAt === undefined))
      ctx.addIssue({ code: "custom", path: ["expectedUpdatedAt"], message: "v.training.version" });
    const issue = editionIssue(v, Date.now());
    if (issue) ctx.addIssue({ code: "custom", path: ["sessions"], message: `v.training.${issue}` });
  });
export type EditionInput = z.infer<typeof editionInput>;

const reason = z
  .string("v.training.reason")
  .trim()
  .min(1, "v.training.reason")
  .max(2000, "v.training.reasonMax");

/** submit / cancel of a course or edition; `reason` only to cancel an edition. */
export const listingActionInput = z
  .strictObject({
    kind: z.enum(["course", "edition"]),
    id: z.uuid(),
    action: z.enum(["submit", "cancel"]),
    expectedUpdatedAt: version,
    reason: reason.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.action === "cancel" && (v.kind !== "edition" || v.reason === undefined))
      ctx.addIssue({ code: "custom", path: ["reason"], message: "v.training.reason" });
    if (v.action === "submit" && v.reason !== undefined)
      ctx.addIssue({ code: "custom", path: ["reason"], message: "v.training.reasonNotAllowed" });
  });
export type ListingActionInput = z.infer<typeof listingActionInput>;

/** Platform admin decision; a note is required except to publish / review favourably. */
export const reviewInput = z
  .strictObject({
    kind: z.enum(TRAINING_REVIEW_KINDS),
    id: z.uuid(),
    decision: z.enum(["reviewed", "published", "changes", "rejected", "suspended"]),
    expectedUpdatedAt: version,
    note: z.string().trim().max(2000, "v.training.reasonMax").optional(),
  })
  .superRefine((v, ctx) => {
    const allowed: readonly string[] =
      v.kind === "provider" ? TRAINING_PROVIDER_DECISIONS : TRAINING_LISTING_DECISIONS;
    if (!allowed.includes(v.decision))
      ctx.addIssue({ code: "custom", path: ["decision"], message: "v.training.decision" });
    if (v.decision !== "reviewed" && v.decision !== "published" && !v.note)
      ctx.addIssue({ code: "custom", path: ["note"], message: "v.training.reason" });
  });
export type ReviewInput = z.infer<typeof reviewInput>;

// --- Professional ---------------------------------------------------------------------------------

export const favoriteInput = z.strictObject({ courseId: z.uuid() });

export const requestInput = z
  .strictObject({
    courseId: z.uuid(),
    editionId: z.uuid().optional(),
    kind: z.enum(TRAINING_REQUEST_KINDS),
    applicantName: text(180, "v.training.applicantName"),
    note: optionalText(3000, "v.training.note"),
    units: z.number().int().min(1).max(UNITS_MAX).default(1),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "seat" && !v.editionId)
      ctx.addIssue({ code: "custom", path: ["editionId"], message: "v.training.edition" });
  });
export type RequestInput = z.infer<typeof requestInput>;

/**
 * One request transition. A reason exactly for rejected/cancelled; accepting needs the offer id the
 * professional read and `acceptTerms: true`; finishing needs the outcome; offering a `quote` edition
 * needs the agreed total. The server decides the actor.
 */
export const transitionInput = z
  .strictObject({
    requestId: z.uuid(),
    to: z.enum(TRAINING_REQUEST_STATUSES).exclude(["received"]),
    expectedUpdatedAt: version,
    reason: reason.optional(),
    offerId: z.uuid().optional(),
    acceptTerms: z.literal(true, "v.training.acceptTerms").optional(),
    outcome: z.enum(TRAINING_OUTCOMES).optional(),
    quoteTotalCents: z.number().int().min(0).max(QUOTE_TOTAL_CENTS_MAX).optional(),
  })
  .superRefine((v, ctx) => {
    const needsReason = v.to === "rejected" || v.to === "cancelled";
    if (needsReason && v.reason === undefined)
      ctx.addIssue({ code: "custom", path: ["reason"], message: "v.training.reason" });
    if (!needsReason && v.reason !== undefined)
      ctx.addIssue({ code: "custom", path: ["reason"], message: "v.training.reasonNotAllowed" });
    if (v.to === "accepted") {
      if (!v.offerId)
        ctx.addIssue({ code: "custom", path: ["offerId"], message: "v.training.offer" });
      if (!v.acceptTerms)
        ctx.addIssue({ code: "custom", path: ["acceptTerms"], message: "v.training.acceptTerms" });
    } else if (v.offerId !== undefined || v.acceptTerms !== undefined) {
      ctx.addIssue({ code: "custom", path: ["offerId"], message: "v.training.offer" });
    }
    if ((v.to === "finished") !== (v.outcome !== undefined))
      ctx.addIssue({ code: "custom", path: ["outcome"], message: "v.training.outcome" });
    if (v.quoteTotalCents !== undefined && v.to !== "offered")
      ctx.addIssue({ code: "custom", path: ["quoteTotalCents"], message: "v.training.quote" });
  });
export type TransitionInput = z.infer<typeof transitionInput>;

export const messageInput = z.strictObject({
  requestId: z.uuid(),
  body: text(3000, "v.training.message"),
});
export type MessageInput = z.infer<typeof messageInput>;

/** POST body: one of the write operations, discriminated by `op`. */
export const trainingWrite = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("provider"), input: providerInput }),
  z.strictObject({ op: z.literal("course"), input: courseInput }),
  z.strictObject({ op: z.literal("edition"), input: editionInput }),
  z.strictObject({ op: z.literal("listing"), input: listingActionInput }),
  z.strictObject({ op: z.literal("review"), input: reviewInput }),
  z.strictObject({ op: z.literal("favorite"), input: favoriteInput }),
  z.strictObject({ op: z.literal("request"), input: requestInput }),
  z.strictObject({ op: z.literal("transition"), input: transitionInput }),
  z.strictObject({ op: z.literal("message"), input: messageInput }),
]);
export type TrainingWrite = z.infer<typeof trainingWrite>;
