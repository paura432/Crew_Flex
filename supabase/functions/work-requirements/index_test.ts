import { assertEquals } from "@std/assert";
import { MAX_BODY_BYTES, MAX_REQUIREMENT_BODY_BYTES, parseValue } from "../_shared/validation.ts";
import {
  createWorkRequirementInput,
  updateWorkRequirementInput,
} from "../../../src/lib/validation/work-requirement.ts";
import { createArgs, handler, requirementWriteError, updateArgs } from "./index.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

Deno.test("work-requirements PUT (M05 edit) rejects unauthenticated requests", async () => {
  const restore = silence();
  const res = await handler(
    new Request("http://fn/work-requirements", { method: "PUT", body: JSON.stringify({}) }),
  );
  restore();
  assertEquals([res.status, (await res.json()).error.code], [401, "UNAUTHORIZED"]);
});

Deno.test("work-requirements exposes PUT in the CORS preflight", async () => {
  const restore = silence();
  const previous = Deno.env.get("ALLOWED_ORIGINS");
  Deno.env.set("ALLOWED_ORIGINS", "http://localhost:3000");
  const res = await handler(
    new Request("http://fn/work-requirements", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000" },
    }),
  );
  if (previous === undefined) Deno.env.delete("ALLOWED_ORIGINS");
  else Deno.env.set("ALLOWED_ORIGINS", previous);
  restore();
  assertEquals(res.headers.get("Access-Control-Allow-Methods"), "GET, POST, PATCH, PUT, OPTIONS");
});

Deno.test("the edit sends the whole requirement and the version; never the organization", () => {
  const input = parseValue(
    {
      id: "33333333-3333-4333-8333-000000000001",
      expectedUpdatedAt: "2031-01-01T10:00:00.123Z",
      title: "  Night support  ",
      location: "Madrid (MAD)",
      startsAt: "2031-02-01T20:00:00Z",
      endsAt: "2031-02-03T06:00:00Z",
      shift: "night",
      headcount: 2,
      urgency: "urgent",
      qualifications: [
        { qualificationTypeId: "11111111-1111-4111-8111-000000000001", level: "hard" },
      ],
    },
    updateWorkRequirementInput,
  );
  assertEquals(updateArgs(input), {
    p_id: "33333333-3333-4333-8333-000000000001",
    p_expected_updated_at: "2031-01-01T10:00:00.123Z",
    p_title: "Night support",
    p_location: "Madrid (MAD)",
    p_starts_at: "2031-02-01T20:00:00Z",
    p_ends_at: "2031-02-03T06:00:00Z",
    p_shift: "night",
    p_headcount: 2,
    p_urgency: "urgent",
    p_qualifications: [
      { qualification_type_id: "11111111-1111-4111-8111-000000000001", requirement_level: "hard" },
    ],
    // Requirement builder (20261023600100): full replacement, so terms not sent are cleared; the status
    // is kept unless the edit saves (`draft`) or publishes (`open`) a draft.
    p_country: null,
    p_time_zone: null,
    p_description: null,
    p_shifts: null,
    p_conditions: null,
    p_status: null,
    // Recruiter (20261024500100): no client sent = no client (full replacement).
    p_on_behalf_of_client_id: null,
    // v1.8 profile rules (P10, 20261027100000): not stated = the column defaults.
    p_category: null,
    p_aircraft: [],
    p_requires_type_rating: false,
    p_engines: [],
    p_min_years: null,
    p_required_skills: [],
  });
});

const nov = [10, 11, 12].map((d) => ({
  startsAt: `2031-11-${d}T08:00:00.000Z`,
  endsAt: `2031-11-${d}T16:00:00.000Z`,
  baseHours: 8,
}));
const builderInput = {
  organizationId: "22222222-2222-4222-8222-000000000001",
  title: "B1.1 · A320 three days",
  location: "Madrid (MAD)",
  startsAt: "2031-11-10T08:00:00.000Z",
  endsAt: "2031-11-12T16:00:00.000Z",
  shift: "day",
  headcount: 1,
  urgency: "planned",
  qualifications: [{ qualificationTypeId: "11111111-1111-4111-8111-000000000001", level: "hard" }],
  country: "ES",
  timeZone: "Europe/Madrid",
  description: "  Line support  ",
  shifts: nov,
  conditions: { hourlyRate: 50, shiftHours: 8, flights: true },
};

Deno.test("the create sends the terms; a draft is created as draft, anything else as open", () => {
  const published = createArgs(parseValue(builderInput, createWorkRequirementInput), "k");
  assertEquals(published.p_status, "open");
  assertEquals(published.p_country, "ES");
  assertEquals(published.p_time_zone, "Europe/Madrid");
  assertEquals(published.p_description, "Line support");
  assertEquals(published.p_shifts, nov);
  assertEquals(published.p_conditions, { hourlyRate: 50, shiftHours: 8, flights: true });
  const draft = createArgs(
    parseValue(
      { ...builderInput, qualifications: [], intent: "draft" },
      createWorkRequirementInput,
    ),
    "k",
  );
  assertEquals([draft.p_status, draft.p_qualifications], ["draft", []]);
});

