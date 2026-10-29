import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { FilterPill } from "@/components/ui/FilterPill";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { StatusChip } from "@/components/ui/StatusChip";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/domain/applications";
import { hasPackCopy } from "@/domain/candidate-pack";
import { requirementDays } from "@/domain/work-requirement";
import { listMyApplications } from "@/features/applications/api";
import { ApplicationActions } from "@/features/applications/components/ApplicationActions";
import { ApplicationDetails } from "@/features/applications/components/ApplicationDetails";
import { PackDisclosure } from "@/features/applications/components/PackDisclosure";
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

/**
 * M08, technician side (v1.8 «Mis candidaturas»): every own application, its proposal and history, and the
 * Candidate Pack copy the organization received («Ver expediente», v2-15).
 */
export default async function MyApplicationsPage({
  searchParams,
}: PageProps<"/app/professional/applications">) {
  const [{ status: statusParam, pack: packParam }, actor, t, tDomain, tPack, tHiring, locale] =
    await Promise.all([
      searchParams,
      requireSessionActor(),
      getTranslations("applications"),
      getTranslations("domain"),
      getTranslations("candidatePack"),
      getTranslations("hiring.applications"),
      getLocale() as Promise<Locale>,
    ]);
  const header = (
    <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
  );
  if (actor.profile.account_type !== "professional") {
    // An organization account: its applications are in its own «Candidaturas» (v2-05).
    return (
      <>
        {header}
        <StateMessage
          title={t("orgOnlyTitle")}
          description={t("orgOnlyDescription")}
          action={
            <ButtonLink href="/app/organization/applications">{t("orgOnlyAction")}</ButtonLink>
          }
        />
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
  // Area 50 #14: the active filter is `aria-current="true"`; «page» stays the menu entry's.
  const pill = (value: ApplicationStatus | null, label: string) => (
    <FilterPill
      key={value ?? "all"}
      href={
        value ? `/app/professional/applications?status=${value}` : "/app/professional/applications"
      }
      current={status === value}
    >
      {label}
    </FilterPill>
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
          {/* A `?status=` with nothing in it (only by URL: the pills list the present states): v1.8's empty state. */}
          {shown.length === 0 && (
            <StateMessage title={tHiring("emptyTitle")} description={tHiring("emptyDescription")} />
          )}
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
                          className="inline-flex items-center text-blue hover:underline pointer-coarse:min-h-11"
                        >
                          {r.title}
                        </Link>
                      ) : (
                        r.title
                      )}
                    </h2>
                    {/* v1.8 «{empresa} · {n} fechas» (Workflow.jsx:57): the period and its days (T-165). */}
                    <p className="text-sm text-muted tabular-nums">
                      {r.organizationName} · {r.location} ·{" "}
                      {formatPeriod(locale, r.startsAt, r.endsAt)} ·{" "}
                      {t("card.days", { count: requirementDays(r) })}
                    </p>
                    {note && (
                      <p
                        className={`mt-1 text-sm ${
                          // covered by this very assignment is not a warning (v2 diff)
                          note === "requirementCovered" && application.status === "confirmed"
                            ? "text-muted"
                            : "text-warn"
                        }`}
                      >
                        {t(`card.${note}`)}
                      </p>
                    )}
                  </div>
                  <ApplicationDetails application={application} />
                  {hasPackCopy(application.status) && (
                    <PackDisclosure
                      applicationId={application.id}
                      open={packParam === application.id}
                      baseHref={
                        status
                          ? `/app/professional/applications?status=${status}`
                          : "/app/professional/applications"
                      }
                      intro={
                        // v1.8 «Alcance y destinatario: {org} para {cliente}» (Workflow.jsx:28; BR-27.6, T-169)
                        r.clientName
                          ? tPack("ownIntroClient", {
                              organization: r.organizationName,
                              client: r.clientName,
                            })
                          : tPack("ownIntro", { organization: r.organizationName })
                      }
                    />
                  )}
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
