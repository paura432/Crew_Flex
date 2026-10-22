import { getTranslations } from "next-intl/server";
import { StatusChip, type Tone } from "@/components/ui/StatusChip";
import {
  isExpired,
  type RequiredQualification,
  type RequirementStatus,
  type Urgency,
  type WorkRequirement,
} from "@/domain/work-requirement";
import { QualificationChipList, UrgencyBadge } from "./RequirementChips";

const STATUS_TONE: Record<RequirementStatus, Tone> = {
  draft: "neutral",
  open: "info",
  paused: "warn",
  covered: "ok",
  cancelled: "neutral",
  closed: "neutral",
};

export function UrgencyChip({ urgency }: { urgency: Urgency }) {
  return <UrgencyBadge urgency={urgency} />;
}

/** Request time (dynamic, authenticated pages): same pattern as the dashboard's focus helper. */
const expiredNow = (r: Pick<WorkRequirement, "status" | "endsAt">) => isExpired(r, Date.now());

/**
 * Stored status, the derived V1.8 «Vencida» for an open need whose period has ended, or v1.8 «Archivada»
 * for an archived (closed) one (T-64).
 */
export async function RequirementStatusChip({
  requirement,
}: {
  requirement: Pick<WorkRequirement, "status" | "endsAt"> & { archivedAt?: string | null };
}) {
  const t = await getTranslations("domain");
  if (requirement.archivedAt) {
    const tDetail = await getTranslations("organization.detail.archive");
    return <StatusChip tone="neutral">{tDetail("chip")}</StatusChip>;
  }
  if (expiredNow(requirement)) {
    return <StatusChip tone="warn">{t("requirementStatus.expired")}</StatusChip>;
  }
  const { status } = requirement;
  return <StatusChip tone={STATUS_TONE[status]}>{t(`requirementStatus.${status}`)}</StatusChip>;
}

export function QualificationChips({
  qualifications,
}: {
  qualifications: RequiredQualification[];
}) {
  return <QualificationChipList qualifications={qualifications} />;
}
