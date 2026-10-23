import { assert, assertEquals, assertFalse, assertThrows } from "@std/assert";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/http.ts";
import {
  toMyApplication,
  toOrganizationApplication,
  toOrgApplication,
} from "../_shared/applications.ts";
import type { RequirementRuleColumns } from "../../../src/lib/candidate-pool.ts";
import { toCandidate } from "../_shared/requirements.ts";
import { idempotencyKey, parseValue } from "../_shared/validation.ts";
import { APPLICATION_CONFLICTS } from "../../../src/domain/applications.ts";
import {
  applyInput,
  listApplicationsQuery,
  transitionInput,
} from "../../../src/lib/validation/applications.ts";
import {
  assertListParams,
  handler,
  toCounts,
  toRequirementCounts,
  toTransitionResponse,
  transitionArgs,
} from "./index.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

const ID = "00000000-0000-4000-8000-0000000000aa";

for (const method of ["GET", "POST", "PATCH"] as const) {
  Deno.test(
    `applications ${method} rejects unauthenticated requests before any database access`,
    async () => {
      const restore = silence();
      const res = await handler(
        new Request(`http://fn/applications?requirementId=${ID}`, {
          method,
          headers: { "Idempotency-Key": crypto.randomUUID() },
          body: method === "GET" ? undefined : JSON.stringify({ requirementId: ID, userId: ID }),
        }),
      );
      restore();
      assertEquals([res.status, (await res.json()).error.code], [401, "UNAUTHORIZED"]);
    },
  );
}

Deno.test("applications has no PUT/DELETE; CORS preflight lists GET, POST, PATCH", async () => {
  const restore = silence();
  for (const method of ["PUT", "DELETE"]) {
    const res = await handler(new Request("http://fn/applications", { method }));
    assertEquals(res.status, 405);
  }
  const previous = Deno.env.get("ALLOWED_ORIGINS");
  Deno.env.set("ALLOWED_ORIGINS", "http://localhost:3000");
  const res = await handler(
    new Request("http://fn/applications", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000" },
    }),
  );
  if (previous === undefined) Deno.env.delete("ALLOWED_ORIGINS");
  else Deno.env.set("ALLOWED_ORIGINS", previous);
  restore();
  assertEquals(res.headers.get("Access-Control-Allow-Methods"), "GET, POST, PATCH, OPTIONS");
});

Deno.test(
  "strict inputs: identity, side or role never come from the body; received is not a target",
  () => {
    const at = "2031-01-01T10:00:00.000Z";
    for (const extra of [{ userId: ID }, { technicianProfileId: ID }, { role: "admin" }]) {
      const error = assertThrows(
        () => parseValue({ requirementId: ID, shareConsent: true, ...extra }, applyInput),
        ApiError,
      );
      assertEquals(error.code, "VALIDATION_ERROR");
    }
    for (const body of [
      { applicationId: ID, to: "shortlisted", expectedUpdatedAt: at, actor: "organization" },
      { applicationId: ID, to: "shortlisted", expectedUpdatedAt: at, organizationRole: "admin" },
      { applicationId: ID, to: "received", expectedUpdatedAt: at },
      { applicationId: ID, to: "cancelled", expectedUpdatedAt: at },
      { applicationId: ID, to: "accepted", expectedUpdatedAt: at, proposalId: ID },
    ]) {
      assertThrows(() => parseValue(body, transitionInput), ApiError);
    }
  },
);

Deno.test(
  "writes need an Idempotency-Key (400 with a field issue when missing or malformed)",
  () => {
    for (const headers of [{}, { "Idempotency-Key": "not-a-uuid" }] as Record<string, string>[]) {
      const error = assertThrows(
        () => idempotencyKey(new Request("http://fn", { headers }), { required: true }),
        ApiError,
      );
      assertEquals([error.code, error.issues?.[0]?.path], ["VALIDATION_ERROR", "Idempotency-Key"]);
    }
  },
);

Deno.test("transition arguments carry the request, never an identity or a side", () => {
  const input = parseValue(
    {
      applicationId: ID,
      to: "accepted",
      expectedUpdatedAt: "2031-01-01T10:00:00.123Z",
      proposalId: ID,
      acceptTerms: true,
    },
    transitionInput,
  );
  assertEquals(transitionArgs(input, "k1", "r1"), {
    p_application_id: ID,
    p_to: "accepted",
    p_expected_updated_at: "2031-01-01T10:00:00.123Z",
    p_idempotency_key: "k1",
    p_reason: null,
    p_proposal_id: ID,
    p_request_id: "r1",
  });
});

