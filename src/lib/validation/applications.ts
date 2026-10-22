// Inputs of the `opportunities` and `applications` Edge Functions (M07/M08, owner 2026-10-22).
// Messages are i18n keys (`v.*`). Strict objects: identity (user, role, organization role) never comes
// from the body (S-2). Deno-compatible imports.
import { APPLICATION_STATUSES, REASON_MAX } from "../../domain/applications.ts";
import { URGENCIES } from "../../domain/work-requirement.ts";
import { z } from "./zod.ts";

export const OPPORTUNITIES_PAGE_SIZE = 20;

export const listOpportunitiesQuery = z.strictObject({
  id: z.uuid("v.requirement.id").optional(),
  /** v1.8 filter pills «Planificado / Urgente / AOG». */
  urgency: z.enum(URGENCIES).optional(),
  /** v1.8 «Compatibles»: only the opportunities the caller is eligible for now. */
  eligible: z.enum(["1"]).optional(),
  /**
   * v1.8 «Posible en descanso» (BR-14.1): only the ones that publishing rest days would open. With
   * `eligible=1` too, either kind (the two never overlap).
   */
  rest: z.enum(["1"]).optional(),
  /** v1.8 «Buscar oportunidad»: title, base or organization name. */
  q: z.string().trim().max(80).optional(),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(OPPORTUNITIES_PAGE_SIZE),
});
export type ListOpportunitiesQuery = z.infer<typeof listOpportunitiesQuery>;

export const listApplicationsQuery = z.strictObject({
  /** Organization side: the applications of one requirement (admin/manager). */
  requirementId: z.uuid("v.requirement.id").optional(),
  /** Organization side: counters per status (dashboard). */
  organizationId: z.uuid().optional(),
  view: z.enum(["counts"]).optional(),
});
export type ListApplicationsQuery = z.infer<typeof listApplicationsQuery>;

/** v1.8 «Autorizo compartir este expediente con la organización de la oferta» is required. */
export const applyInput = z.strictObject({
  requirementId: z.uuid("v.requirement.id"),
  shareConsent: z.literal(true, "v.application.consent"),
});
export type ApplyInput = z.infer<typeof applyInput>;

const reason = z
  .string("v.application.reason")
  .trim()
  .min(1, "v.application.reason")
  .max(REASON_MAX, "v.application.reasonMax");

/**
 * One transition. A reason exactly for rejected/cancelled; accepting needs the proposal id the
 * technician saw and an explicit `acceptTerms: true` (R-08). The server decides the actor.
 */
export const transitionInput = z
  .strictObject({
    applicationId: z.uuid("v.application.id"),
    to: z.enum(APPLICATION_STATUSES).exclude(["received"]),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    reason: reason.optional(),
    proposalId: z.uuid("v.application.proposal").optional(),
    acceptTerms: z.literal(true, "v.application.acceptTerms").optional(),
  })
  .superRefine((v, ctx) => {
    const needsReason = v.to === "rejected" || v.to === "cancelled";
    if (needsReason && v.reason === undefined)
      ctx.addIssue({ code: "custom", path: ["reason"], message: "v.application.reason" });
    if (!needsReason && v.reason !== undefined)
      ctx.addIssue({ code: "custom", path: ["reason"], message: "v.application.reasonNotAllowed" });
    if (v.to === "accepted") {
      if (!v.proposalId)
        ctx.addIssue({ code: "custom", path: ["proposalId"], message: "v.application.proposal" });
      if (!v.acceptTerms)
        ctx.addIssue({
          code: "custom",
          path: ["acceptTerms"],
          message: "v.application.acceptTerms",
        });
    } else if (v.proposalId !== undefined || v.acceptTerms !== undefined) {
      ctx.addIssue({ code: "custom", path: ["proposalId"], message: "v.application.proposal" });
    }
  });
export type TransitionInput = z.infer<typeof transitionInput>;
