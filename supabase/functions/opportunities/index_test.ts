import { assert, assertEquals } from "@std/assert";
import { periodOf, toOpportunity, toOpportunityRequirement } from "../_shared/applications.ts";
import { toCandidate } from "../_shared/requirements.ts";
import { handler, OPPORTUNITY_CAP } from "./index.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

Deno.test(
  "opportunities GET rejects unauthenticated requests before any database access",
  async () => {
    const restore = silence();
    const res = await handler(new Request("http://fn/opportunities?eligible=1"));
    restore();
    assertEquals([res.status, (await res.json()).error.code], [401, "UNAUTHORIZED"]);
  },
);

Deno.test("opportunities is read-only (405 for every write method)", async () => {
  const restore = silence();
  for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
    const res = await handler(new Request("http://fn/opportunities", { method }));
    assertEquals(res.status, 405);
  }
  restore();
});

Deno.test("the cap is the SQL cap of list_opportunities", () => {
  assertEquals(OPPORTUNITY_CAP, 200);
});

const row = {
  id: "r1",
  organization_name: "Demo Airline Ops Barcelona",
  title: "B1.1 · B737 AOG recovery",
  location: "Barcelona (BCN)",
  starts_at: "2031-01-10T06:00:00+00:00",
  ends_at: "2031-01-11T18:00:00+00:00",
  shift: "flexible",
  headcount: 1,
  urgency: "aog",
  created_at: "2030-12-01T10:00:00+00:00",
  qualifications: [
    { qualificationTypeId: "q-hf", code: "HF", name: "Human factors", level: "soft" },
    { qualificationTypeId: "q-b11", code: "B1.1", name: "Part-66 B1.1", level: "hard" },
  ],
  total: 1,
};

const me = (
  verificationStatus: string,
  windows: { status: string }[] = [{ status: "available" }],
) =>
  toCandidate({
    candidate_ref: "me",
    candidate_pool: "internal",
    candidate_display_name: "Technician Delta",
    candidate_base_location: "Barcelona (BCN)",
    candidate_years_experience: 12,
    candidate_qualifications: [
      {
        qualificationTypeId: "q-b11",
        code: "B1.1",
        status: "active",
        verificationStatus,
        expiresAt: null,
      },
    ],
    candidate_availability: windows.map((w) => ({
      startsAt: "2031-01-01T00:00:00+00:00",
      endsAt: "2031-02-01T00:00:00+00:00",
      status: w.status,
    })),
  });

Deno.test("rows map to the fixed projection: organization name only, ISO UTC, hard first", () => {
  const requirement = toOpportunityRequirement(row);
  assertEquals(Object.keys(requirement).sort(), [
    "createdAt",
    "endsAt",
    "headcount",
    "id",
    "location",
    "organizationName",
    "qualifications",
    "shift",
    "startsAt",
    "title",
    "urgency",
  ]);
  assertEquals(requirement.startsAt, "2031-01-10T06:00:00.000Z");
  assertEquals(
    requirement.qualifications.map((q) => q.code),
    ["B1.1", "HF"],
  );
});

Deno.test("own eligibility and apply blocker: eligible → none; failed rules are explained", () => {
  const requirement = toOpportunityRequirement(row);
  const now = Date.parse("2031-01-01T00:00:00Z");
  const ok = toOpportunity(requirement, me("verified"), [], now);
  assert(ok.match.eligible);
  assertEquals([ok.myApplication, ok.applyBlocker], [null, null]);
  const pending = toOpportunity(requirement, me("pending"), [], now);
  assertEquals(pending.applyBlocker, "NOT_ELIGIBLE");
  assertEquals(pending.match.blockers[0]?.code, "HARD_QUALIFICATION_NOT_VERIFIED");
  // BR-4.8: an «AOG only» window counts for this AOG need.
  assert(
    toOpportunity(requirement, me("verified", [{ status: "aog_only" }]), [], now).match.eligible,
  );
  const started = toOpportunity(requirement, me("verified"), [], Date.parse(row.starts_at));
  assertEquals(started.applyBlocker, "REQUIREMENT_STARTED");
});

Deno.test(
  "my latest application decides the blocker (Q5, T-09): withdrawn reopens, rejected closes",
  () => {
    const requirement = toOpportunityRequirement(row);
    const now = Date.parse("2031-01-01T00:00:00Z");
    const app = (id: string, status: "withdrawn" | "rejected" | "received", createdAt: string) => ({
      id,
      requirementId: "r1",
      status,
      createdAt,
    });
    const reopened = toOpportunity(
      requirement,
      me("verified"),
      [app("a1", "withdrawn", "2030-12-01T00:00:00.000Z")],
      now,
    );
    assertEquals([reopened.myApplication?.status, reopened.applyBlocker], ["withdrawn", null]);
    const active = toOpportunity(
      requirement,
      me("verified"),
      [
        app("a1", "withdrawn", "2030-12-01T00:00:00.000Z"),
        app("a2", "received", "2030-12-02T00:00:00.000Z"),
      ],
      now,
    );
    assertEquals([active.myApplication?.id, active.applyBlocker], ["a2", "ALREADY_APPLIED"]);
    const closed = toOpportunity(
      requirement,
      me("verified"),
      [app("a3", "rejected", "2030-12-03T00:00:00.000Z")],
      now,
    );
    assertEquals(closed.applyBlocker, "REAPPLY_NOT_ALLOWED");
    const other = toOpportunity(
      requirement,
      me("verified"),
      [{ ...app("a4", "received", "2030-12-04T00:00:00.000Z"), requirementId: "r2" }],
      now,
    );
    assertEquals([other.myApplication, other.applyBlocker], [null, null]); // another requirement's
  },
);

Deno.test("own windows are read once for the period covering every requirement", () => {
  assertEquals(periodOf([]), null);
  assertEquals(
    periodOf([
      { startsAt: "2031-01-10T00:00:00.000Z", endsAt: "2031-01-12T00:00:00.000Z" },
      { startsAt: "2031-01-05T00:00:00.000Z", endsAt: "2031-01-06T00:00:00.000Z" },
    ]),
    { from: "2031-01-05T00:00:00.000Z", to: "2031-01-12T00:00:00.000Z" },
  );
});
