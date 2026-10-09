// Human explanations of deterministic match results. Pure: no JSX, testable.
import type { MatchBlocker, QualificationCheck } from "@/domain/matching";
import { formatDate } from "@/lib/format";

export type CheckTone = "ok" | "warn" | "danger";

export interface ExplainedCheck {
  label: string;
  detail: string;
  tone: CheckTone;
  met: boolean;
}

export function explainCheck(check: QualificationCheck): ExplainedCheck {
  const hard = check.level === "hard";
  const failTone: CheckTone = hard ? "danger" : "warn";
  switch (check.outcome) {
    case "met":
      return {
        label: check.code,
        detail:
          check.verificationStatus === "verified"
            ? check.expiresAt
              ? `Verified · valid until ${formatDate(check.expiresAt)}`
              : "Verified"
            : "Self-declared · pending verification",
        tone: check.verificationStatus === "verified" ? "ok" : "warn",
        met: true,
      };
    case "missing":
      return { label: check.code, detail: "Not held", tone: failTone, met: false };
    case "not_verified":
      return {
        label: check.code,
        detail: `Not verified (${check.verificationStatus ?? "pending"})`,
        tone: failTone,
        met: false,
      };
    case "expired":
      return {
        label: check.code,
        detail: `Expired ${check.expiresAt ? formatDate(check.expiresAt) : ""}`.trim(),
        tone: failTone,
        met: false,
      };
    case "expires_during":
      return {
        label: check.code,
        detail: `Expires during the requirement (${check.expiresAt ? formatDate(check.expiresAt) : "?"})`,
        tone: failTone,
        met: false,
      };
  }
}

export function explainBlocker(blocker: MatchBlocker): string {
  switch (blocker.code) {
    case "MISSING_HARD_QUALIFICATION":
      return `Missing ${blocker.qualification}`;
    case "HARD_QUALIFICATION_NOT_VERIFIED":
      return `${blocker.qualification} not verified (${blocker.verificationStatus})`;
    case "HARD_QUALIFICATION_EXPIRED":
      return `${blocker.qualification} expired on ${formatDate(blocker.expiresAt)}`;
    case "HARD_QUALIFICATION_EXPIRES_DURING_REQUIREMENT":
      return `${blocker.qualification} expires during the requirement (${formatDate(blocker.expiresAt)})`;
    case "NOT_AVAILABLE":
      return "Not available on the requirement dates";
    case "PARTIAL_AVAILABILITY":
      return `Available for only ${blocker.coveredPercent}% of the requirement period`;
  }
}

export function explainAvailability(coveredPercent: number): ExplainedCheck {
  if (coveredPercent === 100) {
    return {
      label: "Availability",
      detail: "Covers the entire requirement",
      tone: "ok",
      met: true,
    };
  }
  return {
    label: "Availability",
    detail: coveredPercent === 0 ? "Not available" : `Covers ${coveredPercent}% of the period`,
    tone: "danger",
    met: false,
  };
}
