import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { isStaffingAgency } from "@/domain/recruiter";
import { OrganizationOverview } from "@/features/requirements/components/OrganizationOverview";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("organization") };
}

/** The organization's «Resumen»; a staffing agency's is its «Espacio recruiter» (v1.8, BR-27). */
export default async function OrganizationDashboard() {
  const [{ organization, canManage }, t] = await Promise.all([
    requireOrganizationContext(),
    getTranslations("organization.dashboard"),
  ]);
  if (isStaffingAgency(organization.type)) redirect("/app/recruiter");
  return (
    <OrganizationOverview
      organization={organization}
      canManage={canManage}
      eyebrow={organization.name}
      title={t("title")}
      description={t("description")}
    />
  );
}
