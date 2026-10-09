import { StatusChip, type Tone } from "@/components/ui/StatusChip";
import type { RequiredQualification, RequirementStatus, Urgency } from "@/domain/work-requirement";
import { STATUS_LABEL, URGENCY_LABEL } from "@/lib/format";

const URGENCY_TONE: Record<Urgency, Tone> = { planned: "info", urgent: "warn", aog: "danger" };
const STATUS_TONE: Record<RequirementStatus, Tone> = {
  draft: "neutral",
  open: "info",
  covered: "ok",
  cancelled: "neutral",
  closed: "neutral",
};

export const UrgencyChip = ({ urgency }: { urgency: Urgency }) => (
  <StatusChip tone={URGENCY_TONE[urgency]}>{URGENCY_LABEL[urgency]}</StatusChip>
);

export const RequirementStatusChip = ({ status }: { status: RequirementStatus }) => (
  <StatusChip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusChip>
);

export function QualificationChips({
  qualifications,
}: {
  qualifications: RequiredQualification[];
}) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Required qualifications">
      {qualifications.map((q) => (
        <li
          key={q.qualificationTypeId}
          title={`${q.name} — ${q.level === "hard" ? "hard requirement" : "soft (nice to have)"}`}
          className={`rounded-md border px-2 py-0.5 font-mono text-xs font-semibold ${
            q.level === "hard"
              ? "border-navy/20 bg-navy text-white"
              : "border-line bg-white text-muted"
          }`}
        >
          {q.code}
          {q.level === "soft" && <span className="ml-1 font-sans font-normal">(soft)</span>}
        </li>
      ))}
    </ul>
  );
}
