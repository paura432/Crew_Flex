import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Metric } from "@/components/ui/Metric";
import { Panel } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { InviteForm } from "@/features/account/components/InviteForm";
import { getPlatformSummary } from "@/features/admin/api";
import { canOpenQualificationReview, isInvitationSignupRequired } from "@/server/feature-flags";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("admin") };
}

/**
 * «Administración» view of the platform-admin switcher (owner, 2026-10-22): the platform figures
 * (v1.8 «Tu plataforma, en cifras.», counts only — commissions are SCOPE OUT), sign-up invitations
 * (while the owner flag is on), the organization review, the audit trail, the qualification review
 * (still OD-3) and the tools. 404 for anyone else.
 */
export default async function AdminHomePage() {
  const actor = await requireSessionActor();
  if (actor.profile.platform_role !== "platform_admin") notFound();
  const [t, tInvite, summary, invitationOnly] = await Promise.all([
    getTranslations("admin.home"),
    getTranslations("account.invite"),
    getPlatformSummary(),
    isInvitationSignupRequired(),
  ]);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <section aria-labelledby="figures-heading" className="mb-8">
        <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">
          {t("figuresKicker")}
        </p>
        <h2 id="figures-heading" className="mt-1 text-lg font-semibold tracking-tight">
          {t("figuresTitle")}
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted">{t("figuresDescription")}</p>
        {!summary ? (
          <div className="mt-4">
            <StateMessage tone="danger" title={t("figuresError")} />
          </div>
        ) : (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              <Metric label={t("technicians")} value={summary.technicians} />
              <Metric label={t("organizations")} value={summary.organizations} />
              <Metric
                label={t("activeRequirements")}
                value={summary.activeRequirements}
                detail={t("activeRequirementsDetail")}
              />
              <Metric label={t("workingNow")} value={summary.workingNow} />
              <Metric
                label={t("aogWithVacancies")}
                value={summary.aogWithVacancies}
                tone={summary.aogWithVacancies > 0 ? "warn" : "neutral"}
              />
            </dl>
            <Panel title={t("demandTitle")} className="mt-4">
              <p className="mb-3 max-w-prose text-sm text-muted">{t("demandDescription")}</p>
              {summary.demand.length === 0 ? (
                <p className="text-sm text-muted">{t("demandEmpty")}</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {summary.demand.map(({ code, seats }) => (
                    <li key={code ?? "none"} className="flex justify-between gap-4 py-2">
                      <span className={code ? "font-mono font-semibold" : "font-semibold"}>
                        {code ?? t("demandNoLicence")}
                      </span>
                      <span className="tabular-nums">{t("seats", { count: seats })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )}
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {/* v1.8 «Invitar a la beta» (OD-8 default T-40): only while sign-up is by invitation. */}
        <Panel title={tInvite("title")} className="md:col-span-2">
          {invitationOnly ? (
            <>
              <p className="mb-4 max-w-prose text-sm text-muted">{tInvite("description")}</p>
              <InviteForm />
            </>
          ) : (
            <p className="text-sm text-muted">{tInvite("off")}</p>
          )}
        </Panel>
        <Panel title={t("organizationsTitle")}>
          <p className="mb-4 text-sm text-muted">{t("organizationsText")}</p>
          <ButtonLink href="/app/admin/organizations" variant="primary">
            {t("organizationsOpen")}
          </ButtonLink>
        </Panel>
        <Panel title={t("reviewsTitle")}>
          {canOpenQualificationReview(actor.profile) ? (
            <ButtonLink href="/app/admin/verifications" variant="primary">
              {t("reviewsOpen")}
            </ButtonLink>
          ) : (
            <p className="text-sm text-muted">{t("reviewsOff")}</p>
          )}
        </Panel>
        <Panel title={t("auditTitle")}>
          <p className="mb-4 text-sm text-muted">{t("auditText")}</p>
          <ButtonLink href="/app/admin/audit">{t("auditOpen")}</ButtonLink>
        </Panel>
        <Panel title={t("toolsTitle")}>
          <ButtonLink href="/app/tools">{t("toolsOpen")}</ButtonLink>
        </Panel>
      </div>
    </>
  );
}
