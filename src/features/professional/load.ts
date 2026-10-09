import "server-only";
import { requireSessionActor } from "@/server/session";
import { getOwnProfessionalOverview } from "./api";

/** Session actor + own professional data (null when the account has no technician profile). */
export async function loadProfessionalContext() {
  const actor = await requireSessionActor();
  const overview = await getOwnProfessionalOverview(actor.id);
  return { actor, overview };
}
