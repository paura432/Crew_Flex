import { getTranslations } from "next-intl/server";
import { StatusChip, type Tone } from "@/components/ui/StatusChip";
import {
  isExpired,
  type RequiredQualification,
  type RequirementStatus,
  type Urgency,
  type WorkRequirement,
} from "@/domain/work-requirement";

const URGENCY_TONE: Record<Urgency, Tone> = { planned: "info", urgent: "warn", aog: "danger" };
const STATUS_TONE: Record<RequirementStatus, Tone> = {
  draft: "neutral",
  open: "info",
  paused: "warn",
  covered: "ok",
  cancelled: "neutral",
  closed: "neutral",
};

export async function UrgencyChip({ urgency }: { urgency: Urgency }) {
  const t = await getTranslations("domain");
  return <StatusChip tone={URGENCY_TONE[urgency]}>{t(`urgency.${urgency}`)}</StatusChip>;
}

/** Request time (dynamic, authenticated pages): same pattern as the dashboard's focus helper. */
const expiredNow = (r: Pick<WorkRequirement, "status" | "endsAt">) => isExpired(r, Date.now());

/** Stored status, or the derived V1.8 «Vencida» for an open need whose period has ended. */
export async function RequirementStatusChip({
  requirement,
}: {
  requirement: Pick<WorkRequirement, "status" | "endsAt">;
}) {
  const t = await getTranslations("domain");
  if (expiredNow(requirement)) {
    return <StatusChip tone="warn">{t("requirementStatus.expired")}</StatusChip>;
  }
  const { status } = requirement;
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