Deno.test(
  "CFA01…CFA15 are 409 with the stable reason, in APPLICATION_CONFLICTS order, without the DB message",
  () => {
    APPLICATION_CONFLICTS.forEach((reason, i) => {
      const code = `CFA${String(i + 1).padStart(2, "0")}`;
      const error = fromDatabaseError({
        code,
        message: "internal detail: every seat is confirmed",
      });
      assertEquals([error.status, error.code, error.reason], [409, "CONFLICT", reason]);
      assertFalse(error.message.includes("internal detail"));
    });
    assertEquals(fromDatabaseError({ code: "CFA13" }).reason, "OWN_ORGANIZATION"); // v2-27, T-90
    // Recruiter (20261024500100, BR-27): an action for a client whose representation is not active.
    assertEquals(fromDatabaseError({ code: "CFR01" }).reason, "CLIENT_REQUIRED");
    assertEquals(fromDatabaseError({ code: "CFR02" }).reason, "CLIENT_NOT_ACTIVE");
    assertEquals(fromDatabaseError({ code: "CFR02" }).status, 409);
    assertEquals(fromDatabaseError({ code: "CFR99" }).reason, undefined);
    assertEquals(fromDatabaseError({ code: "CFA14" }).reason, "PROFILE_REQUIREMENTS_UNMET"); // matching-v18
    assertEquals(fromDatabaseError({ code: "CFA15" }).reason, "RESTRICTIONS_DECLARED"); // T-87
    const unknown = `CFA${String(APPLICATION_CONFLICTS.length + 1).padStart(2, "0")}`;
    assertEquals(fromDatabaseError({ code: unknown }).code, "INTERNAL_ERROR");
    assertEquals(fromDatabaseError({ code: "CF412" }).reason, undefined);
  },
);

Deno.test("the error envelope carries `reason` and nothing from the database", async () => {
  const restore = silence();
  const fn = createHandler("test", {
    PATCH: () => {
      throw fromDatabaseError({ code: "CFA06", message: "every seat is confirmed (row 42)" });
    },
  });
  const res = await fn(new Request("http://fn/test", { method: "PATCH" }));
  restore();
  const text = await res.text();
  assertEquals(res.status, 409);
  assertFalse(text.includes("row 42"));
  assertEquals(JSON.parse(text).error, {
    code: "CONFLICT",
    message: "This action is not possible in the current state.",
    reason: "HEADCOUNT_REACHED",
  });
});

Deno.test("transition and count rows map to the contract", () => {
  assertEquals(
    toTransitionResponse([
      {
        application_id: "a1",
        status: "proposed",
        event_id: "e1",
        proposal_id: "p2",
        updated_at: "2031-01-01T10:00:00.123456+00:00",
        replayed: true,
      },
    ]),
    {
      transition: {
        applicationId: "a1",
        status: "proposed",
        updatedAt: "2031-01-01T10:00:00.123Z",
        proposalId: "p2",
      },
      replayed: true,
    },
  );
  assertEquals(
    toCounts([
      { status: "received", total: 3 },
      { status: "accepted", total: 1 },
    ]),
    { counts: { received: 3, accepted: 1 } },
  );
});

