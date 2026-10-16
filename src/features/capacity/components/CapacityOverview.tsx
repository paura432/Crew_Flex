import { getLocale, getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { Metric } from "@/components/ui/Metric";
import type { CapacityResult } from "@/domain/capacity";
import type { WorkRequirement } from "@/domain/work-requirement";
import { formatPeriod } from "@/i18n/format";
import { QualificationChips } from "@/features/requirements/components/RequirementBadges";

/** The product thesis on one panel: Required · Internally eligible · Gap · Coverage. */
export async function CapacityOverview({
  requirement,
  capacity,
  showRequirementLink = false,
}: {
  requirement: WorkRequirement;
  capacity: CapacityResult;
  showRequirementLink?: boolean;
}) {
  const [t, tDomain, locale] = await Promise.all([
    getTranslations("capacity"),
    getTranslations("domain"),
    getLocale(),
  ]);
  const hasGap = capacity.gap > 0;
  return (
    <section aria-labelledby="capacity-title" className="rounded-xl border border-line bg-white">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <h2
            id="capacity-title"
            className="text-xs font-semibold tracking-[0.16em] text-muted uppercase"
          >
            {t("title")}
          </h2>
          <p className="mt-1 text-lg font-semibold tracking-tight tabular-nums">
            {formatPeriod(locale, requirement.startsAt, requirement.endsAt)} ·{" "}
            {requirement.location} · {tDomain(`shift.${requirement.shift}`).toUpperCase()}
          </p>
          {showRequirementLink && <p className="text-sm text-muted">{requirement.title}</p>}
        </div>
        <QualificationChips qualifications={requirement.qualifications} />
      </header>

      <dl className="grid grid-cols-2 gap-3 p-5 sm:p-6 lg:grid-cols-4">
        <Metric label={t("required")} value={capacity.required} />
        <Metric
          label={t("internallyEligible")}
          value={capacity.internallyEligible}
          tone={capacity.internallyEligible > 0 ? "ok" : "neutral"}
        />
        <Metric
          label={t("gap")}
          value={capacity.gap}
          tone={hasGap ? "danger" : "ok"}
          detail={hasGap ? t("gapDetail", { count: capacity.gap }) : t("coveredInternally")}
        />
        <Metric label={t("coverage")} value={`${capacity.coveragePercent}%`} />
      </dl>

      <footer className="flex flex-wrap gap-3 border-t border-line px-5 py-4 sm:px-6">
        {hasGap && (
          <ButtonLink
            href={`/app/organization/requirements/${requirement.id}/matches`}
            variant="primary"
          >
            {t("viewEligible")}
          </ButtonLink>
        )}
        {showRequirementLink && (
          <ButtonLink href={`/app/organization/requirements/${requirement.id}`}>
            {t("detail")}
          </ButtonLink>
        )}
      </footer>
    </section>
  );
}
