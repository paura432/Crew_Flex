import { getLocale, getTranslations } from "next-intl/server";
import type { WorkRequirement } from "@/domain/work-requirement";
import { formatDateTime } from "@/i18n/format";
import { QualificationChips, RequirementStatusChip, UrgencyChip } from "./RequirementBadges";

/** Facts of a requirement; the status chip only when the status is known (an opportunity is open). */
export async function RequirementFacts({
  requirement,
}: {
  requirement: Pick<
    WorkRequirement,
    "location" | "startsAt" | "endsAt" | "shift" | "headcount" | "urgency" | "qualifications"
  > &
    Partial<Pick<WorkRequirement, "status">>;
}) {
  const [t, tDomain, locale] = await Promise.all([
    getTranslations("organization.detail.facts"),
    getTranslations("domain"),
    getLocale(),
  ]);
  const facts: [string, string][] = [
    [t("location"), requirement.location],
    [t("starts"), formatDateTime(locale, requirement.startsAt)],
    [t("ends"), formatDateTime(locale, requirement.endsAt)],
    [t("shift"), tDomain(`shift.${requirement.shift}`)],
    [t("headcount"), String(requirement.headcount)],
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <UrgencyChip urgency={requirement.urgency} />
        {requirement.status && (
          <RequirementStatusChip
            requirement={{ status: requirement.status, endsAt: requirement.endsAt }}
          />
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <QualificationChips qualifications={requirement.qualifications} />
    </div>
  );
}