const card = {
  id: "r1",
  organizationName: "Demo MRO Madrid",
  title: "B1.1 · A320 line support",
  location: "Madrid (MAD)",
  startsAt: "2031-01-10T06:00:00.000Z",
  endsAt: "2031-01-12T18:00:00.000Z",
  shift: "day",
  headcount: 1,
  urgency: "planned",
  createdAt: "2030-12-01T10:00:00.000Z",
  status: "paused",
  qualifications: [
    { qualificationTypeId: "q-sms", code: "SMS", name: "SMS", level: "soft" },
    { qualificationTypeId: "q-b11", code: "B1.1", name: "Part-66 B1.1", level: "hard" },
  ],
};
const { id: _id, createdAt: _createdAt, status: _status, ...terms } = card;
const applicationRow = {
  application_id: "a1",
  status: "proposed",
  created_at: "2030-12-02T09:00:00+00:00",
  updated_at: "2030-12-02T10:00:00.123456+00:00",
  reason: null,
  current_proposal: { id: "p1", version: 1, createdAt: "2030-12-02T10:00:00.123Z", terms },
  accepted_proposal_id: null,
  history: [
    {
      from: null,
      to: "received",
      actor: "technician",
      at: "2030-12-02T09:00:00.000Z",
      proposalVersion: null,
    },
    {
      from: "shortlisted",
      to: "proposed",
      actor: "organization",
      at: "2030-12-02T10:00:00.123Z",
      proposalVersion: 1,
    },
  ],
};
const candidateColumns = (verificationStatus: string) => ({
  candidate_ref: "CF-0A1B2C3D4E",
  candidate_pool: "external",
  candidate_display_name: null,
  candidate_base_location: "Madrid (MAD)",
  candidate_years_experience: 5,
  candidate_qualifications: [
    {
      qualificationTypeId: "q-b11",
      code: "B1.1",
      status: "active",
      verificationStatus,
      expiresAt: "2032-06-30",
    },
  ],
  candidate_availability: [
    {
      startsAt: "2031-01-01T00:00:00+00:00",
      endsAt: "2031-02-01T00:00:00+00:00",
      status: "available",
    },
  ],
  candidate_declarations: {
    primaryCategory: "B1.1",
    categories: ["B1.1"],
    aircraft: ["A320 Family"],
    engines: [],
    skills: [],
    englishLevel: "B2",
    mobility: "national",
    workPermits: ["ES"],
    typeRatings: [],
    hasRestrictions: true,
  },
});

/** Requirement r1 states no v1.8 profile rule (get_requirement_profile_rules row). */
const NO_RULES: RequirementRuleColumns = {
  category: null,
  aircraft: [],
  requiresTypeRating: false,
  engines: [],
  minYears: null,
  requiredSkills: [],
};
const RULES = new Map([["r1", NO_RULES]]);
/** The same rules as the columns of a get_organization_applications() row. */
const RULE_COLUMNS = {
  category: null,
  aircraft: [],
  requires_type_rating: false,
  engines: [],
  min_years: null,
  required_skills: [],
};

Deno.test(
  "my application: the card (any status), proposal vN, timeline and my own eligibility",
  () => {
    const own = toCandidate({ ...candidateColumns("verified"), candidate_ref: "me" });
    const mine = toMyApplication(
      { ...applicationRow, requirement_id: "r1", requirement: card },
      own,
      RULES,
    );
    assertEquals(mine.updatedAt, "2030-12-02T10:00:00.123Z"); // the version sent back, ms
    assertEquals(mine.requirement.status, "paused");
    assertEquals(
      mine.requirement.qualifications.map((q) => q.code),
      ["B1.1", "SMS"],
    );
    assertEquals(mine.currentProposal?.version, 1);
    assertEquals(mine.currentProposal?.terms.organizationName, "Demo MRO Madrid");
    assertEquals(
      mine.history.map((h) => h.to),
      ["received", "proposed"],
    );
    assert(mine.match.eligible);
  },
);

Deno.test(
  "organization view: the pool's pseudonym, no person id, the engine explains a blocker",
  () => {
    const row = { ...applicationRow, ...candidateColumns("pending") };
    const requirement = {
      id: "r1",
      startsAt: card.startsAt,
      endsAt: card.endsAt,
      urgency: "planned" as const,
      qualifications: [
        {
          qualificationTypeId: "q-b11",
          code: "B1.1",
          name: "Part-66 B1.1",
          level: "hard" as const,
        },
      ],
    };
    const theirs = toOrgApplication(row, requirement);
    assertEquals(theirs.candidate, {
      id: "CF-0A1B2C3D4E",
      pool: "external",
      displayName: null,
      baseLocation: "Madrid (MAD)",
      yearsExperience: 5,
      // The pool card's v1.8 declarations (HIRE-01 #7): «restrictions declared», never their text.
      passport: {
        primaryCategory: "B1.1",
        categories: ["B1.1"],
        aircraft: ["A320 Family"],
        englishLevel: "B2",
        workPermits: ["ES"],
        hasRestrictions: true,
      },
    });
    assertEquals(theirs.requirementId, "r1");
    assertFalse(theirs.match.eligible);
    assertEquals(theirs.match.blockers[0]?.code, "HARD_QUALIFICATION_NOT_VERIFIED");
    // The requirement's profile rules are part of the verdict (matching-v18).
    const withRules = toOrgApplication(
      { ...applicationRow, ...candidateColumns("verified") },
      { ...requirement, country: "FR", minYears: 8 },
    );
    assertEquals(
      withRules.match.blockers.map((b) => b.code),
      ["MISSING_WORK_PERMIT", "INSUFFICIENT_EXPERIENCE"],
    );
  },
);

