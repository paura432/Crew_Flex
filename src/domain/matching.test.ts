import { describe, expect, it } from "vitest";
import {
  candidate,
  declared,
  FULL_HARD_SET,
  held,
  madRequirement,
  QT,
  required,
} from "../../fixtures/domain";
import { compareMatches, evaluateMatch } from "./matching.ts";

const requirement = madRequirement();

describe("evaluateMatch — hard filters", () => {
  it("1. all hard requirements fulfilled → eligible", () => {
    const result = evaluateMatch(requirement, candidate("c1"));
    expect(result.eligible).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.reasons).toContainEqual({ code: "HARD_QUALIFICATIONS_MET", count: 5 });
    expect(result.reasons).toContainEqual({ code: "AVAILABILITY_COVERS_REQUIREMENT" });
  });

  it("2. missing hard qualification → not eligible, score 0", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c2", {
        qualifications: [
          ...FULL_HARD_SET.filter((q) => q.qualificationTypeId !== QT.B11),
          held(QT.SMS),
        ],
      }),
    );
    expect(result.eligible).toBe(false);
    expect(result.blockers).toEqual([
      { code: "MISSING_HARD_QUALIFICATION", qualification: "B1.1" },
    ]);
    expect(result.softScore).toBe(0);
  });

  it("2b. a high soft score never compensates a missing hard requirement", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c2b", { qualifications: [held(QT.SMS), held(QT.A320)] }),
    );
    expect(result.eligible).toBe(false);
    expect(result.softScore).toBe(0);
    expect(result.reasons).toContainEqual({
      code: "SOFT_QUALIFICATION_MET",
      qualification: "SMS",
      verificationStatus: "verified",
    });
  });

  it("2c. withdrawn qualification counts as missing", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c2c", {
        qualifications: FULL_HARD_SET.map((q) =>
          q.qualificationTypeId === QT.FTS ? { ...q, status: "withdrawn" as const } : q,
        ),
      }),
    );
    expect(result.blockers).toEqual([{ code: "MISSING_HARD_QUALIFICATION", qualification: "FTS" }]);
  });

  it("3. expired hard qualification → not eligible", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c3", {
        qualifications: FULL_HARD_SET.map((q) =>
          q.qualificationTypeId === QT.FTS ? { ...q, expiresAt: "2026-09-30" } : q,
        ),
      }),
    );
    expect(result.eligible).toBe(false);
    expect(result.blockers).toEqual([
      { code: "HARD_QUALIFICATION_EXPIRED", qualification: "FTS", expiresAt: "2026-09-30" },
    ]);
  });

  it("3b. hard qualification expiring inside the period → not eligible", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c3b", {
        qualifications: FULL_HARD_SET.map((q) =>
          q.qualificationTypeId === QT.EWIS ? { ...q, expiresAt: "2026-10-20" } : q,
        ),
      }),
    );
    expect(result.blockers).toEqual([
      {
        code: "HARD_QUALIFICATION_EXPIRES_DURING_REQUIREMENT",
        qualification: "EWIS",
        expiresAt: "2026-10-20",
      },
    ]);
  });

  it("3c. expiring on the last day of the period is still valid", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c3c", {
        qualifications: FULL_HARD_SET.map((q) =>
          q.qualificationTypeId === QT.EWIS ? { ...q, expiresAt: "2026-10-22" } : q,
        ),
      }),
    );
    expect(result.eligible).toBe(true);
  });

  it("3d. self-declared (pending) hard qualification → not eligible", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c3d", {
        qualifications: FULL_HARD_SET.map((q) =>
          q.qualificationTypeId === QT.B11 ? { ...q, verificationStatus: "pending" as const } : q,
        ),
      }),
    );
    expect(result.eligible).toBe(false);
    expect(result.blockers).toEqual([
      {
        code: "HARD_QUALIFICATION_NOT_VERIFIED",
        qualification: "B1.1",
        verificationStatus: "pending",
      },
    ]);
  });

  it("7. multiple hard qualifications → all are required, all failures reported", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c7", { qualifications: [held(QT.B11), held(QT.A320)] }),
    );
    expect(result.eligible).toBe(false);
    expect(
      result.blockers.map((b) => b.code === "MISSING_HARD_QUALIFICATION" && b.qualification),
    ).toEqual(["EWIS", "HF", "FTS"]);
  });
});

