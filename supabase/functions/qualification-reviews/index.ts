// Qualification review by a platform admin (phase 6; OD-3 / D-01 APPROVAL CHECKPOINT).
//   GET  /qualification-reviews  → { pending (active + pending, oldest first, ≤ 100), recent (≤ 20 decisions) }
//   POST /qualification-reviews { qualificationId, decision: verified|rejected, expectedUpdatedAt, note }
//        (the note is required for both decisions since 20261027300000 — v1.8 evidence, T-170)
//        → RPC review_qualification (SECURITY DEFINER: platform admin from the DB, no self-review,
//          pending → decision only, row lock, audited with this request id)
// Fails closed: unless the QUALIFICATION_REVIEW_ENABLED secret is "true" every call is 404, so an
// accidental deploy exposes nothing before the owner approves who verifies (OPEN_DECISIONS OD-3).
// The reviewer's role is read from profiles.platform_role (RLS: own row) — never from the JWT
// metadata or the body. Reads run under the reviewer's JWT (RLS grants platform admins read access).
import { z } from "zod";
import { requireActor, type Actor } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler, type RequestContext } from "../_shared/http.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import {
  QUALIFICATION_CATEGORIES,
  VERIFICATION_STATUSES,
} from "../../../src/domain/qualification.ts";
import { REVIEW_DECISIONS, reviewQualificationInput } from "../../../src/lib/validation/review.ts";
import type {
  ReviewDecisionResponse,
  ReviewHistoryItem,
  ReviewQueueItem,
  ReviewQueueResponse,
} from "../../../src/types/api.ts";

export const reviewEnabled = () => Deno.env.get("QUALIFICATION_REVIEW_ENABLED") === "true";

async function requireReviewer(ctx: RequestContext): Promise<Actor> {
  if (!reviewEnabled()) throw new ApiError("NOT_FOUND", "This service is not available.");
  const actor = await requireActor(ctx);
  const { data, error } = await actor.client
    .from("profiles")
    .select("platform_role")
    .eq("id", actor.id)
    .maybeSingle();
  if (error) throw fromDatabaseError(error);
  if (data?.platform_role !== "platform_admin") throw new ApiError("FORBIDDEN");
  return actor;
}

const queueRow = z.object({
  id: z.string(),
  issued_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  qualification_types: z.object({
    code: z.string(),
    name: z.string(),
    category: z.enum(QUALIFICATION_CATEGORIES),
  }),
  technician_profiles: z.object({
    profile_id: z.string(),
    base_location: z.string().nullable(),
    general_restrictions: z.string().nullable(),
    profiles: z.object({ display_name: z.string() }),
  }),
});

export function toQueueItem(raw: unknown): ReviewQueueItem {
  const r = queueRow.parse(raw);
  return {
    id: r.id,
    professional: {
      id: r.technician_profiles.profile_id,
      displayName: r.technician_profiles.profiles.display_name,
      baseLocation: r.technician_profiles.base_location,
      restrictions: r.technician_profiles.general_restrictions,
    },
    type: r.qualification_types,
    issuedAt: r.issued_at,
    expiresAt: r.expires_at,
    declaredAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

const historyRow = z.object({
  entity_id: z.string(),
  actor_profile_id: z.string().nullable(),
  created_at: z.string(),
  metadata: z.object({
    verification_status: z.enum(REVIEW_DECISIONS),
    note_provided: z.boolean(),
    request_id: z.string().nullable().optional(),
  }),
});

export function toHistoryItem(raw: unknown): ReviewHistoryItem {
  const r = historyRow.parse(raw);
  return {
    qualificationId: r.entity_id,
    reviewerId: r.actor_profile_id,
    decision: r.metadata.verification_status,
    noteProvided: r.metadata.note_provided,
    requestId: r.metadata.request_id ?? null,
    at: new Date(r.created_at).toISOString(),
  };
}

const decisionRow = z.object({
  id: z.string(),
  verification_status: z.enum(VERIFICATION_STATUSES),
  reviewed_at: z.string(),
});

export const handler = createHandler("qualification-reviews", {
  GET: async (ctx) => {
    const actor = await requireReviewer(ctx);
    const [pending, recent] = await Promise.all([
      actor.client
        .from("technician_qualifications")
        .select(
          "id, issued_at, expires_at, created_at, updated_at, qualification_types!inner ( code, name, category ), technician_profiles!inner ( profile_id, base_location, general_restrictions, profiles!inner ( display_name ) )",
        )
        .eq("verification_status", "pending")
        .eq("status", "active")
        .neq("technician_profile_id", actor.id) // nobody reviews their own declaration
        .order("created_at", { ascending: true })
        .limit(100),
      actor.client
        .from("audit_events")
        .select("entity_id, actor_profile_id, created_at, metadata")
        .eq("action", "qualification.reviewed")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (pending.error) throw fromDatabaseError(pending.error);
    if (recent.error) throw fromDatabaseError(recent.error);
    return {
      data: {
        pending: (pending.data ?? []).map(toQueueItem),
        recent: (recent.data ?? []).map(toHistoryItem),
      } satisfies ReviewQueueResponse,
    };
  },

  POST: async (ctx) => {
    const actor = await requireReviewer(ctx);
    const input = await parseJsonBody(ctx.req, reviewQualificationInput);
    const { data, error } = await actor.client.rpc("review_qualification", {
      p_qualification_id: input.qualificationId,
      p_decision: input.decision,
      p_expected_updated_at: input.expectedUpdatedAt,
      p_note: input.note,
      p_request_id: ctx.requestId,
    });
    // 42501 → 403 (not a reviewer / own) · P0002/0A000 → 404 · 55000 → 409 (decided or changed since loaded)
    if (error) throw fromDatabaseError(error);
    const row = decisionRow.parse(Array.isArray(data) ? data[0] : data);
    return {
      data: {
        qualification: {
          id: row.id,
          verificationStatus: row.verification_status,
          reviewedAt: new Date(row.reviewed_at).toISOString(),
        },
      } satisfies ReviewDecisionResponse,
    };
  },
});

if (import.meta.main) Deno.serve(handler);
