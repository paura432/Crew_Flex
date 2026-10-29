import { redirect } from "next/navigation";
import { isStaffingAgency } from "@/domain/recruiter";
import { primaryMembership, requireSessionActor } from "@/server/session";

export default async function AppIndex() {
  const actor = await requireSessionActor();
  // Platform admins start in «Administración», as in v1.8; the switcher reaches the other views.
  if (actor.profile.platform_role === "platform_admin") redirect("/app/admin");
  const membership = primaryMembership(actor);
  // A staffing agency's «Resumen» is its «Espacio recruiter» (v1.8 «ESPACIO RECRUITER», BR-27).
  redirect(
    !membership
      ? "/app/professional"
      : isStaffingAgency(membership.organization.type)
        ? "/app/recruiter"
        : "/app/organization",
  );
}
