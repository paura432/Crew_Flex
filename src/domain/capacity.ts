// Capacity is a first-class domain concept (BUSINESS_RULES BR-6). It reuses evaluateMatch()
// so there is exactly one eligibility algorithm.
import {
  evaluateMatch,
  type Candidate,
  type MatchableRequirement,
  type MatchResult,
} from "./matching.ts";
import type { WorkRequirement } from "./work-requirement.ts";

export class InvalidRequirementError extends Error {
  override readonly name = "InvalidRequirementError";
}

/**
 * BR-1.4 defense in depth: a requirement without any hard qualification is not evaluable (every
 * available professional would look eligible). The database enforces the same invariant
 * (migration 20261015130000) for every non-draft requirement.
 */
export function assertEvaluableRequirement(requirement: MatchableRequirement): void {
  if (!requirement.qualifications.some((q) => q.level === "hard")) {
    throw new InvalidRequirementError("Requirement needs at least one hard qualification");
  }
}

export interface CapacityResult {
  required: number;
  internallyEligible: number;
  gap: number;
  /** 0–100, rounded to 2 decimals. */
  coveragePercent: number;
}

export interface CapacityEvaluation extends CapacityResult {
  internalMatches: MatchResult[];
}

export function evaluateCapacity(
  requirement: MatchableRequirement & Pick<WorkRequirement, "headcount">,
  workforce: Candidate[],
): CapacityEvaluation {
  const required = requirement.headcount;
  if (!Number.isInteger(required) || required < 1) {
    throw new InvalidRequirementError("Requirement headcount must be a positive integer");
  }
  assertEvaluableRequirement(requirement);

  const internalMatches = workforce.map((candidate) => evaluateMatch(requirement, candidate));
  const internallyEligible = internalMatches.filter((m) => m.eligible).length;

  return {
    required,
    internallyEligible,
    gap: Math.max(0, required - internallyEligible),
    coveragePercent: Math.min(100, Math.round((internallyEligible / required) * 10_000) / 100),
    internalMatches,
  };
}
