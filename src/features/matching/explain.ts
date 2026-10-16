// Structured explanations of deterministic match results: message keys + parameters, resolved by
// the UI in the active locale (messages/*.json → `matching.*`). Pure: no JSX, no formatting, testable.
import type { MatchBlocker, QualificationCheck } from "@/domain/matching";
import type { VerificationStatus } from "@/domain/qualification";

export type CheckTone = "ok" | "warn" | "danger";

export interface ExplainedText {
  key: string;
  params?: { code?: string; status?: VerificationStatus; date?: string; percent?: number };
}

export interface ExplainedCheck {
  label: string;
  detail: ExplainedText;
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
              ? { key: "check.metVerifiedUntil", params: { date: check.expiresAt } }
              : { key: "check.metVerified" }
            : { key: "check.metPending" },
        tone: check.verificationStatus === "verified" ? "ok" : "warn",
        met: true,
      };
    case "missing":
      return { label: check.code, detail: { key: "check.missing" }, tone: failTone, met: false };
    case "not_verified":
      return {
        label: check.code,
        detail: {
          key: "check.notVerified",
          params: { status: check.verificationStatus ?? "pending" },
        },
        tone: failTone,
        met: false,
      };
    case "expired":
      return {
        label: check.code,
        detail: { key: "check.expired", params: { date: check.expiresAt ?? "" } },
        tone: failTone,
        met: false,
      };
    case "expires_during":
      return {
        label: check.code,
        detail: { key: "check.expiresDuring", params: { date: check.expiresAt ?? "" } },
        tone: failTone,
        met: false,
      };
  }
}

export function explainBlocker(blocker: MatchBlocker): ExplainedText {
  switch (blocker.code) {
    case "MISSING_HARD_QUALIFICATION":
      return { key: "blocker.missing", params: { code: blocker.qualification } };
    case "HARD_QUALIFICATION_NOT_VERIFIED":
      return {
        key: "blocker.notVerified",
        params: { code: blocker.qualification, status: blocker.verificationStatus },
      };
    case "HARD_QUALIFICATION_EXPIRED":
      return {
        key: "blocker.expired",
        params: { code: blocker.qualification, date: blocker.expiresAt },
      };
    case "HARD_QUALIFICATION_EXPIRES_DURING_REQUIREMENT":
      return {
        key: "blocker.expiresDuring",
        params: { code: blocker.qualification, date: blocker.expiresAt },
      };
    case "NOT_AVAILABLE":
      return { key: "blocker.notAvailable" };
    case "PARTIAL_AVAILABILITY":
      return { key: "blocker.partial", params: { percent: blocker.coveredPercent } };
  }
}

export function explainAvailability(coveredPercent: number): ExplainedCheck {
  if (coveredPercent === 100) {
    return { label: "availability", detail: { key: "availability.full" }, tone: "ok", met: true };
  }
  return {
    label: "availability",
    detail:
      coveredPercent === 0
        ? { key: "availability.none" }
        : { key: "availability.partial", params: { percent: coveredPercent } },
    tone: "danger",
    met: false,
  };
}
