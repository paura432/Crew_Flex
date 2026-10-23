import { getLocale, getTranslations } from "next-intl/server";
import type { WorkRequirement } from "@/domain/work-requirement";
import type { Locale } from "@/i18n/config";
import { formatCountry, formatDateTime } from "@/i18n/format";
import { QualificationChips, RequirementStatusChip, UrgencyChip } from "./RequirementBadges";
import { RequirementTerms } from "./RequirementTerms";

/** Facts of a requirement; the status chip only when the status is known (an opportunity is open). */
export async function RequirementFacts({
  requirement,
  confirmedSeats,
}: {
  requirement: Pick<
    WorkRequirement,
    "location" | "startsAt" | "endsAt" | "shift" | "headcount" | "urgency" | "qualifications"
  > &
    Partial<
      Pick<
        WorkRequirement,
        | "status"
        | "archivedAt"
        | "country"
        | "timeZone"
        | "description"
        | "shifts"
        | "conditions"
        | "client"
      >
    > & {
      /** An opportunity's represented client (BR-27; the professional's projection carries the name only). */
      clientName?: string | null;
    };
  /** Organization view: confirmed seats, for «Cobertura por jornada». */
  confirmedSeats?: number | null;
}) {
  const [t, tDomain, tRecruiter, locale] = await Promise.all([
    getTranslations("organization.detail.facts"),
    getTranslations("domain"),
    getTranslations("recruiter.requirement"),
    getLocale() as Promise<Locale>,
  ]);
  const facts: [string, string][] = [
    [
      t("location"),
      // v1.8 «{base} · {país}» (Marketplace.jsx:36).
      requirement.country
        ? `${requirement.location} · ${formatCountry(locale, requirement.country)}`
        : requirement.location,
    ],
    [t("starts"), formatDateTime(locale, requirement.startsAt)],
    [t("ends"), formatDateTime(locale, requirement.endsAt)],
    [t("shift"), tDomain(`shift.${requirement.shift}`)],
    [t("headcount"), String(requirement.headcount)],
  ];
  if (requirement.timeZone) facts.push([t("timeZone"), requirement.timeZone]);
  // Recruiter (v1.8 «Cliente representado», BR-27): who the agency publishes for.
  const client = requirement.client?.name ?? requirement.clientName;
  if (client) facts.push([tRecruiter("client"), client]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <UrgencyChip urgency={requirement.urgency} />
        {requirement.status && (
          <RequirementStatusChip
            requirement={{
              status: requirement.status,
              endsAt: requirement.endsAt,
              archivedAt: requirement.archivedAt,
            }}
          />
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
            <dd className="font-medium break-words tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <QualificationChips qualifications={requirement.qualifications} />
      <RequirementTerms terms={requirement} confirmedSeats={confirmedSeats} />
    </div>
  );
}
