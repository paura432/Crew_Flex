// Deterministic eligibility engine (BUSINESS_RULES BR-3, BR-5).
// Pure: no I/O, no framework imports. Shared by Next.js and Supabase Edge Functions,
// hence the explicit `.ts` import extensions.
//
// SQL mirror (it only orders and caps, the verdict is this function): app_private.hard_eligibility and
// app_private.ranked_external_pool (qualifications + availability, 20261022130300 / 20261023500200) and
// app_private.profile_rules_ok (the v1.8 profile requirements, 20261023900100). Parity suites: tests/db
// rls M/P/W and matching-v18.
import { availabilityCoverage, type AvailabilityWindow } from "./availability.ts";
import {
  type Aircraft,
  type Engine,
  type EnglishLevel,
  type EuCountry,
  type LicenceCategory,
  meetsEnglishLevel,
  type ProfessionalCategory,
  type Skill,
} from "./passport.ts";
import type { Mobility } from "./professional.ts";
import {
  validityForPeriod,
  type HeldQualification,
  type VerificationStatus,
} from "./qualification.ts";
import type {
  RequirementLevel,
  RequirementProfileRules,
  WorkRequirement,
} from "./work-requirement.ts";

export type CandidatePool = "internal" | "external";

/** A declared type rating as matching reads it: whether it has restrictions, never their text. */
export interface DeclaredTypeRating {
  aircraft: Aircraft;
  category: LicenceCategory;
  /** `YYYY-MM-DD`, valid through the whole UTC day (BR-2); null = no validity applies. */
  expiresAt: string | null;
  restricted: boolean;
}

/**
 * The professional's own passport declarations that matching reads (BR-18): never contact, employer, rate,
 * blocks or restriction text. For an organization the pool sends only the engines, capabilities and type
 * ratings its requirement asks about — nothing else can change that requirement's verdict.
 */
export interface CandidateDeclarations {
  primaryCategory: ProfessionalCategory | null;
  categories: ProfessionalCategory[];
  aircraft: Aircraft[];
  engines: Engine[];
  skills: Skill[];
  englishLevel: EnglishLevel | null;
  mobility: Mobility;
  workPermits: EuCountry[];
  typeRatings: DeclaredTypeRating[];
  /** Any general restriction or restricted rating (v1.8 «Con restricciones»). Display only. */
  hasRestrictions: boolean;
}

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
  declarations: CandidateDeclarations;
}

/** The profile rules are optional: absent = not required (hand-built requirements, older functions). */
export type MatchableRequirement = Pick<
  WorkRequirement,
  "startsAt" | "endsAt" | "urgency" | "qualifications"
> &
  RequirementProfileRules &
  Partial<Pick<WorkRequirement, "location">>;

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

/** Why no declared type rating satisfies «Exigir habilitación de tipo» (BR-3.10). */
export type TypeRatingIssue = "missing" | "not_valid" | "restricted";

/**
 * One row per profile requirement the work requirement states (v1.8 «Requisitos comprobados»), in the
 * fixed order work permit, category, aircraft, type rating, engines, experience, capabilities.
 */
export type ProfileCheck =
  | { rule: "work_permit"; met: boolean; country: EuCountry }
  | { rule: "category"; met: boolean; category: ProfessionalCategory }
  | { rule: "aircraft"; met: boolean; aircraft: Aircraft[] }
  | {
      rule: "type_rating";
      met: boolean;
      category: ProfessionalCategory | null;
      aircraft: Aircraft[];
      issue: TypeRatingIssue | null;
      /** Latest expiry of the matching ratings when `issue = not_valid`. */
      expiresAt: string | null;
    }
  | { rule: "engine"; met: boolean; engines: Engine[] }
  | { rule: "min_years"; met: boolean; minYears: number; years: number | null }
  | { rule: "skill"; met: boolean; skill: Skill };

