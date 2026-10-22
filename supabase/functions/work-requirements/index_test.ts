import { assertEquals } from "@std/assert";
import { parseValue } from "../_shared/validation.ts";
import {
  createWorkRequirementInput,
  updateWorkRequirementInput,
} from "../../../src/lib/validation/work-requirement.ts";
import { createArgs, handler, updateArgs } from "./index.ts";

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
