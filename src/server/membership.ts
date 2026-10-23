// The acting organization of a user (V0: one active organization). Pure — no I/O, no `server-only` — so the
// proxy (BR-27: who may open «Espacio recruiter») and the pages decide with the same rule.
import type { OrganizationRole } from "@/types/database";

const ROLE_RANK: Record<OrganizationRole, number> = { admin: 0, manager: 1, member: 2 };

/**
 * The membership the organization pages act on: the highest role (V0, one active organization; multi-organization
 * switching is NEXT); ties broken by organization id so the acting organization never flips between requests.
 */
export const actingMembership = <
  M extends { role: OrganizationRole; organization: { id: string } },
>(actor: {
  memberships: M[];
}): M | undefined =>
  [...actor.memberships].sort(
    (a, b) =>
      ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.organization.id.localeCompare(b.organization.id),
  )[0];
