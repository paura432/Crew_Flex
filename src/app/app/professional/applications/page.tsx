import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { StatusChip } from "@/components/ui/StatusChip";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/domain/applications";
import { listMyApplications } from "@/features/applications/api";
import { ApplicationActions } from "@/features/applications/components/ApplicationActions";
import { ApplicationDetails } from "@/features/applications/components/ApplicationDetails";
import { APPLICATION_TONE } from "@/features/applications/view";
import type { Locale } from "@/i18n/config";
import { formatPeriod } from "@/i18n/format";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("applications") };
}

const REQUIREMENT_NOTE = {
  paused: "requirementPaused",
  closed: "requirementClosed",
  covered: "requirementCovered",
} as const;

/** M08, technician side (v1.8 «Mis candidaturas»): every own application, its proposal and history. */
export default async function MyApplicationsPage({
  searchParams,
}: PageProps<"/app/professional/applications">) {
  const [{ status: statusParam }, actor, t, tDomain, locale] = await Promise.all([
    searchParams,
    requireSessionActor(),
    getTranslations("applications"),
    getTranslations("domain"),
    getLocale() as Promise<Locale>,
  ]);
  const header = (
    <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
  );
  if (actor.profile.account_type !== "professional") {
    return (
      <>
        {header}
        <StateMessage title={t("emptyTitle")} description={t("emptyDescription")} />
      </>
    );
  }
  const result = await listMyApplications();
  if (!result.ok) {
    return (
      <>
        {header}
        <ApiErrorState error={result.error} requestId={result.requestId} />
      </>
    );
  }
  const all = result.data.applications;
  const status = APPLICATION_STATUSES.find((s) => s === statusParam) ?? null;
  const shown = status ? all.filter((a) => a.status === status) : all;
  const present = APPLICATION_STATUSES.filter((s) => all.some((a) => a.status === s));
  const pill = (value: ApplicationStatus | null, label: string) => (
    <Link
      key={value ?? "all"}
      href={
        value ? `/app/professional/applications?status=${value}` : "/app/professional/applications"
      }
      aria-current={status === value ? "page" : undefined}
      className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold text-muted pointer-coarse:min-h-11 aria-[current=page]:border-navy aria-[current=page]:bg-navy aria-[current=page]:text-white"
    >
      {label}
    </Link>
  );

  return (
    <>
      {header}
      {all.length === 0 ? (
        <StateMessage
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <ButtonLink href="/app/professional/opportunities" variant="primary">
              {t("emptyAction")}
            </ButtonLink>
          }
        />
      ) : (
        <>
          <nav aria-label={t("filtersLabel")} className="mb-6 flex flex-wrap gap-2">
            {pill(null, t("all", { count: all.length }))}
            {present.map((s) => pill(s, tDomain(`applicationStatus.${s}`)))}
          </nav>
          <div className="space-y-4">
            {shown.map((application) => {
              const r = application.requirement;
              const note =
                r.status === "paused" || r.status === "closed" || r.status === "covered"
                  ? REQUIREMENT_NOTE[r.status]
                  : null;
              return (
                <article
                  key={application.id}
                  aria-labelledby={`a-${application.id}`}
                  className="space-y-3 rounded-xl border border-line bg-white p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip tone={APPLICATION_TONE[application.status]}>
                      {tDomain(`applicationStatus.${application.status}`)}
                    </StatusChip>
                  </div>
                  <div>
                    <h2 id={`a-${application.id}`} className="text-lg font-semibold break-words">
                      {r.status === "open" ? (
                        <Link
                          href={`/app/professional/opportunities/${r.id}`}
                          className="text-blue hover:underline"
                        >
                          {r.title}
                        </Link>
                      ) : (
                        r.title
                      )}
                    </h2>
                    <p className="text-sm text-muted tabular-nums">
                      {r.organizationName} · {r.location} ·{" "}
                      {formatPeriod(locale, r.startsAt, r.endsAt)}
                    </p>
                    {note && <p className="mt-1 text-sm text-warn">{t(`card.${note}`)}</p>}
                  </div>
                  <ApplicationDetails application={application} />
                  <ApplicationActions
                    applicationId={application.id}
                    status={application.status}
                    updatedAt={application.updatedAt}
                    actor="technician"
                    proposal={
                      application.currentProposal
                        ? {
                            id: application.currentProposal.id,
                            version: application.currentProposal.version,
                          }
                        : null
                    }
                    periodEnded={false}
                    requirementOpen
                  />
                </article>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
