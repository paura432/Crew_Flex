import type { WorkRequirement } from "@/domain/work-requirement";
import { formatDateTime, SHIFT_LABEL } from "@/lib/format";
import { QualificationChips, RequirementStatusChip, UrgencyChip } from "./RequirementBadges";

export function RequirementFacts({ requirement }: { requirement: WorkRequirement }) {
  const facts: [string, string][] = [
    ["Location", requirement.location],
    ["Starts", formatDateTime(requirement.startsAt)],
    ["Ends", formatDateTime(requirement.endsAt)],
    ["Shift", SHIFT_LABEL[requirement.shift]],
    ["Headcount", String(requirement.headcount)],
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <UrgencyChip urgency={requirement.urgency} />
        <RequirementStatusChip status={requirement.status} />
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
