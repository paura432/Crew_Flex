// Recruiter: an agency's represented clients (v1.8 «Cartera de clientes», Company2.jsx:211; D-12 provisional model,
// docs/product/RECRUITER_MODEL.md; LOCAL 20261024500000; BR-27, T-130…T-136).
//   GET   /represented-clients?organizationId=<uuid> → { clients } of that organization, newest first (≤ 200,
//         revoked included): every member reads them (RLS); 403 without a membership
//   GET   /represented-clients?view=review           → { clients } of every agency for a platform admin, pending
//         first (≤ 200), each with the agency's name and `ownAgency` (the reviewer belongs to it: not theirs to
//         activate)
//   POST  /represented-clients { organizationId, name, contactEmail? } → 201 { client } pending
//         (admin/manager of a staffing agency — role from the DB here, role AND type re-checked by the RPC)
//   PATCH /represented-clients { id, action: "revoke" }           → the agency's admin/manager (final)
//   PATCH /represented-clients { id, action: "activate", note }   → a platform admin, with evidence (never for an
//         agency they belong, belonged to or acted for)
// Every write is one SECURITY DEFINER RPC (role in its body, audited with this request id); the function acts with
// the caller's JWT, no service role. The client's contact e-mail never leaves the agency and the platform admins.
import { z } from "zod";
import { type Actor, requireActor, requireOrganizationRole } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import { parseJsonBody, parseQuery } from "../_shared/validation.ts";
import { REPRESENTATION_STATUSES } from "../../../src/domain/recruiter.ts";
import {
  addRepresentedClientInput,
  listRepresentedClientsQuery,
  representedClientActionInput,
} from "../../../src/lib/validation/recruiter.ts";
import type {
  RepresentationReviewListResponse,
  RepresentedClient,
  RepresentedClientListResponse,
  RepresentedClientResponse,
} from "../../../src/types/api.ts";

export const LIST_LIMIT = 200;

export const CLIENT_SELECT =
  "id, agency_id, name, contact_email, status, created_at, activated_at, revoked_at";

const iso = (value: string) => new Date(value).toISOString();

const clientRow = z.object({
  id: z.string(),
  agency_id: z.string(),
  name: z.string(),
  contact_email: z.string().nullable(),
  status: z.enum(REPRESENTATION_STATUSES),
  created_at: z.string(),
  activated_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
});

export function toRepresentedClient(raw: unknown): RepresentedClient {
  const r = clientRow.parse(raw);
  return {
    id: r.id,
    organizationId: r.agency_id,
    name: r.name,
    contactEmail: r.contact_email,
    status: r.status,
    createdAt: iso(r.created_at),
    activatedAt: r.activated_at ? iso(r.activated_at) : null,
    revokedAt: r.revoked_at ? iso(r.revoked_at) : null,
  };
}

const decisionRow = z.object({ id: z.string(), status: z.enum(REPRESENTATION_STATUSES) });

/** The RPCs answer one row: the id and the new status (nothing else leaves). */
export function toDecision(raw: unknown): RepresentedClientResponse["client"] {
  const r = decisionRow.parse(Array.isArray(raw) ? raw[0] : raw);
  return { id: r.id, status: r.status };
}

/** The platform role from the database (RLS: own row), never from the JWT metadata or the body. */
async function isPlatformAdmin(actor: Actor): Promise<boolean> {
  const { data, error } = await actor.client
    .from("profiles")
    .select("platform_role")
    .eq("id", actor.id)
    .maybeSingle();
  if (error) throw fromDatabaseError(error);
  return data?.platform_role === "platform_admin";
}

const withAgency = z.object({ organizations: z.object({ name: z.string() }) });

export const handler = createHandler("represented-clients", {
  GET: async (ctx) => {
    const actor = await requireActor(ctx);
    const query = parseQuery(ctx.url, listRepresentedClientsQuery);

    if ("view" in query) {
      if (!(await isPlatformAdmin(actor))) throw new ApiError("FORBIDDEN");
      const [clients, own] = await Promise.all([
        actor.client
          .from("represented_clients")
          .select(`${CLIENT_SELECT}, organizations ( name )`)
          .order("status", { ascending: true }) // enum order: pending first
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .limit(LIST_LIMIT),
        actor.client
          .from("organization_members")
          .select("organization_id")
          .eq("profile_id", actor.id),
      ]);
      if (clients.error) throw fromDatabaseError(clients.error);
      if (own.error) throw fromDatabaseError(own.error);
      const mine = new Set((own.data ?? []).map((m) => String(m.organization_id)));
      return {
        data: {
          clients: (clients.data ?? []).map((raw) => {
            const client = toRepresentedClient(raw);
            return {
              ...client,
              agencyName: withAgency.parse(raw).organizations.name,
              ownAgency: mine.has(client.organizationId),
            };
          }),
        } satisfies RepresentationReviewListResponse,
      };
    }

    await requireOrganizationRole(actor, query.organizationId, ["admin", "manager", "member"]);
    const { data, error } = await actor.client
      .from("represented_clients")
      .select(CLIENT_SELECT)
      .eq("agency_id", query.organizationId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(LIST_LIMIT);
    if (error) throw fromDatabaseError(error);
    return {
      data: {
        clients: (data ?? []).map(toRepresentedClient),
      } satisfies RepresentedClientListResponse,
    };
  },

  POST: async (ctx) => {
    const actor = await requireActor(ctx);
    const input = await parseJsonBody(ctx.req, addRepresentedClientInput);
    await requireOrganizationRole(actor, input.organizationId, ["admin", "manager"]);
    const { data, error } = await actor.client.rpc("add_represented_client", {
      p_organization_id: input.organizationId,
      p_name: input.name,
      p_contact_email: input.contactEmail ?? null,
      p_request_id: ctx.requestId,
    });
    // 42501 → 403 (not a staffing agency) · 22023 → 400 · 23505 → 409 (same live name) · 55000 → 409 (cap)
    if (error) throw fromDatabaseError(error);
    return { status: 201, data: { client: toDecision(data) } satisfies RepresentedClientResponse };
  },

  PATCH: async (ctx) => {
    const actor = await requireActor(ctx);
    const input = await parseJsonBody(ctx.req, representedClientActionInput);
    if (input.action === "activate") {
      if (!(await isPlatformAdmin(actor))) throw new ApiError("FORBIDDEN");
      const { data, error } = await actor.client.rpc("activate_represented_client", {
        p_client_id: input.id,
        p_note: input.note,
        p_request_id: ctx.requestId,
      });
      // 42501 → 403 (own agency) · P0002 → 404 · 55000 → 409 (not pending, no longer an agency) · 22023 → 400
      if (error) throw fromDatabaseError(error);
      return { data: { client: toDecision(data) } satisfies RepresentedClientResponse };
    }
    // Revoke: the client as the caller reads it (RLS: members of its agency) — hidden and missing are the same 404.
    const { data: row, error: readError } = await actor.client
      .from("represented_clients")
      .select("agency_id")
      .eq("id", input.id)
      .maybeSingle();
    if (readError) throw fromDatabaseError(readError);
    if (!row) throw new ApiError("NOT_FOUND");
    await requireOrganizationRole(actor, String(row.agency_id), ["admin", "manager"]);
    const { data, error } = await actor.client.rpc("revoke_represented_client", {
      p_client_id: input.id,
      p_request_id: ctx.requestId,
    });
    if (error) throw fromDatabaseError(error); // 42501 → 403 (role lost meanwhile)
    return { data: { client: toDecision(data) } satisfies RepresentedClientResponse };
  },
});

if (import.meta.main) Deno.serve(handler);