Deno.test(
  "the create and the edit send the v1.8 profile rules; unstated ones travel as the column defaults (P10)",
  () => {
    const plain = createArgs(parseValue(builderInput, createWorkRequirementInput), "k");
    assertEquals(
      [
        plain.p_category,
        plain.p_aircraft,
        plain.p_requires_type_rating,
        plain.p_engines,
        plain.p_min_years,
        plain.p_required_skills,
      ],
      [null, [], false, [], null, []],
    );
    const { organizationId: _organization, ...editable } = builderInput; // an edit never carries it
    const editInput = {
      id: "33333333-3333-4333-8333-000000000001",
      expectedUpdatedAt: "2031-01-01T10:00:00.123Z",
      ...editable,
    };
    const ruled = updateArgs(
      parseValue(
        {
          ...editInput,
          category: "B1.1",
          aircraft: ["A320 Family"],
          requiresTypeRating: true,
          engines: ["LEAP-1A", "CFM56-5B/7B"],
          minYears: 3,
          requiredSkills: ["line_maintenance"],
        },
        updateWorkRequirementInput,
      ),
    );
    assertEquals(ruled.p_category, "B1.1");
    assertEquals(ruled.p_aircraft, ["A320 Family"]);
    assertEquals(ruled.p_requires_type_rating, true);
    assertEquals(ruled.p_engines, ["LEAP-1A", "CFM56-5B/7B"]);
    assertEquals(ruled.p_min_years, 3);
    assertEquals(ruled.p_required_skills, ["line_maintenance"]);
  },
);

Deno.test("an edit saves a draft as a draft or publishes it, never another status", () => {
  const { organizationId: _org, ...fields } = builderInput;
  const base = {
    id: "33333333-3333-4333-8333-000000000001",
    expectedUpdatedAt: "2031-01-01T10:00:00.123Z",
    ...fields,
  };
  const status = (intent?: string) =>
    updateArgs(parseValue({ ...base, intent }, updateWorkRequirementInput)).p_status;
  assertEquals([status(), status("draft"), status("publish")], [null, "draft", "open"]);
});

Deno.test(
  "the largest valid requirement body fits in its 128 KB limit (366 shifts, 4000 × 3-byte characters)",
  () => {
    const day = (i: number) => new Date(Date.UTC(2031, 0, 1) + i * 86_400_000).toISOString();
    const shifts = Array.from({ length: 366 }, (_, i) => ({
      startsAt: day(i).replace("T00:00:00.000Z", "T08:00:00.000Z"),
      endsAt: day(i).replace("T00:00:00.000Z", "T16:00:00.000Z"),
      baseHours: 7.75,
    }));
    const body = {
      ...builderInput,
      title: "x".repeat(120),
      location: "x".repeat(80),
      startsAt: shifts[0]!.startsAt,
      endsAt: shifts.at(-1)!.endsAt,
      timeZone: "UTC",
      description: "€".repeat(4000),
      shifts,
      qualifications: Array.from({ length: 20 }, (_, i) => ({
        qualificationTypeId: `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
        level: "hard",
      })),
      conditions: {
        hourlyRate: 1999.99,
        overtimeRate: 1999.99,
        perDiem: 1999.99,
        shiftHours: 23.75,
        contractType: "temporary",
        budgetMandatory: true,
        maxMobilizationHours: 168,
        arrival: "€".repeat(160),
        flights: false,
        accommodation: false,
        localTransport: false,
        meals: false,
        ownTools: false,
      },
    };
    parseValue(body, createWorkRequirementInput); // valid (throws otherwise)
    const bytes = new TextEncoder().encode(JSON.stringify({ ...body, intent: "publish" })).length;
    assertEquals(bytes < MAX_REQUIREMENT_BODY_BYTES, true, `${bytes} bytes`);
    assertEquals(bytes > MAX_BODY_BYTES, true); // why the default 32 KB is not enough
  },
);

Deno.test("work-requirements PATCH (archive) rejects unauthenticated requests", async () => {
  const restore = silence();
  const res = await handler(
    new Request("http://fn/work-requirements", {
      method: "PATCH",
      body: JSON.stringify({ id: "33333333-3333-4333-8333-000000000001", archive: true }),
    }),
  );
  restore();
  assertEquals([res.status, (await res.json()).error.code], [401, "UNAUTHORIZED"]);
});

Deno.test(
  "recruiter: the client goes to the create and the edit; the organization never comes from it",
  () => {
    const client = "44444444-4444-4444-8444-000000000001";
    const created = createArgs(
      parseValue({ ...builderInput, onBehalfOfClientId: client }, createWorkRequirementInput),
      "k",
    );
    assertEquals(
      [created.p_organization_id, created.p_on_behalf_of_client_id],
      [builderInput.organizationId, client],
    );
    const { organizationId: _org, ...fields } = builderInput;
    const edited = updateArgs(
      parseValue(
        {
          id: "33333333-3333-4333-8333-000000000001",
          expectedUpdatedAt: "2031-01-01T10:00:00.123Z",
          ...fields,
          onBehalfOfClientId: client,
        },
        updateWorkRequirementInput,
      ),
    );
    assertEquals(edited.p_on_behalf_of_client_id, client);
    assertEquals("p_organization_id" in edited, false);
    assertEquals(
      createWorkRequirementInput.safeParse({ ...builderInput, onBehalfOfClientId: "nope" }).success,
      false,
    );
  },
);

Deno.test(
  "recruiter: CFR01/CFR02 on a create or edit are errors of the client field, without the DB message",
  () => {
    const required = requirementWriteError({ code: "CFR01", message: "internal detail" });
    assertEquals(
      [required.status, required.code, required.issues],
      [
        400,
        "VALIDATION_ERROR",
        [{ path: "onBehalfOfClientId", message: "v.requirement.client.required" }],
      ],
    );
    const inactive = requirementWriteError({ code: "CFR02", message: "internal detail" });
    assertEquals(inactive.issues, [
      { path: "onBehalfOfClientId", message: "v.requirement.client.inactive" },
    ]);
    assertEquals(JSON.stringify(inactive).includes("internal detail"), false);
    // Anything else maps as before.
    assertEquals(requirementWriteError({ code: "CFA12" }).reason, "HAS_APPLICATIONS");
    assertEquals(requirementWriteError({ code: "22023" }).issues, undefined);
  },
);
