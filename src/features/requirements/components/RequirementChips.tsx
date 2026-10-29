import { useTranslations } from "next-intl";
import { StatusChip, type Tone } from "@/components/ui/StatusChip";
import type { RequiredQualification, Urgency } from "@/domain/work-requirement";

// Synchronous (hook) versions of the requirement chips: they render in Server Components and in the
// builder's client preview alike (no server-only import here). RequirementBadges wraps them for pages.

export const URGENCY_TONE: Record<Urgency, Tone> = {
  planned: "info",
  urgent: "warn",
  aog: "danger",
};

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const t = useTranslations("domain");
  return <StatusChip tone={URGENCY_TONE[urgency]}>{t(`urgency.${urgency}`)}</StatusChip>;
}

export function QualificationChipList({
  qualifications,
}: {
  qualifications: Pick<RequiredQualification, "qualificationTypeId" | "code" | "name" | "level">[];
}) {
  const t = useTranslations("organization.requirements");
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t("requiredQualifications")}>
      {qualifications.map((q) => (
        <li
          key={q.qualificationTypeId}
          title={`${q.name} — ${q.level === "hard" ? t("hardRequirement") : t("softRequirement")}`}
          className={`rounded-md border px-2 py-0.5 font-mono text-xs font-semibold ${
            q.level === "hard"
              ? "border-navy/20 bg-navy text-white"
              : "border-line bg-white text-muted"
          }`}
        >
          {q.code}
          {q.level === "soft" && <span className="ml-1 font-sans font-normal">{t("soft")}</span>}
        </li>
      ))}
    </ul>
  );
}
