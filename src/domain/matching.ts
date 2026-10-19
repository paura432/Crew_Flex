// Deterministic eligibility engine (BUSINESS_RULES BR-3, BR-5).
// Pure: no I/O, no framework imports. Shared by Next.js and Supabase Edge Functions,
// hence the explicit `.ts` import extensions.
import { availabilityCoverage, type AvailabilityWindow } from "./availability.ts";
import {
  validityForPeriod,
  type HeldQualification,
  type VerificationStatus,
} from "./qualification.ts";
import type { RequirementLevel, WorkRequirement } from "./work-requirement.ts";

export type CandidatePool = "internal" | "external";

export interface Candidate {
  /** Profile id for internal candidates, per-requirement pseudonymous ref for external ones. */
  id: string;
  pool: CandidatePool;
  /** `null` when the professional has not made their identity visible. */
  displayName: string | null;
  baseLocation: string | null;
  yearsExperience: number | null;
  qualifications: HeldQualification[];
  availability: AvailabilityWindow[];
}

export type MatchableRequirement = Pick<
  WorkRequirement,
  "startsAt" | "endsAt" | "urgency" | "qualifications"
>;

export type QualificationOutcome =
  "met" | "missing" | "not_verified" | "expired" | "expires_during";

export interface QualificationCheck {
  qualificationTypeId: string;
  code: string;
  level: RequirementLevel;
  outcome: QualificationOutcome;
  verificationStatus: VerificationStatus | null;
  expiresAt: string | null;
}

export type MatchBlocker =
  | { code: "MISSING_HARD_QUALIFICATION"; qualification: string }
  | {
      code: "HARD_QUALIFICATION_NOT_VERIFIED";
      qualification: string;
      verificationStatus: VerificationStatus;
    }
  | { code: "HARD_QUALIFICATION_EXPIRED"; qualification: string; expiresAt: string }
  | {
      code: "HARD_QUALIFICATION_EXPIRES_DURING_REQUIREMENT";
      qualification: string;
      expiresAt: string;
    }
  | { code: "NOT_AVAILABLE" }
  | { code: "PARTIAL_AVAILABILITY"; coveredPercent: number };

export type MatchReason =
  | { code: "HARD_QUALIFICATIONS_MET"; count: number }
  | {
      code: "SOFT_QUALIFICATION_MET";
      qualification: string;
      verificationStatus: VerificationStatus;
    }
  | { code: "SOFT_QUALIFICATION_MISSING"; qualification: string }
  | { code: "AVAILABILITY_COVERS_REQUIREMENT" };

export interface MatchResult {
  candidateId: string;
  eligible: boolean;
  blockers: MatchBlocker[];
  /** 0–100. Always 0 when not eligible: no score compensates a blocker. */
  softScore: number;
  reasons: MatchReason[];
  qualificationChecks: QualificationCheck[];
  availability: { coveredPercent: number };
}

function checkQualification(
  requirement: MatchableRequirement,
  required: WorkRequirement["qualifications"][number],
  held: HeldQualification | undefined,
): QualificationCheck {
  const base = {
    qualificationTypeId: required.qualificationTypeId,
    code: required.code,
    level: required.level,
    verificationStatus: held?.verificationStatus ?? null,
    expiresAt: held?.expiresAt ?? null,
  };
  if (!held || held.status === "withdrawn") return { ...base, outcome: "missing" };

  // Hard requirements need verified evidence; soft ones accept pending (BR-3, BR-5.2).
  const acceptable: VerificationStatus[] =
    required.level === "hard" ? ["verified"] : ["verified", "pending"];
  if (!acceptable.includes(held.verificationStatus)) return { ...base, outcome: "not_verified" };

  const validity = validityForPeriod(held.expiresAt, requirement.startsAt, requirement.endsAt);
  if (validity !== "valid") return { ...base, outcome: validity };
  return { ...base, outcome: "met" };
}

function hardBlocker(check: QualificationCheck): MatchBlocker | null {
  switch (check.outcome) {
    case "met":
      return null;
    case "missing":
      return { code: "MISSING_HARD_QUALIFICATION", qualification: check.code };
    case "not_verified":
      return {
        code: "HARD_QUALIFICATION_NOT_VERIFIED",
        qualification: check.code,
        verificationStatus: check.verificationStatus ?? "pending",
      };
    case "expired":
      return {
        code: "HARD_QUALIFICATION_EXPIRED",
        qualification: check.code,
        expiresAt: check.expiresAt ?? "",
      };
    case "expires_during":
      return {
        code: "HARD_QUALIFICATION_EXPIRES_DURING_REQUIREMENT",
        qualification: check.code,
        expiresAt: check.expiresAt ?? "",
      };
  }
}

/** Hard filters first, then soft score. Deterministic and explainable. */
export function evaluateMatch(
  requirement: MatchableRequirement,
  candidate: Candidate,
): MatchResult {
  const heldByType = new Map(candidate.qualifications.map((q) => [q.qualificationTypeId, q]));
  const qualificationChecks = requirement.qualifications.map((required) =>
    checkQualification(requirement, required, heldByType.get(required.qualificationTypeId)),
  );

  const blockers: MatchBlocker[] = [];
  const reasons: MatchReason[] = [];

  const hardChecks = qualificationChecks.filter((c) => c.level === "hard");
  for (const check of hardChecks) {
    const blocker = hardBlocker(check);
    if (blocker) blockers.push(blocker);
  }
  if (hardChecks.length > 0 && hardChecks.every((c) => c.outcome === "met")) {
    reasons.push({ code: "HARD_QUALIFICATIONS_MET", count: hardChecks.length });
  }

  const coverage = availabilityCoverage(
    candidate.availability,
    requirement.startsAt,
    requirement.endsAt,
    requirement.urgency,
  );
  if (coverage.fullyCovered) reasons.push({ code: "AVAILABILITY_COVERS_REQUIREMENT" });
  else if (coverage.coveredPercent === 0) blockers.push({ code: "NOT_AVAILABLE" });
  else blockers.push({ code: "PARTIAL_AVAILABILITY", coveredPercent: coverage.coveredPercent });

  const softChecks = qualificationChecks.filter((c) => c.level === "soft");
  for (const check of softChecks) {
    reasons.push(
      check.outcome === "met"
        ? {
            code: "SOFT_QUALIFICATION_MET",
            qualification: check.code,
            verificationStatus: check.verificationStatus ?? "pending",
          }
        : { code: "SOFT_QUALIFICATION_MISSING", qualification: check.code },
    );
  }

  const eligible = blockers.length === 0;
  const softMet = softChecks.filter((c) => c.outcome === "met").length;
  const softScore = !eligible
    ? 0
    : softChecks.length === 0
      ? 100
      : Math.round((100 * softMet) / softChecks.length);

  return {
    candidateId: candidate.id,
    eligible,
    blockers,
    softScore,
    reasons,
    qualificationChecks,
    availability: { coveredPercent: coverage.coveredPercent },
  };
}

/** BR-5.5: eligible first, then soft score desc, then candidate id for stability. */
export function compareMatches(a: MatchResult, b: MatchResult): number {
  if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
  if (a.softScore !== b.softScore) return b.softScore - a.softScore;
  return a.candidateId < b.candidateId ? -1 : a.candidateId > b.candidateId ? 1 : 0;
}
