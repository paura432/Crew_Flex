import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "./errors.ts";
import type { RequestContext } from "./http.ts";
import { createUserClient } from "./supabase.ts";

export interface Actor {
  /** auth.users.id === profiles.id, taken from the verified JWT `sub`. Never from the body. */
  id: string;
  client: SupabaseClient;
}

export type OrganizationRole = "member" | "manager" | "admin";

function bearerToken(req: Request): string {
  const header = req.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match?.[1]) throw new ApiError("UNAUTHORIZED");
  return match[1];
}

/** Authenticates the request with the official SDK JWT verification (getClaims). */
export async function requireActor(ctx: RequestContext): Promise<Actor> {
  const token = bearerToken(ctx.req);
  const client = createUserClient(token);
  const { data, error } = await client.auth.getClaims(token);
  const sub = data?.claims?.sub;
  if (error || typeof sub !== "string" || data?.claims?.role !== "authenticated") {
    throw new ApiError("UNAUTHORIZED");
  }
  ctx.actorId = sub;
  return { id: sub, client };
}

/** Professionals only: the technician profile must exist for the actor (read under RLS). */
export async function requireTechnician(actor: Actor, message?: string): Promise<void> {
  const { data, error } = await actor.client
    .from("technician_profiles")
    .select("profile_id")
    .eq("profile_id", actor.id)
    .maybeSingle();
  if (error) throw new ApiError("INTERNAL_ERROR");
  if (!data) throw new ApiError("FORBIDDEN", message);
}

/**
 * Owner-controlled feature gate read from the database (`public.is_feature_enabled`, backed by
 * `app_private.feature_flags`). Off, unknown or unreadable → 404 "not available" (fails closed).
 */
export async function requireFeature(actor: Actor, name: "document_wallet"): Promise<void> {
  const { data, error } = await actor.client.rpc("is_feature_enabled", { p_name: name });
  if (error || data !== true) throw new ApiError("NOT_FOUND", "This service is not available.");
}

/** Authorization from the database (never from the client): actor's role in an organization. */
export async function requireOrganizationRole(
  actor: Actor,
  organizationId: string,
  allowed: OrganizationRole[],
): Promise<OrganizationRole> {
  const { data, error } = await actor.client
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("profile_id", actor.id)
    .maybeSingle();
  if (error) throw new ApiError("INTERNAL_ERROR");
  const role = data?.role as OrganizationRole | undefined;
  if (!role || !allowed.includes(role)) throw new ApiError("FORBIDDEN");
  return role;
}