/** v1.8 soft affinity, always evaluated and never a blocker (BR-5.6). */
export type AffinityCheck =
  { rule: "english"; met: boolean; level: EnglishLevel | null } | { rule: "base"; met: boolean };

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
  | { code: "MISSING_WORK_PERMIT"; country: EuCountry }
  | { code: "CATEGORY_MISMATCH"; category: ProfessionalCategory }
  | { code: "AIRCRAFT_NOT_DECLARED"; aircraft: Aircraft[] }
  | { code: "TYPE_RATING_MISSING"; category: ProfessionalCategory | null; aircraft: Aircraft[] }
  | {
      code: "TYPE_RATING_NOT_VALID";
      category: ProfessionalCategory | null;
      aircraft: Aircraft[];
      expiresAt: string;
    }
  | { code: "TYPE_RATING_RESTRICTED"; category: ProfessionalCategory | null; aircraft: Aircraft[] }
  | { code: "ENGINE_NOT_DECLARED"; engines: Engine[] }
  | { code: "INSUFFICIENT_EXPERIENCE"; minYears: number; years: number | null }
  | { code: "MISSING_SKILL"; skill: Skill }
  | { code: "NOT_AVAILABLE" }
  | { code: "PARTIAL_AVAILABILITY"; coveredPercent: number };

export type MatchReason =
  | { code: "HARD_QUALIFICATIONS_MET"; count: number }
  | { code: "PROFILE_REQUIREMENTS_MET"; count: number }
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
  /** Empty when the requirement states no profile requirement. */
  profileChecks: ProfileCheck[];
  affinityChecks: AffinityCheck[];
  availability: { coveredPercent: number };
}

/** v1.8 «Inglés técnico»: B2, C1 or C2 (`business.js:159`). */
export const TECHNICAL_ENGLISH_MIN: EnglishLevel = "B2";

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

/**
 * BR-3.10: a declared rating of the required category on one of the accepted aircraft, valid for the whole
 * period (BR-2, `endsAt − 1 ms`) and without restrictions. When none qualifies, the closest miss: a valid
 * one that is restricted, else one that is not valid for the period, else none at all.
 */
function typeRatingCheck(
  requirement: MatchableRequirement,
  ratings: readonly DeclaredTypeRating[],
): Extract<ProfileCheck, { rule: "type_rating" }> {
  const category = requirement.category ?? null;
  const aircraft = requirement.aircraft ?? [];
  const matching = ratings.filter((r) => r.category === category && aircraft.includes(r.aircraft));
  const valid = matching.filter(
    (r) => validityForPeriod(r.expiresAt, requirement.startsAt, requirement.endsAt) === "valid",
  );
  const base = { rule: "type_rating" as const, category, aircraft };
  if (valid.some((r) => !r.restricted)) return { ...base, met: true, issue: null, expiresAt: null };
  if (valid.length > 0) return { ...base, met: false, issue: "restricted", expiresAt: null };
  if (matching.length > 0) {
    // Not valid ⇒ every matching rating has an expiry date (null is always valid).
    const latest =
      matching
        .map((r) => r.expiresAt ?? "")
        .sort()
        .at(-1) ?? "";
    return { ...base, met: false, issue: "not_valid", expiresAt: latest };
  }
  return { ...base, met: false, issue: "missing", expiresAt: null };
}

/** BR-3.7–3.13: the profile requirements this requirement states, against the own declarations. */
function profileChecksFor(requirement: MatchableRequirement, candidate: Candidate): ProfileCheck[] {
  const d = candidate.declarations;
  const checks: ProfileCheck[] = [];
  if (requirement.country) {
    const country = requirement.country;
    checks.push({ rule: "work_permit", country, met: d.workPermits.includes(country) });
  }
  if (requirement.category) {
    const category = requirement.category;
    checks.push({ rule: "category", category, met: d.categories.includes(category) });
  }
  const aircraft = requirement.aircraft ?? [];
  if (aircraft.length > 0) {
    checks.push({ rule: "aircraft", aircraft, met: aircraft.some((a) => d.aircraft.includes(a)) });
  }
  if (requirement.requiresTypeRating) checks.push(typeRatingCheck(requirement, d.typeRatings));
  const engines = requirement.engines ?? [];
  if (engines.length > 0) {
    checks.push({ rule: "engine", engines, met: engines.some((e) => d.engines.includes(e)) });
  }
  if (requirement.minYears !== undefined && requirement.minYears !== null) {
    const minYears = requirement.minYears;
    const years = candidate.yearsExperience;
    checks.push({ rule: "min_years", minYears, years, met: (years ?? 0) >= minYears });
  }
  for (const skill of requirement.requiredSkills ?? []) {
    checks.push({ rule: "skill", skill, met: d.skills.includes(skill) });
  }
  return checks;
}

