import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { LocaleSwitcher } from "@/features/preferences/components/LocaleSwitcher";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("settings") };
}

/** Account-level settings for every signed-in user (professional or organization). */
export default async function SettingsPage() {
  const [actor, t, tDomain] = await Promise.all([
    requireSessionActor(),
    getTranslations("settings"),
    getTranslations("domain"),
  ]);
  const membership = actor.memberships[0];
  const facts: [string, string][] = [
    [t("name"), actor.profile.display_name],
    [t("accountType"), tDomain(`accountType.${actor.profile.account_type}`)],
    ...(membership
      ? ([
          [t("organization"), membership.organization.name],
          [t("role"), tDomain(`role.${membership.role}`)],
        ] as [string, string][])
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
        <Panel title={t("account")}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {label}
                </dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </>
  );
}
