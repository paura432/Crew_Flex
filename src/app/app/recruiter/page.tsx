import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("recruiter") };
}

/**
 * «Recruiter» view of the platform-admin switcher: a «coming later» placeholder (owner, 2026-10-22).
 * The workspace is LATER in V1_SCOPE and its model (D-12) is provisional — no logic here.
 */
export default async function RecruiterPage() {
  const actor = await requireSessionActor();
  if (actor.profile.platform_role !== "platform_admin") notFound();
  const t = await getTranslations("recruiter");

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
      <StateMessage title={t("soonTitle")} description={t("soonBody")} />
    </>
  );
}
