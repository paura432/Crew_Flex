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
