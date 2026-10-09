import { ButtonLink } from "@/components/ui/Button";
import { Metric } from "@/components/ui/Metric";
import type { CapacityResult } from "@/domain/capacity";
import type { WorkRequirement } from "@/domain/work-requirement";
import { formatPeriod, SHIFT_LABEL } from "@/lib/format";
import { QualificationChips } from "@/features/requirements/components/RequirementBadges";

/** The product thesis on one panel: Required · Internally eligible · Gap · Coverage. */
export function CapacityOverview({
  requirement,
  capacity,
  showRequirementLink = false,
}: {
  requirement: WorkRequirement;
  capacity: CapacityResult;
  showRequirementLink?: boolean;
}) {
  const hasGap = capacity.gap > 0;
  return (
    <section aria-labelledby="capacity-title" className="rounded-xl border border-line bg-white">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <h2
            id="capacity-title"
            className="text-xs font-semibold tracking-[0.16em] text-muted uppercase"
          >
            Technical capacity
          </h2>
          <p className="mt-1 text-lg font-semibold tracking-tight tabular-nums">
            {formatPeriod(requirement.startsAt, requirement.endsAt)} · {requirement.location} ·{" "}
            {SHIFT_LABEL[requirement.shift].toUpperCase()}
          </p>
          {showRequirementLink && <p className="text-sm text-muted">{requirement.title}</p>}
        </div>
        <QualificationChips qualifications={requirement.qualifications} />
      </header>

      <dl className="grid grid-cols-2 gap-3 p-5 sm:p-6 lg:grid-cols-4">
        <Metric label="Required" value={capacity.required} />
        <Metric
          label="Internally eligible"
          value={capacity.internallyEligible}
          tone={capacity.internallyEligible > 0 ? "ok" : "neutral"}
        />
        <Metric
          label="Gap"
          value={capacity.gap}
          tone={hasGap ? "danger" : "ok"}
          detail={hasGap ? `${capacity.gap} × to source externally` : "Covered internally"}
        />
        <Metric label="Coverage" value={`${capacity.coveragePercent}%`} />
      </dl>

      <footer className="flex flex-wrap gap-3 border-t border-line px-5 py-4 sm:px-6">
        {hasGap && (
          <ButtonLink
            href={`/app/organization/requirements/${requirement.id}/matches`}
            variant="primary"
          >
            View eligible external professionals
          </ButtonLink>
        )}
        {showRequirementLink && (
          <ButtonLink href={`/app/organization/requirements/${requirement.id}`}>
            Requirement detail
          </ButtonLink>
        )}
      </footer>
    </section>
  );
}
