import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { CloseAccountForm } from "@/features/account/components/CloseAccountForm";
import { ExportLink } from "@/features/account/components/ExportLink";
import { NoticePreferencesSection } from "@/features/outreach/components/NoticePreferencesSection";
import { LocaleSwitcher } from "@/features/preferences/components/LocaleSwitcher";
import { primaryMembership, requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("settings") };
}

/** Account-level settings for every signed-in user (professional or organization). */
export default async function SettingsPage({ searchParams }: PageProps<"/app/settings">) {
  const [actor, params, t, tData, tDomain, tCommon] = await Promise.all([
    requireSessionActor(),
    searchParams,
    getTranslations("settings"),
    getTranslations("account.data"),
    getTranslations("domain"),
    getTranslations("common"),
  ]);
  // Same organization and role as the shell's section header (not whichever row came first).
  const membership = primaryMembership(actor);
  const facts: [string, string][] = [
    [t("name"), actor.profile.display_name],
    [t("email"), actor.email ?? tCommon("notSet")],
    [t("accountType"), tDomain(`accountType.${actor.profile.account_type}`)],
    ...(membership
      ? ([
          [t("organization"), membership.organization.name],
          [t("role"), tDomain(`role.${membership.role}`)],
        ] as [string, string][])
      : []),
    // ACC-01 #4: the platform role too, only for those who have one.
    ...(actor.profile.platform_role === "platform_admin"
      ? ([[t("platformRole"), tDomain("platformRole.platform_admin")]] as [string, string][])
      : []),
  ];

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="space-y-6">
        <Panel title={t("language")}>
          <p className="mb-4 max-w-prose text-sm text-muted">{t("languageDescription")}</p>
          <LocaleSwitcher />
        </Panel>
        {/* PKG outreach (N-10): professional accounts only. */}
        {actor.profile.account_type === "professional" && <NoticePreferencesSection />}
        <Panel title={t("account")}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {label}
                </dt>
                <dd className="font-medium break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title={tData("title")}>
          <div className="flex max-w-prose flex-col gap-4">
            {params.export === "failed" && (
              <p
                role="alert"
                className="rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger"
              >
                {tData("exportFailed")}
              </p>
            )}
            <p className="text-sm text-muted">{tData("exportHint")}</p>
            <ExportLink />
            <CloseAccountForm />
          </div>
        </Panel>
      </div>
    </>
  );
}
