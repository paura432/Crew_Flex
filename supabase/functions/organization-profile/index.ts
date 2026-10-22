// The organization's own data («Organización»; OD-5 default = v1.8 connected, LOCAL 20261023500100).
//   GET   /organization-profile?organizationId=…  → { organization, canEdit, activity } for any member
//   PATCH /organization-profile { organizationId, expectedUpdatedAt, name, type, country, taxId, taxAddress }
//         → RPC update_organization_profile (SECURITY INVOKER: RLS lets only the organization's admin
//           write; optimistic version → 409; any data change returns the review to pending, audited)
// The organization id is the TARGET; who may act is read from organization_members under RLS, never
// from the body or the token. The review status is never writable here (no column grant).
import { z } from "zod";
import { requireActor, requireOrganizationRole, type Actor } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { ORGANIZATION_SELECT, toOrganization } from "../_shared/organizations.ts";
import { parseJsonBody, parseQuery } from "../_shared/validation.ts";
import {
  organizationIdQuery,
  updateOrganizationInput,
} from "../../../src/lib/validation/organization.ts";
import type {
  OrganizationActivityItem,
  OrganizationProfileResponse,
} from "../../../src/types/api.ts";

export const ACTIVITY_LIMIT = 15;

const activityRow = z.object({ action: z.string(), created_at: z.string() });

/** Only the action code and the time: no actor, entity or metadata reaches the organization's screen. */
export const toActivity = (raw: unknown): OrganizationActivityItem => {
  const r = activityRow.parse(raw);
  return { action: r.action, at: new Date(r.created_at).toISOString() };
};

async function readProfile(
  actor: Actor,
  organizationId: string,
): Promise<OrganizationProfileResponse> {
  const role = await requireOrganizationRole(actor, organizationId, ["member", "manager", "admin"]);
  const { data, error } = await actor.client
    .from("organizations")
    .select(ORGANIZATION_SELECT)
    .eq("id", organizationId)
    .maybeSingle();
  if (error) throw fromDatabaseError(error);
  if (!data) throw new ApiError("NOT_FOUND");
  let activity: OrganizationActivityItem[] | null = null;
  if (role === "admin") {
    // RLS audit_events_select: an organization admin reads its own organization's rows only.
    const trail = await actor.client
      .from("audit_events")
      .select("action, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(ACTIVITY_LIMIT);
    if (trail.error) throw fromDatabaseError(trail.error);
    activity = (trail.data ?? []).map(toActivity);
  }
  return { organization: toOrganization(data), canEdit: role === "admin", activity };
}

export const handler = createHandler("organization-profile", {
  GET: async (ctx) => {
    const actor = await requireActor(ctx);
    const { organizationId } = parseQuery(ctx.url, organizationIdQuery);
    return {
      data: (await readProfile(actor, organizationId)) satisfies OrganizationProfileResponse,
    };
  },

  PATCH: async (ctx) => {
    const actor = await requireActor(ctx);
    const input = await parseJsonBody(ctx.req, updateOrganizationInput);
    await requireOrganizationRole(actor, input.organizationId, ["admin"]); // 403 before any write
    const { error } = await actor.client.rpc("update_organization_profile", {
      p_organization_id: input.organizationId,
      p_expected_updated_at: input.expectedUpdatedAt,
      p_name: input.name,
      p_type: input.type,
      p_country: input.country,
      p_tax_id: input.taxId,
      p_tax_address: input.taxAddress,
    });
    // CF412 → 409 (changed since loaded) · 42501 → 403 · 22023 → 400
    if (error) throw fromDatabaseError(error);
    return {
      data: (await readProfile(actor, input.organizationId)) satisfies OrganizationProfileResponse,
    };
  },
});

if (import.meta.main) Deno.serve(handler);
