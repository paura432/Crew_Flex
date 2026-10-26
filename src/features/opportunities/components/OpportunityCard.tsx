import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import {
  QualificationChips,
  UrgencyChip,
} from "@/features/requirements/components/RequirementBadges";
import { APPLICATION_TONE } from "@/features/applications/view";
import { dayRate, requirementDays, totalBaseHours } from "@/domain/work-requirement";
import type { Locale } from "@/i18n/config";
import { formatCountry, formatEuro, formatNumber, formatPeriod } from "@/i18n/format";
import type { Opportunity, OpportunityRequirement } from "@/types/api";
import { opportunityVerdict } from "../view";

const VERDICT_STYLE = {
  eligible: "border-ok/30 bg-ok-bg text-ok",
  qualifications: "border-danger/30 bg-danger-bg text-danger",
  availability: "border-warn/30 bg-warn-bg text-warn",
} as const;

/**
 * The facts of v1.8 `Marketplace.jsx:90` `article.job-card`, shared by the professional's
 * «Oportunidades» and the organization's «Ofertas en la red» (v2-20): chips, linked title, «{org} ·
 * {base} · {country}», rates, period, shifts, qualifications; `children` below them.
 */
async function JobCard({
  requirement: r,
  href,
  chips,
  children,
}: {
  requirement: OpportunityRequirement;
  href: string;
  chips?: ReactNode;
  children: ReactNode;
}) {
  const [t, tRecruiter, locale] = await Promise.all([
    getTranslations("opportunities.card"),
    getTranslations("recruiter.opportunity"),
    getLocale() as Promise<Locale>,
  ]);
  // v1.8 card «{€/día} / día · {€} / h» (Marketplace.jsx:90), informative (OD-7).
  const rate = r.conditions?.hourlyRate;
  const daily = dayRate(r.conditions);
  return (
    <article className="rounded-xl border border-line bg-white p-5" aria-labelledby={`o-${r.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <UrgencyChip urgency={r.urgency} />
        {chips}
      </div>
      <h2 id={`o-${r.id}`} className="mt-2 text-lg font-semibold break-words">
        <Link href={href} className="block text-blue hover:underline pointer-coarse:py-2.5">
          {r.title}
        </Link>
      </h2>
      <p className="text-sm text-muted">
        {/* v1.8 «Publicada por {company} para el cliente {client}» (Marketplace.jsx:36-44, BR-27). */}
        {r.clientName
          ? tRecruiter("publishedFor", { organization: r.organizationName, client: r.clientName })
          : r.organizationName}{" "}
        · {r.location}
        {r.country && ` · ${formatCountry(locale, r.country)}`}
      </p>
      {rate !== undefined && (
        <p className="mt-1 text-sm font-semibold tabular-nums">
          {daily === null
            ? t("rateHourly", { hourly: formatEuro(locale, rate) })
            : t("rate", { daily: formatEuro(locale, daily), hourly: formatEuro(locale, rate) })}
        </p>
      )}
      {/* v1.8 «{n} días · {n} personas» + «{día} – {día} · Bloque completo» (P04, T-164): the published shifts,
          or the UTC days of the period (BR-10); the coverage is always the whole block while D-06 Q6 holds. */}
      <p className="mt-1 text-sm tabular-nums">
        {formatPeriod(locale, r.startsAt, r.endsAt)} · {t("days", { count: requirementDays(r) })} ·{" "}
        {t("people", { count: r.headcount })} · {t("fullBlock")}
      </p>
      {r.shifts?.length ? (
        <p className="text-sm text-muted tabular-nums">
          {t("shifts", {
            count: r.shifts.length,
            hours: formatNumber(locale, totalBaseHours(r.shifts)),
          })}
        </p>
      ) : null}
      <div className="mt-3">
        <QualificationChips qualifications={r.qualifications} />
      </div>
      {children}
    </article>
  );
}

/**
 * The professional's card (v1.8 `Marketplace.jsx:90` without the affinity %, T-03): facts, the own
 * verdict, then «Ver detalle» and «Preparar candidatura» (v2-26) — the latter disabled unless the
 * server-side rules would let the caller apply now («Ya presentada» with an active application).
 */
export async function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const [t, tCard, tDomain] = await Promise.all([
    getTranslations("opportunities.card"),
    getTranslations("hiring.opportunityCard"),
    getTranslations("domain"),
  ]);
  const { requirement: r, match, myApplication, applyBlocker } = opportunity;
  const verdict = opportunityVerdict(match);
  const href = `/app/professional/opportunities/${r.id}`;
  return (
    <JobCard
      requirement={r}
      href={href}
      chips={
        myApplication && (
          <StatusChip tone={APPLICATION_TONE[myApplication.status]}>
            {t("applied", { status: tDomain(`applicationStatus.${myApplication.status}`) })}
          </StatusChip>
        )
      }
    >
      <p
        className={`mt-4 rounded-lg border px-3 py-2 text-sm font-semibold ${VERDICT_STYLE[verdict.kind]}`}
      >
        {verdict.kind === "qualifications"
          ? t("hardPending", { count: verdict.count })
          : t(verdict.kind)}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink href={href} aria-describedby={`o-${r.id}`}>
          {tCard("viewDetail")}
        </ButtonLink>
        {applyBlocker === null ? (
          <ButtonLink href={`${href}#apply`} variant="primary" aria-describedby={`o-${r.id}`}>
            {tCard("prepare")}
          </ButtonLink>
        ) : (
          <Button variant="primary" disabled aria-describedby={`o-${r.id}`}>
            {applyBlocker === "ALREADY_APPLIED" ? tCard("applied") : tCard("prepare")}
          </Button>
        )}
      </div>
    </JobCard>
  );
}

/** «Ofertas en la red» (v2-20): the same facts for an organization, no eligibility, «Ver detalle». */
export async function NetworkOpportunityCard({
  requirement,
}: {
  requirement: OpportunityRequirement;
}) {
  const t = await getTranslations("hiring.network");
  const href = `/app/organization/network/${requirement.id}`;
  return (
    <JobCard requirement={requirement} href={href}>
      <div className="mt-4">
        <ButtonLink href={href} aria-describedby={`o-${requirement.id}`}>
          {t("viewDetail")}
        </ButtonLink>
      </div>
    </JobCard>
  );
}
