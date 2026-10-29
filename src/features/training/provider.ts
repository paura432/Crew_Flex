import "server-only";
import { notFound } from "next/navigation";
import { isTrainingEnabled } from "@/server/feature-flags";
import { primaryMembership, requireSessionActor } from "@/server/session";

/**
 * The organization a provider page acts on: the caller's acting organization, only for its admin/manager
 * (ADR-003 decision 1). Anything else is a 404; the RPCs re-check the role on their own.
 */
export async function requireTrainingProvider() {
  if (!(await isTrainingEnabled())) notFound();
  const actor = await requireSessionActor();
  const membership = primaryMembership(actor);
  if (!membership || !["admin", "manager"].includes(membership.role)) notFound();
  return { actor, organization: membership.organization };
}
