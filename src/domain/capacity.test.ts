import { describe, expect, it } from "vitest";
import { candidate, madRequirement } from "../../fixtures/domain";
import {
  assertEvaluableRequirement,
  evaluateCapacity,
  InvalidRequirementError,
} from "./capacity.ts";
import { evaluateMatch } from "./matching.ts";

const eligible = (id: string) => candidate(id, { pool: "internal" });
const ineligible = (id: string) => candidate(id, { pool: "internal", qualifications: [] });

describe("evaluateCapacity", () => {
  it("8. required 3, eligible 2 → gap 1", () => {
    const result = evaluateCapacity(madRequirement({ headcount: 3 }), [
      eligible("a"),
      eligible("b"),
      ineligible("c"),
    ]);
    expect(result).toMatchObject({
      required: 3,
      internallyEligible: 2,
      gap: 1,
      coveragePercent: 66.67,
    });
    expect(result.internalMatches).toHaveLength(3);
  });

  it("9. required 2, eligible 3 → gap 0 (surplus is not a negative gap)", () => {
    const result = evaluateCapacity(madRequirement({ headcount: 2 }), [
      eligible("a"),
      eligible("b"),
      eligible("c"),
    ]);
    expect(result).toMatchObject({
      required: 2,
      internallyEligible: 3,
      gap: 0,
      coveragePercent: 100,
    });
  });

  it("10. required 0 → invalid requirement", () => {
    expect(() => evaluateCapacity(madRequirement({ headcount: 0 }), [eligible("a")])).toThrow(
      InvalidRequirementError,
    );
    expect(() => evaluateCapacity(madRequirement({ headcount: 1.5 }), [])).toThrow(
      InvalidRequirementError,
    );
  });

  it("E-3: a requirement without hard qualifications is not evaluable (nobody becomes eligible by default)", () => {
    const softOnly = madRequirement({
      qualifications: madRequirement().qualifications.map((q) => ({
        ...q,
        level: "soft" as const,
      })),
    });
    expect(() => evaluateCapacity(softOnly, [eligible("a")])).toThrow(InvalidRequirementError);
    expect(() => assertEvaluableRequirement(madRequirement({ qualifications: [] }))).toThrow(
      InvalidRequirementError,
    );
    expect(() => assertEvaluableRequirement(madRequirement())).not.toThrow();
  });

  it("no internal workforce → full gap, 0 % coverage", () => {
    expect(evaluateCapacity(madRequirement({ headcount: 2 }), [])).toMatchObject({
      internallyEligible: 0,
      gap: 2,
      coveragePercent: 0,
    });
  });

  it("product example: 2 required, 1 eligible → gap 1, 50 %", () => {
    const result = evaluateCapacity(madRequirement(), [eligible("alpha"), ineligible("bravo")]);
    expect(result).toMatchObject({
      required: 2,
      internallyEligible: 1,
      gap: 1,
      coveragePercent: 50,
    });
  });

  it("capacity and external matching use the same evaluator (one algorithm)", () => {
    const requirement = madRequirement({ headcount: 2 });
    const people = [
      eligible("a"),
      ineligible("b"),
      candidate("c", { pool: "internal", availability: [] }),
    ];
    const capacity = evaluateCapacity(requirement, people);
    expect(capacity.internalMatches).toEqual(people.map((p) => evaluateMatch(requirement, p)));
    expect(capacity.internallyEligible).toBe(
      people.filter((p) => evaluateMatch(requirement, p).eligible).length,
    );
  });
});