describe("evaluateMatch — soft score", () => {
  it("4. missing soft qualification → still eligible, lower score", () => {
    const withSoft = evaluateMatch(
      requirement,
      candidate("with", { qualifications: [...FULL_HARD_SET, held(QT.SMS)] }),
    );
    const withoutSoft = evaluateMatch(requirement, candidate("without"));
    expect(withSoft.eligible).toBe(true);
    expect(withoutSoft.eligible).toBe(true);
    expect(withSoft.softScore).toBe(100);
    // SMS missing; English B2 and the base still count (BR-5.6): 2 of 3 soft items.
    expect(withoutSoft.softScore).toBe(67);
    expect(withoutSoft.reasons).toContainEqual({
      code: "SOFT_QUALIFICATION_MISSING",
      qualification: "SMS",
    });
  });

  it("pending soft qualification counts as met and is flagged", () => {
    const result = evaluateMatch(
      requirement,
      candidate("pending-soft", {
        qualifications: [...FULL_HARD_SET, held(QT.SMS, { verificationStatus: "pending" })],
      }),
    );
    expect(result.softScore).toBe(100);
    expect(result.reasons).toContainEqual({
      code: "SOFT_QUALIFICATION_MET",
      qualification: "SMS",
      verificationStatus: "pending",
    });
  });

  it("no soft qualification → the score is the two affinity items (100 when both are met)", () => {
    const hardOnly = madRequirement({ qualifications: [required(QT.B11)] });
    expect(evaluateMatch(hardOnly, candidate("c")).softScore).toBe(100);
  });
});

describe("evaluateMatch — availability", () => {
  it("5. candidate unavailable → not eligible", () => {
    const result = evaluateMatch(requirement, candidate("c5", { availability: [] }));
    expect(result.eligible).toBe(false);
    expect(result.blockers).toEqual([{ code: "NOT_AVAILABLE" }]);
  });

  it("5b. an unavailable window overrides an available one", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c5b", {
        availability: [
          ...[
            {
              startsAt: "2026-10-01T00:00:00Z",
              endsAt: "2026-11-01T00:00:00Z",
              status: "available" as const,
            },
          ],
          {
            startsAt: "2026-10-20T00:00:00Z",
            endsAt: "2026-10-21T00:00:00Z",
            status: "unavailable",
          },
        ],
      }),
    );
    expect(result.eligible).toBe(false);
    expect(result.blockers[0]?.code).toBe("PARTIAL_AVAILABILITY");
  });

  it("6. partial overlap → explicitly NOT eligible in V0, with covered percentage", () => {
    // Available until 20 Oct 12:00; requirement runs 18 Oct 20:00 → 22 Oct 06:00 (82 h).
    const result = evaluateMatch(
      requirement,
      candidate("c6", {
        availability: [
          { startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-20T12:00:00Z", status: "available" },
        ],
      }),
    );
    expect(result.eligible).toBe(false);
    expect(result.blockers).toEqual([{ code: "PARTIAL_AVAILABILITY", coveredPercent: 48.78 }]);
    expect(result.availability.coveredPercent).toBe(48.78);
  });

  it("adjacent windows merge into full coverage", () => {
    const result = evaluateMatch(
      requirement,
      candidate("c-adjacent", {
        availability: [
          { startsAt: "2026-10-18T00:00:00Z", endsAt: "2026-10-20T00:00:00Z", status: "available" },
          { startsAt: "2026-10-20T00:00:00Z", endsAt: "2026-10-23T00:00:00Z", status: "available" },
        ],
      }),
    );
    expect(result.eligible).toBe(true);
  });
});

