import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  MembershipRow,
  OrganizationRole,
  OrganizationRow,
  ProfileRow,
} from "@/types/database";

export interface Membership {
  role: OrganizationRole;
  organization: OrganizationRow;
}

export interface SessionActor {
  id: string;
  profile: ProfileRow;
  memberships: Membership[];
}

/**
 * Current actor for rendering decisions, read once per request. Identity comes from the
 * verified JWT (getClaims); roles come from the database under RLS. UI decisions based on
 * this are convenience only — Edge Functions and RLS enforce authorization.
 */
export const getSessionActor = cache(async (): Promise<SessionActor | null> => {
  const supabase = await createServerSupabase();
  const { data: claimsData } = await supabase.auth.getClaims();
  const sub = claimsData?.claims?.sub;
  if (typeof sub !== "string") return null;

  const [profileResult, membershipResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, account_type, platform_role, preferred_locale")
      .eq("id", sub)
      .maybeSingle()
      .overrideTypes<ProfileRow, { merge: false }>(),
    supabase
      .from("organization_members")
      .select("role, organizations ( id, name, type, country )")
      .eq("profile_id", sub)
      .overrideTypes<MembershipRow[], { merge: false }>(),
  ]);
  if (profileResult.error || !profileResult.data) return null;

  return {
    id: sub,
    profile: profileResult.data,
    memberships: (membershipResult.data ?? []).map((m) => ({
      role: m.role,
      organization: m.organizations,
    })),
  };
});

export async function requireSessionActor(): Promise<SessionActor> {
  const actor = await getSessionActor();
  if (!actor) redirect("/login");
  return actor;
}

const ROLE_RANK: Record<OrganizationRole, number> = { admin: 0, manager: 1, member: 2 };

/**
 * V0: one active organization per user (the highest-role membership). Multi-organization
 * switching is NEXT.
 */
/** The membership the organization pages act on: the highest role (V0, one active organization). */
export const primaryMembership = (actor: SessionActor) =>
  [...actor.memberships].sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role])[0];

export async function requireOrganizationContext() {
  const actor = await requireSessionActor();
  const membership = primaryMembership(actor);
  if (!membership) redirect("/app/professional");
  return {
    actor,
    organization: membership.organization,
    role: membership.role,
    canManage: membership.role === "admin" || membership.role === "manager",
  };
}
