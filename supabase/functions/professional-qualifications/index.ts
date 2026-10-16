// Professional qualifications — own declarations only (licences, type ratings, training, approvals).
//   GET    /professional-qualifications            → own qualifications with their catalog type
//   POST   /professional-qualifications { qualificationTypeId, issuedAt?, expiresAt? }   → 201, pending
//          (Idempotency-Key: a retried declaration returns the original row with 200, not a 409)
//   PATCH  /professional-qualifications?id=<uuid> { issuedAt, expiresAt, status }
//   DELETE /professional-qualifications?id=<uuid>
// Declaration ≠ verification: a professional can declare, edit the dates or withdraw, never verify.
// `verification_status` is not in any payload (strict Zod), not in any update (column grants), and
// the database sends a reviewed qualification back to `pending` when its dates change (trigger).
// The technician is ALWAYS the JWT subject; RLS (`technician_profile_id = auth.uid()`) is the second layer.
import { z } from "zod";
import { requireActor, type Actor } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { createdRow, idempotencyKey, parseJsonBody, parseQuery } from "../_shared/validation.ts";
import {
  QUALIFICATION_CATEGORIES,
  QUALIFICATION_STATUSES,
  VERIFICATION_STATUSES,
  type QualificationType,
} from "../../../src/domain/qualification.ts";
import {
  createQualificationInput,
  expiryIssueFor,
  qualificationIdQuery,
  updateQualificationInput,
} from "../../../src/lib/validation/professional.ts";
import type {
  Qualification,
  QualificationDeleteResponse,
  QualificationListResponse,
  QualificationResponse,
} from "../../../src/types/api.ts";

const SELECT =
  "id, status, issued_at, expires_at, verification_status, reviewed_at, updated_at, qualification_types!inner ( id, code, name, category, requires_expiry )";

const typeRow = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  category: z.enum(QUALIFICATION_CATEGORIES),
  requires_expiry: z.boolean(),
});

const row = z.object({
  id: z.string(),
  status: z.enum(QUALIFICATION_STATUSES),
  issued_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  verification_status: z.enum(VERIFICATION_STATUSES),
  reviewed_at: z.string().nullable(),
  updated_at: z.string(),
  qualification_types: typeRow,
});

export function toType(raw: unknown): QualificationType {
  const t = typeRow.parse(raw);
  return {
    id: t.id,
    code: t.code,
    name: t.name,
    category: t.category,
    requiresExpiry: t.requires_expiry,
  };
}

/**
 * `review_note` is not column-readable (organizations must not read it); the owner gets the reasons
 * through own_qualification_reviews() and they are merged by id.
 */