describe("compareMatches", () => {
  it("orders eligible first, then score, then id", () => {
    const results = [
      evaluateMatch(requirement, candidate("z-ineligible", { availability: [] })),
      evaluateMatch(requirement, candidate("b-eligible")),
      evaluateMatch(requirement, candidate("a-eligible")),
      evaluateMatch(
        requirement,
        candidate("c-best", { qualifications: [...FULL_HARD_SET, held(QT.SMS)] }),
      ),
    ].sort(compareMatches);
    expect(results.map((r) => r.candidateId)).toEqual([
      "c-best",
      "a-eligible",
      "b-eligible",
      "z-ineligible",
    ]);
  });
});

// v1.8 profile requirements (BR-3.7–3.13, T-80…T-86). MAD period 2026-10-18 20:00Z → 2026-10-22 06:00Z:
// last UTC day 22 (BR-2, endsAt − 1 ms).
const A320 = "A320 Family" as const;
const B737 = "B737 NG" as const;
type Rating = {
  aircraft: typeof A320 | typeof B737 | "ATR 72";
  category: "B1.1" | "B2" | "CAT-A";
  expiresAt: string | null;
  restricted: boolean;
};
const rating = (overrides: Partial<Rating> = {}): Rating => ({
  aircraft: A320,
  category: "B1.1",
  expiresAt: null,
  restricted: false,
  ...overrides,
});

