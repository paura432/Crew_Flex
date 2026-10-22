import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { StatusChip } from "@/components/ui/StatusChip";
import {
  QualificationChips,
  UrgencyChip,
} from "@/features/requirements/components/RequirementBadges";
import { APPLICATION_TONE } from "@/features/applications/view";
import type { Locale } from "@/i18n/config";
import { formatPeriod } from "@/i18n/format";
import type { Opportunity } from "@/types/api";
import { opportunityVerdict } from "../view";

const VERDICT_STYLE = {
  eligible: "border-ok/30 bg-ok-bg text-ok",
  qualifications: "border-danger/30 bg-danger-bg text-danger",
  availability: "border-warn/30 bg-warn-bg text-warn",
} as const;

/** v1.8 `Marketplace.jsx:90` card without the affinity % (T-03): facts, then the own verdict. */
export async function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const [t, tDomain, locale] = await Promise.all([
    getTranslations("opportunities.card"),
    getTranslations("domain"),
    getLocale() as Promise<Locale>,
  ]);
  const { requirement: r, match, myApplication } = opportunity;
  const verdict = opportunityVerdict(match);
  const href = `/app/professional/opportunities/${r.id}`;
  return (
    <article className="rounded-xl border border-line bg-white p-5" aria-labelledby={`o-${r.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <UrgencyChip urgency={r.urgency} />
        {myApplication && (
          <StatusChip tone={APPLICATION_TONE[myApplication.status]}>
            {t("applied", { status: tDomain(`applicationStatus.${myApplication.status}`) })}
          </StatusChip>
        )}
      </div>
      <h2 id={`o-${r.id}`} className="mt-2 text-lg font-semibold break-words">
        <Link href={href} className="text-blue hover:underline pointer-coarse:py-2.5">
          {r.title}
        </Link>
      </h2>
      <p className="text-sm text-muted">
        {r.organizationName} · {r.location}
      </p>
      <p className="mt-1 text-sm tabular-nums">
        {formatPeriod(locale, r.startsAt, r.endsAt)} · {t("people", { count: r.headcount })}
      </p>
      <div className="mt-3">
        <QualificationChips qualifications={r.qualifications} />
      </div>
      <p
        className={`mt-4 rounded-lg border px-3 py-2 text-sm font-semibold ${VERDICT_STYLE[verdict.kind]}`}
      >
        {verdict.kind === "qualifications"
          ? t("hardPending", { count: verdict.count })
          : t(verdict.kind)}
      </p>
    </article>
  );
}
