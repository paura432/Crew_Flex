import { assertEquals, assertThrows } from "@std/assert";
import { evaluateCapacity } from "../../../src/domain/capacity.ts";
import { evaluateMatch } from "../../../src/domain/matching.ts";
import { ApiError } from "./errors.ts";
import { assertEvaluableStatus, toCandidate, toWorkRequirement } from "./requirements.ts";

const requirementRow = {
  id: "r1",
  organization_id: "o1",
  title: "B1.1 · A320 line maintenance reinforcement",
  location: "Madrid (MAD)",
  starts_at: "2026-10-18T20:00:00+00:00",
  ends_at: "2026-10-22T06:00:00+00:00",
  shift: "night",
  headcount: 2,
  urgency: "urgent",
  status: "open",
  created_at: "2026-10-09T10:00:00+00:00",
  updated_at: "2026-10-09T10:30:00.123456+00:00",
  // v1.8 profile rules (matching-v18, 20261023900000): none stated.
  category: null,
  aircraft: [],
  requires_type_rating: false,
  engines: [],
  min_years: null,
  required_skills: [],
  work_requirement_qualifications: [
    { requirement_level: "soft", qualification_types: { id: "q-sms", code: "SMS", name: "SMS" } },
    { requirement_level: "hard", qualification_types: { id: "q-b11", code: "B1.1", name: "B1.1" } },
  ],
};

const poolRow = (ref: string, pool: string, verificationStatus: string) => ({
  candidate_ref: ref,
  candidate_pool: pool,
  candidate_display_name: null,
  candidate_base_location: "Madrid (MAD)",
  candidate_years_experience: 5,
  candidate_qualifications: [
    {
      qualificationTypeId: "q-b11",
      code: "B1.1",
      status: "active",
      verificationStatus,
      expiresAt: "2029-06-30",
    },
  ],
  candidate_availability: [
    {
      startsAt: "2026-10-01T00:00:00+00:00",
      endsAt: "2026-11-01T00:00:00+00:00",
      status: "available",
    },
  ],
  candidate_declarations: {
    primaryCategory: "B1.1",
    categories: ["B1.1"],
    aircraft: ["A320 Family"],
    engines: [],
    skills: ["line_maintenance"],
    englishLevel: "B2",
    mobility: "local",
    workPermits: ["ES"],
    typeRatings: [
      { aircraft: "A320 Family", category: "B1.1", expiresAt: "2026-10-21", restricted: false },
    ],
    hasRestrictions: false,
  },
});

Deno.test(
  "the requirement's v1.8 profile rules are parsed strictly and applied by the engine",
  () => {
    const requirement = toWorkRequirement({
      ...requirementRow,
      country: "ES",
      category: "B1.1",
      aircraft: ["A320 Family", "B737 NG"],
      requires_type_rating: true,
      min_years: 5,
      required_skills: ["line_maintenance"],
    });
    assertEquals(
      [requirement.country, requirement.category, requirement.aircraft, requirement.minYears],
      ["ES", "B1.1", ["A320 Family", "B737 NG"], 5],
    );
    // The rating expires on the 21st; the period's last UTC day is the 22nd (BR-2, BR-3.10).
    const match = evaluateMatch(requirement, toCandidate(poolRow("a", "external", "verified")));
    assertEquals(match.blockers, [
      {
        code: "TYPE_RATING_NOT_VALID",
        category: "B1.1",
        aircraft: ["A320 Family", "B737 NG"],
        expiresAt: "2026-10-21",
      },
    ]);
    // An unknown required value or a missing rule column fails instead of dropping the rule.
    assertThrows(() => toWorkRequirement({ ...requirementRow, category: "B9" }));
    const { min_years: _dropped, ...withoutYears } = requirementRow;
    assertThrows(() => toWorkRequirement(withoutYears));
  },
);

Deno.test("rows map to domain objects that the shared engine evaluates", () => {
  const requirement = toWorkRequirement(requirementRow);
  assertEquals(
    requirement.qualifications.map((q) => q.code),
    ["B1.1", "SMS"],
  );
  assertEquals(requirement.startsAt, "2026-10-18T20:00:00.000Z");
  assertEquals(requirement.updatedAt, "2026-10-09T10:30:00.123Z"); // the PUT version, ms precision

  const internal = [poolRow("a", "internal", "verified"), poolRow("b", "internal", "pending")].map(
    toCandidate,
  );
  const capacity = evaluateCapacity(requirement, internal);
  assertEquals([capacity.required, capacity.internallyEligible, capacity.gap], [2, 1, 1]);
  assertEquals(
    evaluateMatch(requirement, internal[1]!).blockers[0]?.code,
    "HARD_QUALIFICATION_NOT_VERIFIED",
  );
});

Deno.test(
  "drafts, paused and closed requirements are not evaluated (409), the others are (M05, v2-14)",
  () => {
    for (const status of ["draft", "paused", "closed"] as const) {
      const error = assertThrows(() => assertEvaluableStatus({ status }), ApiError);
      assertEquals(error.code, "CONFLICT");
    }
    for (const status of ["open", "covered", "cancelled"] as const) {
      assertEvaluableStatus({ status });
    }
  },
);
