import { primaryMembership, type SessionActor } from "@/server/session";
import type { OrganizationRole, ProfileRow } from "@/types/database";

type SummaryKey = `accountType.${ProfileRow["account_type"]}` | `role.${OrganizationRole}`;

/**
 * Catalog keys (`domain.*`) for the shell's «who am I» line, as v1.8 showed the role next to the
 * person: the account type, then the role in the primary organization when there is one.
 */
export function accountSummaryKeys(
  actor: Pick<SessionActor, "profile" | "memberships">,
): SummaryKey[] {
  const membership = primaryMembership(actor);
  return [
    `accountType.${actor.profile.account_type}`,
    ...(membership ? [`role.${membership.role}` as const] : []),
  ];
}
