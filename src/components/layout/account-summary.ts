import { primaryMembership, type SessionActor } from "@/server/session";
import type { OrganizationRole, ProfileRow } from "@/types/database";

type SummaryKey =
  | `accountType.${ProfileRow["account_type"]}`
  | `role.${OrganizationRole}`
  | "platformRole.platform_admin";

/**
 * Catalog keys (`domain.*`) for the shell's «who am I» line, as v1.8 showed the role next to the
 * person: the account type, then the role in the primary organization when there is one. A platform
 * admin reads the platform role instead (X-13): «Administrador» alone was their role in their own
 * organization, not the platform one.
 */
export function accountSummaryKeys(
  actor: Pick<SessionActor, "profile" | "memberships">,
): SummaryKey[] {
  if (actor.profile.platform_role === "platform_admin") {
    return [`accountType.${actor.profile.account_type}`, "platformRole.platform_admin"];
  }
  const membership = primaryMembership(actor);
  return [
    `accountType.${actor.profile.account_type}`,
    ...(membership ? [`role.${membership.role}` as const] : []),
  ];
}
