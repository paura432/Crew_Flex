import { StatusChip, type Tone } from "@/components/ui/StatusChip";
import { StateMessage } from "@/components/ui/StateMessage";
import type { CompletenessItem } from "@/domain/professional";
import type { VerificationStatus } from "@/domain/qualification";
import { formatDate, formatDateTime } from "@/lib/format";
import type {
  AvailabilityWindowRow,
  ProfileVisibility,
  TechnicianProfileRow,
  TechnicianQualificationRow,
} from "@/types/database";

const VERIFICATION_TONE: Record<VerificationStatus, Tone> = {
  verified: "ok",
  pending: "warn",
  rejected: "danger",
  expired: "danger",
};

export const VISIBILITY_COPY: Record<ProfileVisibility, { label: string; detail: string }> = {
  private: { label: "Private", detail: "You never appear in organization matching." },
  anonymous: {
    label: "Anonymous",
    detail: "Your relevant qualifications can be matched; your identity stays hidden.",
  },
  open: {
    label: "Open",
    detail: "Your name is shown in matching results. Contact still requires your consent.",
  },
};

/** Concrete next step for the passport completeness metric (CF-L03). */
export const COMPLETENESS_HINT: Record<CompletenessItem, string> = {
  display_name: "Next: add your professional name",
  base_location: "Next: set your base",
  years_experience: "Next: add your years of experience",
  licence_or_rating: "Next: declare a licence or type rating",
  verified_qualification: "Next: a reviewer verifies a qualification",
  availability: "Next: publish available days",
  visibility: "Next: choose anonymous or open visibility",
};

export function ProfileFacts({ profile }: { profile: TechnicianProfileRow }) {
  const facts: [string, string][] = [
    ["Base", profile.base_location ?? "Not set"],
    ["Mobility", profile.mobility],
    [
      "Experience",
      profile.years_experience === null ? "Not set" : `${profile.years_experience} years`,
    ],
    ["Status", profile.current_status.replaceAll("_", " ")],
    ["Visibility", VISIBILITY_COPY[profile.visibility].label],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
          <dd className="font-medium capitalize">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function QualificationTable({
  qualifications,
}: {
  qualifications: TechnicianQualificationRow[];
}) {
  if (qualifications.length === 0) {
    return (
      <StateMessage
        title="No qualifications yet"
        description="Adding qualifications comes in the next phase."
      />
    );
  }
  return (
    <ul className="divide-y divide-line">
      {qualifications.map((q) => (
        <li key={q.id} className="flex flex-wrap items-center gap-3 py-3">
          <span className="w-24 font-mono font-semibold">{q.qualification_types.code}</span>
          <span className="min-w-0 flex-1 text-muted">{q.qualification_types.name}</span>
          <StatusChip tone={VERIFICATION_TONE[q.verification_status]}>
            {q.verification_status}
          </StatusChip>
          <span className="w-32 text-sm text-muted tabular-nums">
            {q.expires_at ? `until ${formatDate(q.expires_at)}` : "No expiry"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AvailabilityTable({ windows }: { windows: AvailabilityWindowRow[] }) {
  if (windows.length === 0) {
    return (
      <StateMessage
        title="No availability windows"
        description="You are not available for matching."
      />
    );
  }
  return (
    <ul className="divide-y divide-line">
      {windows.map((w) => (
        <li key={w.id} className="flex flex-wrap items-center gap-3 py-3 text-sm tabular-nums">
          <StatusChip tone={w.status === "available" ? "ok" : "neutral"}>{w.status}</StatusChip>
          <span>
            {formatDateTime(w.starts_at)} → {formatDateTime(w.ends_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
