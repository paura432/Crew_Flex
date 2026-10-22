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
});

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
