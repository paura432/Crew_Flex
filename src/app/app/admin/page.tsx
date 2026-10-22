import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { canOpenQualificationReview } from "@/server/feature-flags";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("admin") };
}

/**
 * «Administración» view of the platform-admin switcher (owner, 2026-10-22): only what already
 * exists — the qualification review, still behind OD-3, and the tools. 404 for anyone else.
 */
export default async function AdminHomePage() {
  const actor = await requireSessionActor();
  if (actor.profile.platform_role !== "platform_admin") notFound();
  const t = await getTranslations("admin.home");

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={t("reviewsTitle")}>
          {canOpenQualificationReview(actor.profile) ? (
            <ButtonLink href="/app/admin/verifications" variant="primary">
              {t("reviewsOpen")}
            </ButtonLink>
          ) : (
            <p className="text-sm text-muted">{t("reviewsOff")}</p>
          )}
        </Panel>
        <Panel title={t("toolsTitle")}>
          <ButtonLink href="/app/tools">{t("toolsOpen")}</ButtonLink>
        </Panel>
      </div>
    </>
  );
}
