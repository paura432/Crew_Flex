import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Panel } from "@/components/ui/Panel";

/**
 * v2-21, the Resumen's guide panels (v1.8 demo `Dashboard.jsx:44-59` + connected «Continúa tu
 * actividad»): «Cómo cerrar una cobertura» in 4 steps, the quick links that exist here («Constructor»,
 * «Candidate Packs» → «Candidaturas»; «Red profesional» waits for the directory, «Ver comisiones» is
 * SCOPE OUT) and the note that the platform is not a party to the contract. Links only for the roles
 * that can use them (admin/manager).
 */
export async function CoverageGuide({ canManage }: { canManage: boolean }) {
  const t = await getTranslations("hiring.dashboard");
  const links = canManage
    ? [
        {
          href: "/app/organization/requirements/new",
          title: t("builderTitle"),
          text: t("builderText"),
        },
        { href: "/app/organization/applications", title: t("packsTitle"), text: t("packsText") },
      ]
    : [];
  return (
    <div className="space-y-4">
      <Panel title={t("closeTitle")}>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {(["step1", "step2", "step3", "step4"] as const).map((step) => (
            <li key={step}>{t(step)}</li>
          ))}
        </ol>
      </Panel>
      {links.length > 0 && (
        <nav aria-label={t("quickLinks")}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex min-h-11 flex-col justify-center rounded-xl border border-line bg-white px-5 py-4 hover:bg-canvas"
                >
                  <span className="font-semibold text-blue">{link.title}</span>
                  <span className="text-sm text-muted">{link.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <p className="text-sm text-muted">{t("note")}</p>
    </div>
  );
}
