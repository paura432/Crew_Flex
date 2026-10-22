import { assertEquals } from "@std/assert";
import { parseValue } from "../_shared/validation.ts";
import { updateWorkRequirementInput } from "../../../src/lib/validation/work-requirement.ts";
import { handler, updateArgs } from "./index.ts";

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
  });
});
