import { redirect } from "next/navigation";
import { requireSessionActor } from "@/server/session";

export default async function AppIndex() {
  const actor = await requireSessionActor();
  redirect(actor.memberships.length > 0 ? "/app/organization" : "/app/professional");
}
