// Structured explanations of deterministic match results: message keys + parameters, resolved by
// the UI in the active locale (messages/*.json → `matching.*`). Pure: no JSX, no formatting, testable.
import type {
  AffinityCheck,
  MatchBlocker,
  ProfileCheck,
  QualificationCheck,
} from "@/domain/matching";
import type { EnglishLevel, EuCountry, ProfessionalCategory, Skill } from "@/domain/passport";
import type { VerificationStatus } from "@/domain/qualification";

export type CheckTone = "ok" | "warn" | "danger";

export interface ExplainedText {
  key: string;
  params?: {
    code?: string;
    status?: VerificationStatus;
    date?: string;
    percent?: number;
    /** Translated by the UI (country name, `passport.categories`, `passport.skills`). */
    country?: EuCountry;
    category?: ProfessionalCategory | null;
    skill?: Skill;
    /** Aircraft or engine designations, shown as they are («A320 Family / B737 NG»). */
    list?: string;
    count?: number;
    level?: EnglishLevel;
  };
}

export interface ExplainedCheck {
  label: string;
  detail: ExplainedText;
  tone: CheckTone;
  met: boolean;
}

/** A v1.8 profile requirement or affinity row: the label is a message too (v1.8 «Requisitos comprobados»). */
export interface ExplainedRule {
  rule: ProfileCheck["rule"] | AffinityCheck["rule"];
  label: ExplainedText;
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

const designations = (values: readonly string[]) => values.join(" / ");

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
    case "MISSING_WORK_PERMIT":
      return { key: "blocker.workPermit", params: { country: blocker.country } };
    case "CATEGORY_MISMATCH":
      return { key: "blocker.category", params: { category: blocker.category } };
    case "AIRCRAFT_NOT_DECLARED":
      return { key: "blocker.aircraft", params: { list: designations(blocker.aircraft) } };
    case "TYPE_RATING_MISSING":
      return {
        key: "blocker.typeRatingMissing",
        params: { category: blocker.category, list: designations(blocker.aircraft) },
      };
    case "TYPE_RATING_NOT_VALID":
      return {
        key: "blocker.typeRatingNotValid",
        params: {
          category: blocker.category,
          list: designations(blocker.aircraft),
          date: blocker.expiresAt,
        },
      };
    case "TYPE_RATING_RESTRICTED":
      return {
        key: "blocker.typeRatingRestricted",
        params: { category: blocker.category, list: designations(blocker.aircraft) },
      };
    case "ENGINE_NOT_DECLARED":
      return { key: "blocker.engine", params: { list: designations(blocker.engines) } };
    case "INSUFFICIENT_EXPERIENCE":
      return { key: "blocker.experience", params: { count: blocker.minYears } };
    case "MISSING_SKILL":
      return { key: "blocker.skill", params: { skill: blocker.skill } };
    case "NOT_AVAILABLE":
      return { key: "blocker.notAvailable" };
    case "PARTIAL_AVAILABILITY":
      return { key: "blocker.partial", params: { percent: blocker.coveredPercent } };
  }
}

const hardRow = (
  rule: ProfileCheck["rule"],
  label: ExplainedText,
  met: boolean,
  detail: ExplainedText,
): ExplainedRule => ({ rule, label, detail, tone: met ? "ok" : "danger", met });

const declared = (met: boolean): ExplainedText =>
  met ? { key: "profile.declared" } : { key: "profile.notDeclared" };

/** One v1.8 «Requisitos comprobados» row (BR-3.7–3.13): the requirement's value, then the own declaration. */
export function explainProfileCheck(check: ProfileCheck): ExplainedRule {
  switch (check.rule) {
    case "work_permit":
      return hardRow(
        check.rule,
        { key: "profile.workPermit", params: { country: check.country } },
        check.met,
        declared(check.met),
      );
    case "category":
      return hardRow(
        check.rule,
        { key: "profile.category", params: { category: check.category } },
        check.met,
        declared(check.met),
      );
    case "aircraft":
      return hardRow(
        check.rule,
        { key: "profile.aircraft", params: { list: designations(check.aircraft) } },
        check.met,
        declared(check.met),
      );
    case "type_rating":
      return hardRow(
        check.rule,
        {
          key: "profile.typeRating",
          params: { category: check.category, list: designations(check.aircraft) },
        },
        check.met,
        check.issue === "not_valid"
          ? { key: "profile.typeRatingNotValid", params: { date: check.expiresAt ?? "" } }
          : check.issue === "restricted"
            ? { key: "profile.typeRatingRestricted" }
            : check.issue === "missing"
              ? { key: "profile.typeRatingMissing" }
              : { key: "profile.typeRatingMet" },
      );
    case "engine":
      return hardRow(
        check.rule,
        { key: "profile.engine", params: { list: designations(check.engines) } },
        check.met,
        declared(check.met),
      );
    case "min_years":
      return hardRow(
        check.rule,
        { key: "profile.minYears", params: { count: check.minYears } },
        check.met,
        check.years === null
          ? { key: "profile.yearsUndeclared" }
          : { key: "profile.yearsDeclared", params: { count: check.years } },
      );
    case "skill":
      return hardRow(
        check.rule,
        { key: "profile.skill", params: { skill: check.skill } },
        check.met,
        declared(check.met),
      );
  }
}

/** BR-5.6 soft rows: a miss lowers the score and is a warning, never a blocker. */
export function explainAffinity(check: AffinityCheck): ExplainedRule {
  const tone: CheckTone = check.met ? "ok" : "warn";
  if (check.rule === "english") {
    return {
      rule: check.rule,
      label: { key: "affinity.english" },
      detail: check.level
        ? { key: "affinity.englishLevel", params: { level: check.level } }
        : { key: "affinity.englishNone" },
      tone,
      met: check.met,
    };
  }
  return {
    rule: check.rule,
    label: { key: "affinity.base" },
    detail: check.met ? { key: "affinity.baseMet" } : { key: "affinity.baseNotMet" },
    tone,
    met: check.met,
  };
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
