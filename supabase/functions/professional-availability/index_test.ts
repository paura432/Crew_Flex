import { assertEquals } from "@std/assert";
import { fromDatabaseError } from "../_shared/errors.ts";
import { handler, replaceDaysArgs, toRotation, toWindow, windowWriteError } from "./index.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

for (const method of ["GET", "POST", "PATCH", "PUT", "DELETE"] as const) {
  Deno.test(`professional-availability ${method} rejects unauthenticated requests`, async () => {
    const restore = silence();
    const res = await handler(
      new Request("http://fn/professional-availability?id=22222222-2222-4222-8222-000000000001", {
        method,
        body: method === "GET" ? undefined : JSON.stringify({ technicianProfileId: "x" }),
      }),
    );
    restore();
    assertEquals(res.status, 401);
    assertEquals((await res.json()).error.code, "UNAUTHORIZED");
  });
}

Deno.test("professional-availability exposes the five methods in CORS preflight", async () => {
  const restore = silence();
  const previousOrigins = Deno.env.get("ALLOWED_ORIGINS");
  Deno.env.set("ALLOWED_ORIGINS", "http://localhost:3000");
  const res = await handler(
    new Request("http://fn/professional-availability", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000" },
    }),
  );
  if (previousOrigins === undefined) Deno.env.delete("ALLOWED_ORIGINS");
  else Deno.env.set("ALLOWED_ORIGINS", previousOrigins);
  restore();
  assertEquals(res.status, 204);
  assertEquals(
    res.headers.get("Access-Control-Allow-Methods"),
    "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  );
});

Deno.test("rows map to the API contract with ISO UTC timestamps", () => {
  const w = toWindow({
    id: "w1",
    starts_at: "2026-10-18T00:00:00+00:00",
    ends_at: "2026-10-19T00:00:00+00:00",
    status: "available",
    updated_at: "2026-10-09T10:00:00+00:00",
  });
  assertEquals(w, {
    id: "w1",
    startsAt: "2026-10-18T00:00:00.000Z",
    endsAt: "2026-10-19T00:00:00.000Z",
    status: "available",
    updatedAt: "2026-10-09T10:00:00.000Z",
  });
});

Deno.test("rotation rows map to the API contract (date only, cycle kept in order)", () => {
  assertEquals(
    toRotation({
      pattern: "custom",
      anchor: "2026-11-01",
      custom_cycle: ["working", "off", "off"],
    }),
    { pattern: "custom", anchor: "2026-11-01", customCycle: ["working", "off", "off"] },
  );
});

Deno.test("calendar save sends the expected version, or none for older clients (W5-03)", () => {
  const days = [{ date: "2028-10-01", status: "available" as const }];
  const key = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
  assertEquals(
    replaceDaysArgs({ days, expectedVersion: "0123456789abcdef0123456789abcdef" }, key),
    {
      p_idempotency_key: key,
      p_days: days,
      p_rotation: null,
      p_expected_version: "0123456789abcdef0123456789abcdef",
    },
  );
  assertEquals(replaceDaysArgs({ days }, key).p_expected_version, null);
});

Deno.test(
  "N-04: a write that touches a confirmed assignment (CFV01) is a 409 ASSIGNMENT_PROTECTED",
  () => {
    const error = fromDatabaseError({ code: "CFV01", message: "internal detail" });
    assertEquals(
      [error.status, error.code, error.reason],
      [409, "CONFLICT", "ASSIGNMENT_PROTECTED"],
    );
    assertEquals(error.message.includes("internal detail"), false); // the DB message never leaks
    // The applications' family is unchanged, an unknown CFV code is no reason, the stale version
    // (CF412) stays a plain 409 without one.
    assertEquals(fromDatabaseError({ code: "CFA04" }).reason, "AVAILABILITY_INCOMPLETE");
    assertEquals(fromDatabaseError({ code: "CFV99" }).reason, undefined);
    assertEquals(fromDatabaseError({ code: "CF412" }).reason, undefined);
  },
);

Deno.test(
  "N-26: the past-start floor (22023 + hint past_start) is the form's field error; other errors map as before",
  () => {
    const floor = windowWriteError({
      code: "22023",
      hint: "past_start",
      message: "an availability window cannot start on a past day",
    });
    assertEquals(
      [floor.status, floor.code, floor.issues],
      [400, "VALIDATION_ERROR", [{ path: "startsAt", message: "v.start.future" }]],
    );
    assertEquals(floor.message.includes("past day"), false); // the DB message never leaks
    // What an old function answers for the same refusal: a clean 400 without the field (compatibility).
    const refusal = { code: "22023", hint: "past_start" };
    const old = fromDatabaseError(refusal);
    assertEquals([old.status, old.issues], [400, undefined]);
    // Another 22023, a CHECK or the assignment lock are unchanged.
    assertEquals(windowWriteError({ code: "22023", hint: "other" }).issues, undefined);
    assertEquals(windowWriteError({ code: "23514" }).status, 400);
    assertEquals(windowWriteError({ code: "CFV01" }).reason, "ASSIGNMENT_PROTECTED");
  },
);