export function toQualification(raw: unknown, reviewNote: string | null = null): Qualification {
  const r = row.parse(raw);
  return {
    id: r.id,
    type: toType(r.qualification_types),
    status: r.status,
    issuedAt: r.issued_at,
    expiresAt: r.expires_at,
    verificationStatus: r.verification_status,
    reviewNote,
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

/** Professionals only: the technician profile must exist for the actor. */
async function requireTechnician(actor: Actor): Promise<void> {
  const { data, error } = await actor.client
    .from("technician_profiles")
    .select("profile_id")
    .eq("profile_id", actor.id)
    .maybeSingle();
  if (error) throw fromDatabaseError(error);
  if (!data) throw new ApiError("FORBIDDEN", "Only professional accounts declare qualifications.");
}

/** BR-2.7 against the catalog row (never against client-supplied flags). */
function requireExpiryRule(type: QualificationType, expiresAt: string | null): void {
  const issue = expiryIssueFor(type, expiresAt);
  if (issue) throw new ApiError("VALIDATION_ERROR", undefined, [issue]);
}

async function catalogType(actor: Actor, id: string): Promise<QualificationType> {
  const { data, error } = await actor.client
    .from("qualification_types")
    .select("id, code, name, category, requires_expiry")
    .eq("id", id)
    .maybeSingle();
  if (error) throw fromDatabaseError(error);
  if (!data) {
    throw new ApiError("VALIDATION_ERROR", undefined, [
      { path: "qualificationTypeId", message: "v.qualification.unknown" },
    ]);
  }
  return toType(data);
}

const noteRow = z.object({ qualification_id: z.string(), review_note: z.string() });

/** Reviewer reasons for the caller's own qualifications (owner-only DEFINER function). */
async function ownReviewNotes(actor: Actor): Promise<Map<string, string>> {
  const { data, error } = await actor.client.rpc("own_qualification_reviews");
  if (error) throw fromDatabaseError(error);
  return new Map(
    z
      .array(noteRow.passthrough())
      .parse(data ?? [])
      .map((r) => [r.qualification_id, r.review_note]),
  );
}

export const handler = createHandler("professional-qualifications", {
  GET: async (ctx) => {
    const actor = await requireActor(ctx);
    const [{ data, error }, notes] = await Promise.all([
      actor.client
        .from("technician_qualifications")
        .select(SELECT)
        .eq("technician_profile_id", actor.id)
        .limit(200),
      ownReviewNotes(actor),
    ]);
    if (error) throw fromDatabaseError(error);
    const qualifications = (data ?? [])
      .map((row) => toQualification(row, notes.get((row as { id: string }).id) ?? null))
      .sort((a, b) => a.type.code.localeCompare(b.type.code));
    return { data: { qualifications } satisfies QualificationListResponse };
  },

  POST: async (ctx) => {
    const actor = await requireActor(ctx);
    const input = await parseJsonBody(ctx.req, createQualificationInput);
    await requireTechnician(actor);
    const type = await catalogType(actor, input.qualificationTypeId);
    requireExpiryRule(type, input.expiresAt);
    // verification_status is left to its default ('pending'); the insert policy enforces it too.
    const created = await actor.client.rpc("declare_qualification", {
      p_idempotency_key: idempotencyKey(ctx.req),
      p_qualification_type_id: type.id,
      p_issued_at: input.issuedAt,
      p_expires_at: input.expiresAt,
    });
    if (created.error) throw fromDatabaseError(created.error); // 23505 → CONFLICT (already declared)
    const { id, replayed } = createdRow(created.data);
    const { data, error } = await actor.client
      .from("technician_qualifications")
      .select(SELECT)
      .eq("id", id)
      .eq("technician_profile_id", actor.id)
      .maybeSingle();
    if (error) throw fromDatabaseError(error);
    if (!data) throw new ApiError("NOT_FOUND"); // replay of a declaration removed since
    return {
      status: replayed ? 200 : 201,
      data: { qualification: toQualification(data) } satisfies QualificationResponse,
    };
  },

  PATCH: async (ctx) => {
    const actor = await requireActor(ctx);
    const { id } = parseQuery(ctx.url, qualificationIdQuery);
    const input = await parseJsonBody(ctx.req, updateQualificationInput);
    const existing = await actor.client
      .from("technician_qualifications")
      .select(SELECT)
      .eq("id", id)
      .eq("technician_profile_id", actor.id)
      .maybeSingle();
    if (existing.error) throw fromDatabaseError(existing.error);
    if (!existing.data) throw new ApiError("NOT_FOUND"); // missing or not owned look the same
    const current = toQualification(existing.data);
    if (input.status === "active") requireExpiryRule(current.type, input.expiresAt);

    const { data, error } = await actor.client
      .from("technician_qualifications")
      .update({ issued_at: input.issuedAt, expires_at: input.expiresAt, status: input.status })
      .eq("id", id)
      .eq("technician_profile_id", actor.id)
      .select(SELECT)
      .maybeSingle();
    if (error) throw fromDatabaseError(error);
    if (!data) throw new ApiError("NOT_FOUND");
    return { data: { qualification: toQualification(data) } satisfies QualificationResponse };
  },

  DELETE: async (ctx) => {
    const actor = await requireActor(ctx);
    const { id } = parseQuery(ctx.url, qualificationIdQuery);
    const { data, error } = await actor.client
      .from("technician_qualifications")
      .delete()
      .eq("id", id)
      .eq("technician_profile_id", actor.id)
      .select("id")
      .maybeSingle();
    if (error) throw fromDatabaseError(error);
    if (!data) throw new ApiError("NOT_FOUND");
    return { data: { deleted: true, id } satisfies QualificationDeleteResponse };
  },
});

if (import.meta.main) Deno.serve(handler);
