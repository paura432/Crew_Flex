import { describe, expect, it } from "vitest";
import {
  availabilityStatus,
  passportOf,
  toCandidate,
  toProfileRules,
  toProfileRulesById,
} from "./candidate-pool";

interface RawDeclarations {
  primaryCategory: string | null;
  categories: string[];
  aircraft: string[];
  engines: string[];
  skills: string[];
  englishLevel: string | null;
  mobility: string;
  workPermits: string[];
  typeRatings: {
    aircraft: string;
    category: string;
    expiresAt: string | null;
    restricted: boolean;
  }[];
  hasRestrictions: boolean;
}

const declarations: RawDeclarations = {
  primaryCategory: null,
  categories: [],
  aircraft: [],
  engines: [],
  skills: [],
  englishLevel: null,
  mobility: "national",
  workPermits: [],
  typeRatings: [],
  hasRestrictions: false,
};

const row = (status: string, extra: Partial<typeof declarations> = {}) => ({
  candidate_ref: "CF-0000000001",
  candidate_pool: "external",
  candidate_display_name: null,
  candidate_base_location: null,
  candidate_years_experience: null,
  candidate_qualifications: [],
  candidate_availability: [
    { startsAt: "2026-11-01T00:00:00+00:00", endsAt: "2026-11-02T00:00:00+00:00", status },
  ],
  candidate_declarations: { ...declarations, ...extra },
});

describe("pool row availability status (review HIGH-1)", () => {
  it("keeps known statuses", () => {
    for (const s of ["available", "unavailable", "aog_only"] as const) {
      expect(availabilityStatus(s)).toBe(s);
      expect(toCandidate(row(s)).availability[0]!.status).toBe(s);
    }
  });

  it("reads an unknown status as unavailable instead of failing the whole pool", () => {
    expect(toCandidate(row("some_future_value")).availability[0]!.status).toBe("unavailable");
  });
});

describe("pool row declarations (package matching-v18)", () => {
  it("maps the declarations, catalog order kept", () => {
    const candidate = toCandidate(
      row("available", {
        primaryCategory: "B1.1",
        categories: ["B2", "B1.1"],
        aircraft: ["B737 NG", "A320 Family"],
        engines: ["LEAP-1A"],
        skills: ["borescope"],
        englishLevel: "C1",
        mobility: "international",
        workPermits: ["ES", "FR"],
        typeRatings: [
          { aircraft: "A320 Family", category: "B1.1", expiresAt: "2028-12-31", restricted: true },
        ],
        hasRestrictions: true,
      }),
    );
    expect(candidate.declarations).toEqual({
      primaryCategory: "B1.1",
      categories: ["B1.1", "B2"],
      aircraft: ["A320 Family", "B737 NG"],
      engines: ["LEAP-1A"],
      skills: ["borescope"],
      englishLevel: "C1",
      mobility: "international",
      workPermits: ["FR", "ES"],
      typeRatings: [
        { aircraft: "A320 Family", category: "B1.1", expiresAt: "2028-12-31", restricted: true },
      ],
      hasRestrictions: true,
    });
    expect(passportOf(candidate.declarations)).toEqual({
      primaryCategory: "B1.1",
      categories: ["B1.1", "B2"],
      aircraft: ["A320 Family", "B737 NG"],
      englishLevel: "C1",
      workPermits: ["FR", "ES"],
      hasRestrictions: true,
    });
  });

  it("drops values it does not know (they can only stop a match) and reads an unknown mobility as local", () => {
    const candidate = toCandidate(
      row("available", {
        categories: ["B1.1", "B9"],
        workPermits: ["ES", "GB"],
        mobility: "orbital",
        englishLevel: "D1",
        typeRatings: [
          { aircraft: "Concorde", category: "B1.1", expiresAt: null, restricted: false },
          { aircraft: "A320 Family", category: "HELPER", expiresAt: null, restricted: false },
        ],
      }),
    );
    expect(candidate.declarations.categories).toEqual(["B1.1"]);
    expect(candidate.declarations.workPermits).toEqual(["ES"]);
    expect(candidate.declarations.mobility).toBe("local");
    expect(candidate.declarations.englishLevel).toBeNull();
    expect(candidate.declarations.typeRatings).toEqual([]);
  });

  it("a row without the declarations column fails loudly", () => {
    const old: Partial<ReturnType<typeof row>> = row("available");
    delete old.candidate_declarations;
    expect(() => toCandidate(old)).toThrow();
  });
});

describe("requirement profile rules (strict)", () => {
  const rules = {
    category: "B1.1",
    aircraft: ["A320 Family", "B737 NG"],
    requires_type_rating: true,
    engines: [],
    min_years: 5,
    required_skills: ["line_maintenance"],
  };
  it("maps the columns", () => {
    expect(toProfileRulesById([{ requirement_id: "r1", ...rules }]).get("r1")).toEqual({
      category: "B1.1",
      aircraft: ["A320 Family", "B737 NG"],
      requiresTypeRating: true,
      engines: [],
      minYears: 5,
      requiredSkills: ["line_maintenance"],
    });
    expect(
      toProfileRules({
        category: null,
        aircraft: [],
        requires_type_rating: false,
        engines: [],
        min_years: null,
        required_skills: [],
      }).minYears,
    ).toBeNull();
  });
  it("an unknown required value fails instead of silently dropping the rule", () => {
    for (const bad of [
      { category: "B9" },
      { aircraft: ["Concorde"] },
      { required_skills: ["juggling"] },
      { min_years: 2.5 },
    ]) {
      expect(() => toProfileRulesById([{ requirement_id: "r1", ...rules, ...bad }])).toThrow();
    }
  });
});
