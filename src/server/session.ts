import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { compareActing } from "@/lib/acting-organization";
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
  /** From the verified JWT claims (never the unverified cookie session); null if absent. */
  email: string | null;
  profile: ProfileRow;
  memberships: Membership[];
}

/**
 * A verified JWT whose profile row cannot be read (missing row, RLS or a failed query). Sending
 * the user to /login would loop: proxy.ts sends signed-in users straight back to /app.
 */
export class SessionProfileUnavailableError extends Error {
  constructor() {
    super("SESSION_PROFILE_UNAVAILABLE");
    this.name = "SessionProfileUnavailableError";
  }
}

/**
 * Current session for rendering decisions, read once per request. Identity comes from the
 * verified JWT (getClaims); roles come from the database under RLS. UI decisions based on
 * this are convenience only — Edge Functions and RLS enforce authorization.
 */
const readSession = cache(async (): Promise<{ sub: string | null; actor: SessionActor | null }> => {
  const supabase = await createServerSupabase();
  const { data: claimsData } = await supabase.auth.getClaims();
  const sub = claimsData?.claims?.sub;
  if (typeof sub !== "string") return { sub: null, actor: null };
  const email = claimsData?.claims?.email;

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
  if (profileResult.error || !profileResult.data) return { sub, actor: null };

  return {
    sub,
    actor: {
      id: sub,
      email: typeof email === "string" && email !== "" ? email : null,
      profile: profileResult.data,
      memberships: (membershipResult.data ?? []).map((m) => ({
        role: m.role,
        organization: m.organizations,
      })),
    },
  };
});

/** The actor, or null when signed out or when the profile cannot be read. */
export const getSessionActor = async (): Promise<SessionActor | null> =>
  (await readSession()).actor;

export async function requireSessionActor(): Promise<SessionActor> {
  const { sub, actor } = await readSession();
  if (actor) return actor;
  // Signed in without a readable profile: fail to the error boundary (src/app/error.tsx), not /login.
  if (sub) throw new SessionProfileUnavailableError();
  redirect("/login");
}

/**
 * The membership the organization pages act on: the highest role (V0, one active organization);
 * ties broken by organization id so the acting organization never flips between requests
 * (`compareActing`, shared with the proxy). Multi-organization switching is NEXT.
 */
export const primaryMembership = (actor: Pick<SessionActor, "memberships">) =>
  [...actor.memberships].sort((a, b) =>
    compareActing(
      { role: a.role, organizationId: a.organization.id },
      { role: b.role, organizationId: b.organization.id },
    ),
  )[0];

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
