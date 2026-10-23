import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { isStaffingAgency } from "@/domain/recruiter";
import { RepresentedClientsPanel } from "@/features/recruiter/components/RepresentedClientsPanel";
import { OrganizationOverview } from "@/features/requirements/components/OrganizationOverview";
import { primaryMembership, requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("recruiter") };
}

/**
 * «Espacio recruiter» (v2-24, ORG-08; v1.8 Dashboard «ESPACIO RECRUITER» with the same KPIs, and the «Cartera de
 * clientes» of Company2.jsx:211). For the members of a staffing agency (D-12 provisional model: an ordinary
 * organization that represents clients; BR-27). A platform admin's «Recruiter» view (D-13) shows their OWN account:
 * without an agency membership, a note says so. Anyone else: 404 (the proxy answers first).
 */
export default async function RecruiterPage() {
  const [actor, t] = await Promise.all([requireSessionActor(), getTranslations("recruiter")]);
  const membership = primaryMembership(actor);
  if (!membership || !isStaffingAgency(membership.organization.type)) {
    if (actor.profile.platform_role !== "platform_admin") notFound();
    return (
      <>
        <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
        <StateMessage title={t("noAgencyTitle")} description={t("noAgencyBody")} />
      </>
    );
  }
  const canManage = membership.role === "admin" || membership.role === "manager";
  return (
    <OrganizationOverview
      organization={membership.organization}
      canManage={canManage}
      eyebrow={t("eyebrow")}
      title={membership.organization.name}
      description={t("description")}
    >
      <RepresentedClientsPanel organizationId={membership.organization.id} canManage={canManage} />
    </OrganizationOverview>
  );
}
