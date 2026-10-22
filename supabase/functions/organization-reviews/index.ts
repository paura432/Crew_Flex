// Organization review by a platform admin («Registrar revisión»; OD-5 default = v1.8 connected
// `server/app.mjs:189`, LOCAL 20261023500100).
//   GET  /organization-reviews → { organizations } pending first, then by name (≤ 200), each with
//        `ownOrganization` (the reviewer is a member: they may not review it)
//   POST /organization-reviews { organizationId, expectedUpdatedAt, note }
//        → RPC review_organization (SECURITY DEFINER: platform admin from the DB, never an
//          organization the reviewer belongs to, pending only, the version the reviewer saw, fiscal
//          data complete, evidence kept apart, audited with this request id)
// The reviewer's role is read from profiles.platform_role (RLS: own row) — never from the JWT
// metadata or the body. Reads run under the reviewer's JWT (RLS grants platform admins read access).
// Not behind a flag: unlike the qualification review (OD-3) this is the OD-5 v1.8 default (T-15).
import { z } from "zod";
import { requireActor, type Actor } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler, type RequestContext } from "../_shared/http.ts";
import { ORGANIZATION_SELECT, toOrganization } from "../_shared/organizations.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import { ORGANIZATION_REVIEW_STATUSES } from "../../../src/domain/organization.ts";
import { reviewOrganizationInput } from "../../../src/lib/validation/organization.ts";
import type {
  OrganizationReviewListResponse,
  OrganizationReviewResponse,
} from "../../../src/types/api.ts";

export const LIST_LIMIT = 200;

async function requireReviewer(ctx: RequestContext): Promise<Actor> {
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

const decisionRow = z.object({
  id: z.string(),
  review_status: z.enum(ORGANIZATION_REVIEW_STATUSES),
  reviewed_at: z.string(),
});

export function toDecision(raw: unknown): OrganizationReviewResponse["organization"] {
  const r = decisionRow.parse(Array.isArray(raw) ? raw[0] : raw);
  return {
    id: r.id,
    reviewStatus: r.review_status,
    reviewedAt: new Date(r.reviewed_at).toISOString(),
  };
}

export const handler = createHandler("organization-reviews", {
  GET: async (ctx) => {
    const actor = await requireReviewer(ctx);
    const [organizations, own] = await Promise.all([
      actor.client
        .from("organizations")
        .select(ORGANIZATION_SELECT)
        .order("review_status", { ascending: true }) // enum order: pending first
        .order("name", { ascending: true })
        .order("id", { ascending: true })
        .limit(LIST_LIMIT),
      actor.client
        .from("organization_members")
        .select("organization_id")
        .eq("profile_id", actor.id),
    ]);
    if (organizations.error) throw fromDatabaseError(organizations.error);
    if (own.error) throw fromDatabaseError(own.error);
    const mine = new Set((own.data ?? []).map((m) => String(m.organization_id)));
    return {
      data: {
        organizations: (organizations.data ?? []).map((raw) => {
          const organization = toOrganization(raw);
          return { ...organization, ownOrganization: mine.has(organization.id) };
        }),
      } satisfies OrganizationReviewListResponse,
    };
  },

  POST: async (ctx) => {
    const actor = await requireReviewer(ctx);
    const input = await parseJsonBody(ctx.req, reviewOrganizationInput);
    const { data, error } = await actor.client.rpc("review_organization", {
      p_organization_id: input.organizationId,
      p_expected_updated_at: input.expectedUpdatedAt,
      p_note: input.note,
      p_request_id: ctx.requestId,
    });
    // 42501 → 403 (not a reviewer / own organization) · P0002 → 404 · 55000 → 409 (reviewed, changed
    // since loaded or incomplete) · 22023 → 400 (evidence)
    if (error) throw fromDatabaseError(error);
    return { data: { organization: toDecision(data) } satisfies OrganizationReviewResponse };
  },
});

if (import.meta.main) Deno.serve(handler);