Deno.test(
  "my application is judged with its requirement's profile rules; missing rules fail loudly",
  () => {
    const own = toCandidate({ ...candidateColumns("verified"), candidate_ref: "me" });
    const row = { ...applicationRow, requirement_id: "r1", requirement: card };
    const strict = toMyApplication(row, own, new Map([["r1", { ...NO_RULES, minYears: 10 }]]));
    assertFalse(strict.match.eligible);
    assertEquals(strict.match.blockers, [
      { code: "INSUFFICIENT_EXPERIENCE", minYears: 10, years: 5 },
    ]);
    assertEquals(strict.requirement.minYears, 10);
    const error = assertThrows(() => toMyApplication(row, own, new Map()));
    assert(error instanceof ApiError);
    assertEquals(error.code, "INTERNAL_ERROR");
  },
);

Deno.test(
  "proposal terms freeze the builder terms (T-11 widened); versions written before them read as not stated",
  () => {
    const own = toCandidate({ ...candidateColumns("verified"), candidate_ref: "me" });
    const builder = {
      country: "ES",
      timeZone: "Europe/Madrid",
      description: "Line support",
      shifts: [
        {
          startsAt: "2031-01-10T06:00:00.000Z",
          endsAt: "2031-01-10T14:00:00.000Z",
          baseHours: 8,
        },
        {
          startsAt: "2031-01-12T10:00:00.000Z",
          endsAt: "2031-01-12T18:00:00.000Z",
          baseHours: 8,
        },
      ],
      conditions: {
        hourlyRate: 50,
        perDiem: 30,
        contractType: "contractor" as const,
        flights: true,
      },
    };
    const mine = toMyApplication(
      {
        ...applicationRow,
        current_proposal: { ...applicationRow.current_proposal, terms: { ...terms, ...builder } },
        requirement_id: "r1",
        requirement: { ...card, ...builder },
      },
      own,
      RULES,
    );
    assertEquals(mine.currentProposal?.terms.conditions, builder.conditions);
    assertEquals(mine.currentProposal?.terms.shifts?.length, 2);
    assertEquals(mine.requirement.timeZone, "Europe/Madrid");
    const older = toMyApplication(
      { ...applicationRow, requirement_id: "r1", requirement: card },
      own,
      RULES,
    );
    assertEquals(
      [older.currentProposal?.terms.conditions, older.currentProposal?.terms.shifts],
      [null, null],
    );
    // A term the database never writes (a commission) fails loudly instead of reaching the UI.
    assertThrows(() =>
      toMyApplication(
        {
          ...applicationRow,
          current_proposal: {
            ...applicationRow.current_proposal,
            terms: { ...terms, conditions: { commissionRate: 0.1 } },
          },
          requirement_id: "r1",
          requirement: card,
        },
        own,
        RULES,
      ),
    );
  },
);

