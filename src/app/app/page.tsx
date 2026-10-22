import { redirect } from "next/navigation";
import { requireSessionActor } from "@/server/session";

export default async function AppIndex() {
  const actor = await requireSessionActor();
  // Platform admins start in «Administración», as in v1.8; the switcher reaches the other views.
  if (actor.profile.platform_role === "platform_admin") redirect("/app/admin");
  redirect(actor.memberships.length > 0 ? "/app/organization" : "/app/professional");
}
