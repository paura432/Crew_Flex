import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Metric } from "@/components/ui/Metric";
import { Panel } from "@/components/ui/Panel";
import { StatusChip } from "@/components/ui/StatusChip";
import { TERMINAL_APPLICATION_STATUSES } from "@/domain/applications";
import { listOpportunities } from "@/features/opportunities/api";
import type { Locale } from "@/i18n/config";
import { formatPeriod } from "@/i18n/format";
import { listMyApplications } from "../api";
import { APPLICATION_TONE } from "../view";

const FEED = 3;

/**
 * v1.8 technician home (`TechnicianHome.jsx:15`): «oportunidades compatibles» and «asignaciones
 * confirmadas» counters, the next compatible opportunities and the latest own applications.
 * A failing feed says so in place; it never breaks «Mi espacio».
 */
export async function ProfessionalActivity() {
  const [t, tDomain, locale, opportunities, applications] = await Promise.all([
    getTranslations("professional.activity"),
    getTranslations("domain"),
    getLocale() as Promise<Locale>,
    listOpportunities({ eligible: "1", limit: FEED }),
    listMyApplications(),
  ]);
  const mine = applications.ok ? applications.data.applications : [];
  const active = mine.filter((a) => !TERMINAL_APPLICATION_STATUSES.includes(a.status));
  const toAccept = mine.filter((a) => a.status === "proposed").length;
  const confirmed = mine.filter((a) => a.status === "confirmed").length;

  return (
    <section aria-label={t("label")} className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label={t("compatible")}
          value={opportunities.ok ? opportunities.data.total : "—"}
          tone={opportunities.ok && opportunities.data.total > 0 ? "ok" : "neutral"}
        />
        <Metric label={t("active")} value={applications.ok ? active.length : "—"} />
        <Metric
          label={t("toAccept")}
          value={applications.ok ? toAccept : "—"}
          tone={toAccept > 0 ? "warn" : "neutral"}
        />
        <Metric label={t("confirmed")} value={applications.ok ? confirmed : "—"} />
      </dl>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={t("opportunitiesTitle")}
          actions={
            <ButtonLink href="/app/professional/opportunities" variant="ghost">
              {t("viewAll")}
            </ButtonLink>
          }
        >
          {!opportunities.ok ? (
            <p className="text-sm text-danger" role="alert">
              {t("loadError")}
            </p>
          ) : opportunities.data.opportunities.length === 0 ? (
            <p className="text-sm text-muted">{t("noOpportunities")}</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {opportunities.data.opportunities.map(({ requirement: r }) => (
                <li key={r.id} className="py-2">
                  <Link
                    href={`/app/professional/opportunities/${r.id}`}
                    className="font-semibold text-blue hover:underline pointer-coarse:py-2.5"
                  >
                    {r.title}
                  </Link>
                  <p className="text-muted tabular-nums">
                    {r.organizationName} · {formatPeriod(locale, r.startsAt, r.endsAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel
          title={t("applicationsTitle")}
          actions={
            <ButtonLink href="/app/professional/applications" variant="ghost">
              {t("follow")}
            </ButtonLink>
          }
        >
          {!applications.ok ? (
            <p className="text-sm text-danger" role="alert">
              {t("loadError")}
            </p>
          ) : mine.length === 0 ? (
            <p className="text-sm text-muted">{t("noApplications")}</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {mine.slice(0, FEED).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block font-semibold break-words">{a.requirement.title}</span>
                    <span className="text-muted">{a.requirement.organizationName}</span>
                  </span>
                  <StatusChip tone={APPLICATION_TONE[a.status]}>
                    {tDomain(`applicationStatus.${a.status}`)}
                  </StatusChip>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}