Deno.test(
  "v2-05: an organization-wide row = the per-requirement row + its card, evaluated against that card",
  () => {
    const { application, total } = toOrganizationApplication({
      ...applicationRow,
      ...candidateColumns("verified"),
      ...RULE_COLUMNS,
      requirement_id: "r1",
      requirement: card,
      total: 7,
    });
    assertEquals(total, 7);
    assertEquals(application.requirementId, "r1");
    assertEquals(application.requirement.status, "paused");
    assertEquals(application.requirement.title, "B1.1 · A320 line support");
    assertEquals(
      application.requirement.qualifications.map((q) => q.code),
      ["B1.1", "SMS"],
    );
    assertEquals(application.candidate?.id, "CF-0A1B2C3D4E");
    assert(application.match?.eligible); // B1.1 verified, available over the whole period
    assertFalse(JSON.stringify(application).includes("organization_id"));
    // A closed account (20261023400100): no applicant columns → listed without candidate or match.
    const closed = toOrganizationApplication({
      ...applicationRow,
      status: "finished",
      candidate_ref: null,
      candidate_pool: null,
      candidate_display_name: null,
      candidate_base_location: null,
      candidate_years_experience: null,
      candidate_qualifications: null,
      candidate_availability: null,
      candidate_declarations: null,
      ...RULE_COLUMNS,
      requirement_id: "r1",
      requirement: card,
      total: 1,
    }).application;
    assertEquals([closed.candidate, closed.match, closed.status], [null, null, "finished"]);
    assertEquals(closed.history.length, 2);
    // matching-v18 (20261024100900): the requirement's profile rules come with the row and decide.
    const strict = toOrganizationApplication({
      ...applicationRow,
      ...candidateColumns("verified"),
      ...RULE_COLUMNS,
      min_years: 10,
      requirement_id: "r1",
      requirement: card,
      total: 1,
    }).application;
    assertEquals(strict.requirement.minYears, 10);
    assertEquals(
      strict.match?.blockers.map((b) => b.code),
      ["INSUFFICIENT_EXPERIENCE"],
    );
    assertEquals(strict.candidate?.passport?.hasRestrictions, true);
    assertThrows(() =>
      toOrganizationApplication({
        ...applicationRow,
        ...candidateColumns("verified"),
        requirement_id: "r1",
        requirement: card,
        total: 1,
      }),
    ); // without the rule columns: fails loudly, never «no rule»
  },
);

Deno.test("v2-05/v2-08: per-requirement counts map to the contract", () => {
  assertEquals(
    toRequirementCounts([
      {
        requirement_id: "r1",
        headcount: 2,
        starts_at: "2031-01-10T06:00:00+00:00",
        ends_at: "2031-01-12T18:00:00+00:00",
        shift_count: 2,
        counts: { confirmed: 1, received: 2 },
      },
    ]),
    {
      requirements: [
        {
          requirementId: "r1",
          headcount: 2,
          startsAt: "2031-01-10T06:00:00.000Z",
          endsAt: "2031-01-12T18:00:00.000Z",
          shiftCount: 2,
          counts: { confirmed: 1, received: 2 },
        },
      ],
    },
  );
  assertThrows(() =>
    toRequirementCounts([
      {
        requirement_id: "r1",
        headcount: 1,
        starts_at: "x",
        ends_at: "y",
        shift_count: null,
        counts: { bogus: 1 },
      },
    ]),
  );
});

Deno.test("list query: strict views and status, bounded pages", () => {
  const ORG = "00000000-0000-4000-8000-0000000000bb";
  assertEquals(
    parseValue({ organizationId: ORG, view: "list", status: "accepted" }, listApplicationsQuery),
    { organizationId: ORG, view: "list", status: "accepted", offset: 0, limit: 20 },
  );
  for (const bad of [
    { organizationId: ORG, view: "everything" },
    { organizationId: ORG, view: "list", status: "hired" },
    { organizationId: ORG, view: "list", limit: "51" },
    { organizationId: ORG, view: "list", offset: "-1" },
    { organizationId: ORG, view: "list", role: "admin" },
  ]) {
    assertThrows(() => parseValue(bad, listApplicationsQuery), ApiError);
  }
});

Deno.test("the organization-wide views also need a valid token before anything else", async () => {
  const restore = silence();
  for (const view of ["list", "byRequirement"]) {
    const res = await handler(
      new Request(`http://fn/applications?organizationId=${ID}&view=${view}`),
    );
    assertEquals(res.status, 401);
  }
  restore();
});

Deno.test(
  "view rules: `status` only with view=list; list and byRequirement need the organization",
  () => {
    const ORG = "00000000-0000-4000-8000-0000000000bb";
    const ok = (raw: Record<string, string | undefined>) =>
      assertListParams(parseValue(raw, listApplicationsQuery));
    ok({ organizationId: ORG, view: "list", status: "received" });
    ok({ organizationId: ORG, view: "list", requirementId: ID });
    ok({ organizationId: ORG, view: "byRequirement" });
    for (const bad of [
      { requirementId: ID, status: "received" },
      { organizationId: ORG, view: "counts", status: "received" },
      { status: "received" },
      { view: "list" },
      { view: "byRequirement" },
      { organizationId: ORG, view: "byRequirement", requirementId: ID },
    ]) {
      const error = assertThrows(() => ok(bad), ApiError);
      assertEquals(error.code, "VALIDATION_ERROR");
    }
  },
);