describe("evaluateMatch — v1.8 profile requirements", () => {
  it("a requirement that states none keeps its verdict and has no profile row", () => {
    const bare = declared({ categories: [], aircraft: [], workPermits: [], typeRatings: [] });
    const result = evaluateMatch(requirement, candidate("none", { declarations: bare }));
    expect(result.eligible).toBe(true);
    expect(result.profileChecks).toEqual([]);
    expect(result.reasons.some((r) => r.code === "PROFILE_REQUIREMENTS_MET")).toBe(false);
  });

  describe("BR-3.7 work permit for the job country", () => {
    it("declared → met", () => {
      const result = evaluateMatch(madRequirement({ country: "ES" }), candidate("es"));
      expect(result.eligible).toBe(true);
      expect(result.profileChecks).toEqual([{ rule: "work_permit", country: "ES", met: true }]);
      expect(result.reasons).toContainEqual({ code: "PROFILE_REQUIREMENTS_MET", count: 1 });
    });
    it("another country → «Falta declarar permiso de trabajo para el país», score 0", () => {
      const result = evaluateMatch(madRequirement({ country: "FR" }), candidate("fr"));
      expect(result.eligible).toBe(false);
      expect(result.blockers).toEqual([{ code: "MISSING_WORK_PERMIT", country: "FR" }]);
      expect(result.softScore).toBe(0);
    });
    it("no permit declared at all → blocked (an empty list never matches)", () => {
      const result = evaluateMatch(
        madRequirement({ country: "ES" }),
        candidate("nopermit", { declarations: declared({ workPermits: [] }) }),
      );
      expect(result.blockers).toEqual([{ code: "MISSING_WORK_PERMIT", country: "ES" }]);
    });
  });

  describe("BR-3.8 category", () => {
    it("among the declared categories (not only the main one) → met", () => {
      const result = evaluateMatch(
        madRequirement({ category: "B2" }),
        candidate("b2", { declarations: declared({ categories: ["B1.1", "B2"] }) }),
      );
      expect(result.eligible).toBe(true);
    });
    it("not declared → «La categoría no coincide»", () => {
      const result = evaluateMatch(madRequirement({ category: "B2" }), candidate("b11"));
      expect(result.blockers).toEqual([{ code: "CATEGORY_MISMATCH", category: "B2" }]);
    });
    it("nothing declared → blocked", () => {
      const result = evaluateMatch(
        madRequirement({ category: "B1.1" }),
        candidate("nocat", { declarations: declared({ primaryCategory: null, categories: [] }) }),
      );
      expect(result.blockers).toEqual([{ code: "CATEGORY_MISMATCH", category: "B1.1" }]);
    });
  });

  describe("BR-3.9 accepted aircraft («cualquiera de»)", () => {
    const need = madRequirement({ aircraft: [A320, B737] });
    it("«A320 Family o B737 NG» accepts whoever declares one of the two", () => {
      expect(evaluateMatch(need, candidate("a320")).eligible).toBe(true);
      const b737 = candidate("b737", { declarations: declared({ aircraft: [B737] }) });
      expect(evaluateMatch(need, b737).eligible).toBe(true);
    });
    it("neither declared → «La aeronave no está declarada en el perfil»", () => {
      const atr = candidate("atr", { declarations: declared({ aircraft: ["ATR 72"] }) });
      expect(evaluateMatch(need, atr).blockers).toEqual([
        { code: "AIRCRAFT_NOT_DECLARED", aircraft: [A320, B737] },
      ]);
    });
    it("an empty list states no aircraft rule", () => {
      const atr = candidate("atr", { declarations: declared({ aircraft: ["ATR 72"] }) });
      const result = evaluateMatch(madRequirement({ aircraft: [] }), atr);
      expect(result.eligible).toBe(true);
      expect(result.profileChecks).toEqual([]);
    });
  });

  describe("BR-3.10 type rating: category × an accepted aircraft, valid for the period, unrestricted", () => {
    const need = madRequirement({
      category: "B1.1",
      aircraft: [A320, B737],
      requiresTypeRating: true,
    });
    const withRatings = (typeRatings: Rating[]) =>
      candidate("r", { declarations: declared({ aircraft: [A320, B737], typeRatings }) });
    const blockersWith = (typeRatings: Rating[]) =>
      evaluateMatch(need, withRatings(typeRatings)).blockers;

    it("valid and unrestricted on one accepted aircraft → met", () => {
      const result = evaluateMatch(need, withRatings([rating({ aircraft: B737 })]));
      expect(result.eligible).toBe(true);
      expect(result.profileChecks).toContainEqual({
        rule: "type_rating",
        category: "B1.1",
        aircraft: [A320, B737],
        met: true,
        issue: null,
        expiresAt: null,
      });
    });
    it("a declared restriction on the required rating → not eligible (C-10 default)", () => {
      const result = evaluateMatch(need, withRatings([rating({ restricted: true })]));
      expect(result.eligible).toBe(false);
      expect(result.softScore).toBe(0);
      expect(result.blockers).toEqual([
        { code: "TYPE_RATING_RESTRICTED", category: "B1.1", aircraft: [A320, B737] },
      ]);
    });
    it("a restricted rating does not block when another accepted one is clean", () => {
      const ratings = [rating({ restricted: true }), rating({ aircraft: B737 })];
      expect(blockersWith(ratings)).toEqual([]);
    });
    it("validity: the last UTC day is enough, the day before is not (BR-2)", () => {
      expect(blockersWith([rating({ expiresAt: "2026-10-22" })])).toEqual([]);
      const notValid = (expiresAt: string) => ({
        code: "TYPE_RATING_NOT_VALID",
        category: "B1.1",
        aircraft: [A320, B737],
        expiresAt,
      });
      expect(blockersWith([rating({ expiresAt: "2026-10-21" })])).toEqual([notValid("2026-10-21")]);
      // Reports the latest expiry of the matching ratings.
      const twoOld = [
        rating({ expiresAt: "2026-10-17" }),
        rating({ aircraft: B737, expiresAt: "2026-10-20" }),
      ];
      expect(blockersWith(twoOld)).toEqual([notValid("2026-10-20")]);
    });
    it("a period ending exactly at 00:00Z ends the previous day (endsAt − 1 ms)", () => {
      const lastDay = withRatings([rating({ expiresAt: "2026-10-22" })]);
      expect(evaluateMatch({ ...need, endsAt: "2026-10-23T00:00:00Z" }, lastDay).eligible).toBe(
        true,
      );
      expect(evaluateMatch({ ...need, endsAt: "2026-10-23T00:00:00.001Z" }, lastDay).eligible).toBe(
        false,
      );
    });
    it("expired and restricted at once: the valid restricted one is the reported miss", () => {
      const ratings = [
        rating({ expiresAt: "2026-10-01" }),
        rating({ aircraft: B737, restricted: true }),
      ];
      expect(blockersWith(ratings).map((b) => b.code)).toEqual(["TYPE_RATING_RESTRICTED"]);
    });
    it("other category, other aircraft or none → «Falta habilitación de tipo declarada y vigente, sin restricciones»", () => {
      for (const ratings of [[rating({ category: "B2" })], [rating({ aircraft: "ATR 72" })], []]) {
        expect(blockersWith(ratings)).toEqual([
          { code: "TYPE_RATING_MISSING", category: "B1.1", aircraft: [A320, B737] },
        ]);
      }
    });
    it("without a category or aircraft to match, nothing satisfies it (fail closed)", () => {
      const incomplete = madRequirement({ requiresTypeRating: true });
      expect(evaluateMatch(incomplete, withRatings([rating()])).blockers).toEqual([
        { code: "TYPE_RATING_MISSING", category: null, aircraft: [] },
      ]);
    });
  });

  describe("BR-3.11 engines («basta uno»)", () => {
    const need = madRequirement({ engines: ["CFM56-5B/7B", "LEAP-1A"] });
    it("one declared → met", () => {
      const leap = candidate("leap", { declarations: declared({ engines: ["LEAP-1A"] }) });
      expect(evaluateMatch(need, leap).eligible).toBe(true);
    });
    it("none of them → blocked", () => {
      const pw = candidate("pw", { declarations: declared({ engines: ["PW1100G"] }) });
      expect(evaluateMatch(need, pw).blockers).toEqual([
        { code: "ENGINE_NOT_DECLARED", engines: ["CFM56-5B/7B", "LEAP-1A"] },
      ]);
    });
    it("no engine declared → blocked", () => {
      expect(evaluateMatch(need, candidate("none")).eligible).toBe(false);
    });
  });

  describe("BR-3.12 minimum years of experience", () => {
    it("«Experiencia mínima 5» leaves out who declares 4 («No alcanza la experiencia mínima»)", () => {
      const result = evaluateMatch(
        madRequirement({ minYears: 5 }),
        candidate("four", { yearsExperience: 4 }),
      );
      expect(result.eligible).toBe(false);
      expect(result.blockers).toEqual([{ code: "INSUFFICIENT_EXPERIENCE", minYears: 5, years: 4 }]);
    });
    it("exactly the minimum → met", () => {
      const five = candidate("five", { yearsExperience: 5 });
      expect(evaluateMatch(madRequirement({ minYears: 5 }), five).eligible).toBe(true);
    });
    it("undeclared experience counts as 0: blocked from 1, fine with 0; null states no rule", () => {
      const blank = candidate("blank", { yearsExperience: null });
      expect(evaluateMatch(madRequirement({ minYears: 1 }), blank).blockers).toEqual([
        { code: "INSUFFICIENT_EXPERIENCE", minYears: 1, years: null },
      ]);
      expect(evaluateMatch(madRequirement({ minYears: 0 }), blank).eligible).toBe(true);
      expect(evaluateMatch(madRequirement({ minYears: null }), blank).profileChecks).toEqual([]);
    });
  });

  describe("BR-3.13 required capabilities (all of them)", () => {
    const need = madRequirement({ requiredSkills: ["line_maintenance", "borescope"] });
    it("all declared → met", () => {
      const both = candidate("both", {
        declarations: declared({ skills: ["borescope", "line_maintenance", "ndt"] }),
      });
      expect(evaluateMatch(need, both).eligible).toBe(true);
    });
    it("one missing → «Capacidad requerida: …» for that one only", () => {
      const one = candidate("one", { declarations: declared({ skills: ["line_maintenance"] }) });
      expect(evaluateMatch(need, one).blockers).toEqual([
        { code: "MISSING_SKILL", skill: "borescope" },
      ]);
    });
    it("none declared → one blocker per capability", () => {
      expect(evaluateMatch(need, candidate("none")).blockers).toEqual([
        { code: "MISSING_SKILL", skill: "line_maintenance" },
        { code: "MISSING_SKILL", skill: "borescope" },
      ]);
    });
  });

  it("every failure is reported in a fixed order, qualifications first, availability last", () => {
    const need = madRequirement({
      country: "FR",
      category: "B2",
      aircraft: [B737],
      requiresTypeRating: true,
      engines: ["GE90"],
      minYears: 30,
      requiredSkills: ["ndt"],
    });
    const result = evaluateMatch(
      need,
      candidate("all", { qualifications: FULL_HARD_SET.slice(1), availability: [] }),
    );
    expect(result.blockers.map((b) => b.code)).toEqual([
      "MISSING_HARD_QUALIFICATION",
      "MISSING_WORK_PERMIT",
      "CATEGORY_MISMATCH",
      "AIRCRAFT_NOT_DECLARED",
      "TYPE_RATING_MISSING",
      "ENGINE_NOT_DECLARED",
      "INSUFFICIENT_EXPERIENCE",
      "MISSING_SKILL",
      "NOT_AVAILABLE",
    ]);
    expect(result.profileChecks.map((c) => c.rule)).toEqual([
      "work_permit",
      "category",
      "aircraft",
      "type_rating",
      "engine",
      "min_years",
      "skill",
    ]);
  });
});