function profileBlocker(check: ProfileCheck): MatchBlocker | null {
  if (check.met) return null;
  switch (check.rule) {
    case "work_permit":
      return { code: "MISSING_WORK_PERMIT", country: check.country };
    case "category":
      return { code: "CATEGORY_MISMATCH", category: check.category };
    case "aircraft":
      return { code: "AIRCRAFT_NOT_DECLARED", aircraft: check.aircraft };
    case "type_rating": {
      const { category, aircraft } = check;
      if (check.issue === "restricted")
        return { code: "TYPE_RATING_RESTRICTED", category, aircraft };
      if (check.issue === "not_valid")
        return {
          code: "TYPE_RATING_NOT_VALID",
          category,
          aircraft,
          expiresAt: check.expiresAt ?? "",
        };
      return { code: "TYPE_RATING_MISSING", category, aircraft };
    }
    case "engine":
      return { code: "ENGINE_NOT_DECLARED", engines: check.engines };
    case "min_years":
      return { code: "INSUFFICIENT_EXPERIENCE", minYears: check.minYears, years: check.years };
    case "skill":
      return { code: "MISSING_SKILL", skill: check.skill };
  }
}

const normalizedBase = (value: string | null | undefined) =>
  (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/**
 * BR-5.6 (v1.8 demo `business.js:155-160`): «Inglés técnico» (B2 or above) and «Base habitual o movilidad
 * aceptada» (same base, compared without case or extra spaces, or a mobility other than `local`).
 */
function affinityChecksFor(
  requirement: MatchableRequirement,
  candidate: Candidate,
): AffinityCheck[] {
  const level = candidate.declarations.englishLevel;
  const base = normalizedBase(candidate.baseLocation);
  const sameBase = base !== "" && base === normalizedBase(requirement.location);
  return [
    { rule: "english", level, met: meetsEnglishLevel(level, TECHNICAL_ENGLISH_MIN) },
    { rule: "base", met: sameBase || candidate.declarations.mobility !== "local" },
  ];
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

  const profileChecks = profileChecksFor(requirement, candidate);
  for (const check of profileChecks) {
    const blocker = profileBlocker(check);
    if (blocker) blockers.push(blocker);
  }
  if (profileChecks.length > 0 && profileChecks.every((c) => c.met)) {
    reasons.push({ code: "PROFILE_REQUIREMENTS_MET", count: profileChecks.length });
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
  const affinityChecks = affinityChecksFor(requirement, candidate);

  // BR-5.3: soft qualifications + the two affinity items (never empty, so no «nothing to score» case).
  const eligible = blockers.length === 0;
  const softMet =
    softChecks.filter((c) => c.outcome === "met").length +
    affinityChecks.filter((c) => c.met).length;
  const softTotal = softChecks.length + affinityChecks.length;
  const softScore = eligible ? Math.round((100 * softMet) / softTotal) : 0;

  return {
    candidateId: candidate.id,
    eligible,
    blockers,
    softScore,
    reasons,
    qualificationChecks,
    profileChecks,
    affinityChecks,
    availability: { coveredPercent: coverage.coveredPercent },
  };
}

/** BR-5.5: eligible first, then soft score desc, then candidate id for stability. */
export function compareMatches(a: MatchResult, b: MatchResult): number {
  if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
  if (a.softScore !== b.softScore) return b.softScore - a.softScore;
  return a.candidateId < b.candidateId ? -1 : a.candidateId > b.candidateId ? 1 : 0;
}
