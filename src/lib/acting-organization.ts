import type { OrganizationRole } from "@/types/database";

const ROLE_RANK: Record<OrganizationRole, number> = { admin: 0, manager: 1, member: 2 };

/**
 * V0: one active organization per user — the highest-role membership, ties broken by organization id
 * so it never flips between requests. One rule for the pages (`primaryMembership`) and the proxy's
 * detail-page check (src/lib/supabase/detail-gate.ts).
 */
export const compareActing = (
  a: { role: OrganizationRole; organizationId: string },
  b: { role: OrganizationRole; organizationId: string },
) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.organizationId.localeCompare(b.organizationId);

/** The organization the organization pages act on, or undefined without a membership. */
export const actingOrganizationId = (
  memberships: readonly { role: OrganizationRole; organizationId: string }[],
) => [...memberships].sort(compareActing)[0]?.organizationId;
