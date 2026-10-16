import { getTranslations } from "next-intl/server";
import { StatusChip, type Tone } from "@/components/ui/StatusChip";
import type { RequiredQualification, RequirementStatus, Urgency } from "@/domain/work-requirement";

const URGENCY_TONE: Record<Urgency, Tone> = { planned: "info", urgent: "warn", aog: "danger" };
const STATUS_TONE: Record<RequirementStatus, Tone> = {
  draft: "neutral",
  open: "info",
  covered: "ok",
  cancelled: "neutral",
  closed: "neutral",
};

export async function UrgencyChip({ urgency }: { urgency: Urgency }) {
  const t = await getTranslations("domain");
  return <StatusChip tone={URGENCY_TONE[urgency]}>{t(`urgency.${urgency}`)}</StatusChip>;
}

export async function RequirementStatusChip({ status }: { status: RequirementStatus }) {
  const t = await getTranslations("domain");
  return <StatusChip tone={STATUS_TONE[status]}>{t(`requirementStatus.${status}`)}</StatusChip>;
}

export async function QualificationChips({
  qualifications,
}: {
  qualifications: RequiredQualification[];
}) {
  const t = await getTranslations("organization.requirements");
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