describe("evaluateMatch — v1.8 soft affinity (BR-5.6)", () => {
  const hardOnly = madRequirement({ qualifications: [required(QT.B11)] });
  it("«Inglés técnico» is B2 or above", () => {
    for (const [level, met] of [
      ["B1", false],
      ["B2", true],
      ["C2", true],
      [null, false],
    ] as const) {
      const result = evaluateMatch(
        hardOnly,
        candidate("en", { declarations: declared({ englishLevel: level }) }),
      );
      expect(result.affinityChecks[0]).toEqual({ rule: "english", level, met });
    }
  });
  it("«Base habitual o movilidad aceptada»: same base (case and spaces ignored) or a mobility other than local", () => {
    const local = (baseLocation: string | null) =>
      candidate("b", { baseLocation, declarations: declared({ mobility: "local" }) });
    const base = (c: ReturnType<typeof candidate>) => evaluateMatch(hardOnly, c).affinityChecks[1];
    expect(base(local("  madrid  (MAD) "))).toEqual({ rule: "base", met: true });
    expect(base(local("Sevilla (SVQ)"))?.met).toBe(false);
    expect(base(local(null))?.met).toBe(false);
    const travels = candidate("t", {
      baseLocation: "Sevilla (SVQ)",
      declarations: declared({ mobility: "international" }),
    });
    expect(base(travels)?.met).toBe(true);
  });
  it("score = soft items met / soft items (qualifications + the two affinity items); 0 when blocked", () => {
    const none = candidate("none", {
      baseLocation: "Sevilla (SVQ)",
      declarations: declared({ englishLevel: "A2", mobility: "local" }),
    });
    expect(evaluateMatch(hardOnly, none).softScore).toBe(0);
    const english = candidate("english", {
      baseLocation: "Sevilla (SVQ)",
      declarations: declared({ englishLevel: "C1", mobility: "local" }),
    });
    expect(evaluateMatch(hardOnly, english).softScore).toBe(50);
    expect(evaluateMatch(hardOnly, { ...english, availability: [] }).softScore).toBe(0);
  });
});
