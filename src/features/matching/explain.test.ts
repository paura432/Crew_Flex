import { describe, expect, it } from "vitest";
import { evaluateMatch } from "@/domain/matching";
import { candidate, declared, FULL_HARD_SET, madRequirement, QT } from "../../../fixtures/domain";
import {
  explainAffinity,
  explainAvailability,
  explainBlocker,
  explainCheck,
  explainProfileCheck,
} from "./explain";

describe("match explanations (structured, locale-independent)", () => {
  it("explains a verified, valid qualification with its expiry", () => {
    const result = evaluateMatch(madRequirement(), candidate("c"));
    const b11 = result.qualificationChecks.find((c) => c.code === "B1.1");
    expect(explainCheck(b11!)).toEqual({
      label: "B1.1",
      detail: { key: "check.metVerifiedUntil", params: { date: "2028-12-31" } },
      tone: "ok",
      met: true,
    });
  });

  it("explains blockers as keys with the data the copy needs", () => {
    const result = evaluateMatch(
      madRequirement(),
      candidate("c", {
        qualifications: FULL_HARD_SET.filter((q) => q.qualificationTypeId !== QT.B11),
        availability: [],
      }),
    );
    expect(result.blockers.map(explainBlocker)).toEqual([
      { key: "blocker.missing", params: { code: "B1.1" } },
      { key: "blocker.notAvailable" },
    ]);
  });

  it("explains partial availability with the covered percent", () => {
    expect(explainAvailability(48.78).detail).toEqual({
      key: "availability.partial",
      params: { percent: 48.78 },
    });
    expect(explainAvailability(100).met).toBe(true);
  });

  it("explains every v1.8 profile requirement: the requirement's value, then the own declaration (D-12)", () => {
    const need = madRequirement({
      country: "FR",
      category: "B1.1",
      aircraft: ["A320 Family", "B737 NG"],
      requiresTypeRating: true,
      engines: ["LEAP-1A"],
      minYears: 10,
      requiredSkills: ["borescope"],
    });
    const restricted = candidate("c", {
      declarations: declared({
        typeRatings: [{ aircraft: "B737 NG", category: "B1.1", expiresAt: null, restricted: true }],
      }),
    });
    const result = evaluateMatch(need, restricted);
    expect(result.blockers.map(explainBlocker)).toEqual([
      { key: "blocker.workPermit", params: { country: "FR" } },
      {
        key: "blocker.typeRatingRestricted",
        params: { category: "B1.1", list: "A320 Family / B737 NG" },
      },
      { key: "blocker.engine", params: { list: "LEAP-1A" } },
      { key: "blocker.experience", params: { count: 10 } },
      { key: "blocker.skill", params: { skill: "borescope" } },
    ]);
    expect(result.profileChecks.map(explainProfileCheck)).toEqual([
      {
        rule: "work_permit",
        label: { key: "profile.workPermit", params: { country: "FR" } },
        detail: { key: "profile.notDeclared" },
        tone: "danger",
        met: false,
      },
      {
        rule: "category",
        label: { key: "profile.category", params: { category: "B1.1" } },
        detail: { key: "profile.declared" },
        tone: "ok",
        met: true,
      },
      {
        rule: "aircraft",
        label: { key: "profile.aircraft", params: { list: "A320 Family / B737 NG" } },
        detail: { key: "profile.declared" },
        tone: "ok",
        met: true,
      },
      {
        rule: "type_rating",
        label: {
          key: "profile.typeRating",
          params: { category: "B1.1", list: "A320 Family / B737 NG" },
        },
        detail: { key: "profile.typeRatingRestricted" },
        tone: "danger",
        met: false,
      },
      {
        rule: "engine",
        label: { key: "profile.engine", params: { list: "LEAP-1A" } },
        detail: { key: "profile.notDeclared" },
        tone: "danger",
        met: false,
      },
      {
        rule: "min_years",
        label: { key: "profile.minYears", params: { count: 10 } },
        detail: { key: "profile.yearsDeclared", params: { count: 8 } },
        tone: "danger",
        met: false,
      },
      {
        rule: "skill",
        label: { key: "profile.skill", params: { skill: "borescope" } },
        detail: { key: "profile.notDeclared" },
        tone: "danger",
        met: false,
      },
    ]);
  });

  it("explains a rating that is missing or not valid for the period, and undeclared years", () => {
    const need = madRequirement({
      category: "B1.1",
      aircraft: ["A320 Family"],
      requiresTypeRating: true,
      minYears: 1,
    });
    const expiring = candidate("e", {
      yearsExperience: null,
      declarations: declared({
        typeRatings: [
          { aircraft: "A320 Family", category: "B1.1", expiresAt: "2026-10-20", restricted: false },
        ],
      }),
    });
    const result = evaluateMatch(need, expiring);
    expect(result.blockers.map(explainBlocker)).toEqual([
      {
        key: "blocker.typeRatingNotValid",
        params: { category: "B1.1", list: "A320 Family", date: "2026-10-20" },
      },
      { key: "blocker.experience", params: { count: 1 } },
    ]);
    // Rows 3–4 (category and aircraft are met).
    expect(result.profileChecks.slice(2).map((c) => explainProfileCheck(c).detail)).toEqual([
      { key: "profile.typeRatingNotValid", params: { date: "2026-10-20" } },
      { key: "profile.yearsUndeclared" },
    ]);
    const none = evaluateMatch(
      need,
      candidate("n", { declarations: declared({ typeRatings: [] }) }),
    );
    expect(explainBlocker(none.blockers[0]!)).toEqual({
      key: "blocker.typeRatingMissing",
      params: { category: "B1.1", list: "A320 Family" },
    });
    expect(
      explainProfileCheck(none.profileChecks.find((c) => c.rule === "type_rating")!).detail,
    ).toEqual({
      key: "profile.typeRatingMissing",
    });
    expect(
      explainProfileCheck(
        evaluateMatch(need, candidate("ok")).profileChecks.find((c) => c.rule === "type_rating")!,
      ).detail,
    ).toEqual({ key: "profile.typeRatingMet" });
  });

  it("explains the soft affinity as warnings, never blockers (BR-5.6)", () => {
    const result = evaluateMatch(
      madRequirement(),
      candidate("a", {
        baseLocation: "Sevilla (SVQ)",
        declarations: declared({ englishLevel: null, mobility: "local" }),
      }),
    );
    expect(result.eligible).toBe(true);
    expect(result.affinityChecks.map(explainAffinity)).toEqual([
      {
        rule: "english",
        label: { key: "affinity.english" },
        detail: { key: "affinity.englishNone" },
        tone: "warn",
        met: false,
      },
      {
        rule: "base",
        label: { key: "affinity.base" },
        detail: { key: "affinity.baseNotMet" },
        tone: "warn",
        met: false,
      },
    ]);
    const good = evaluateMatch(madRequirement(), candidate("b"));
    expect(good.affinityChecks.map((c) => explainAffinity(c).detail)).toEqual([
      { key: "affinity.englishLevel", params: { level: "B2" } },
      { key: "affinity.baseMet" },
    ]);
  });
});
