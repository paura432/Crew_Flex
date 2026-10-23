import { assertEquals, assertThrows } from "@std/assert";
import { handler, saveArgs, toPreferences } from "./index.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

async function call(init: RequestInit = {}) {
  const restore = silence();
  try {
    const res = await handler(new Request("http://fn/notice-preferences", init));
    return { status: res.status, body: await res.json() };
  } finally {
    restore();
  }
}

const body = {
  urgentOptIn: true,
  aogOptIn: true,
  mobilizationHours: 24,
  timeZone: "Europe/Madrid",
  quietStart: "22:00",
  quietEnd: "07:00",
};

for (const method of ["GET", "PUT"] as const) {
  Deno.test(
    `notice-preferences ${method}: unauthenticated → 401 before any validation`,
    async () => {
      const { status, body: res } = await call({
        method,
        // Even an invalid body is answered 401 first: identity, then the payload.
        body: method === "GET" ? undefined : JSON.stringify({ ...body, profileId: "x" }),
      });
      assertEquals([status, res.error.code], [401, "UNAUTHORIZED"]);
    },
  );
}

Deno.test("notice-preferences has no POST/PATCH/DELETE (one row, saved whole)", async () => {
  for (const method of ["POST", "PATCH", "DELETE"]) {
    assertEquals((await call({ method })).status, 405);
  }
});

Deno.test(
  "never saved → the v1.8 defaults: nothing opted in, no mobilization, Europe/Madrid",
  () => {
    assertEquals(toPreferences(null), {
      urgentOptIn: false,
      aogOptIn: false,
      mobilizationHours: null,
      timeZone: "Europe/Madrid",
      quietStart: null,
      quietEnd: null,
      updatedAt: null,
    });
  },
);

Deno.test("a stored row maps to the form (HH:MM, ISO version); the RPC's array result too", () => {
  const row = {
    urgent_opt_in: true,
    aog_opt_in: false,
    mobilization_hours: 48,
    time_zone: "Europe/Lisbon",
    quiet_start: "22:00:00",
    quiet_end: "07:30:00",
    updated_at: "2026-10-23T08:00:00+00:00",
  };
  const expected = {
    urgentOptIn: true,
    aogOptIn: false,
    mobilizationHours: 48,
    timeZone: "Europe/Lisbon",
    quietStart: "22:00",
    quietEnd: "07:30",
    updatedAt: "2026-10-23T08:00:00.000Z",
  };
  assertEquals(toPreferences(row), expected);
  assertEquals(toPreferences([{ ...row, profile_id: "ignored", created_at: "x" }]), expected);
  assertThrows(() => toPreferences({ ...row, mobilization_hours: "48" }));
});

Deno.test(
  "the save sends the form's values only: no profile id travels (the owner is auth.uid())",
  () => {
    const args = saveArgs(body);
    assertEquals(Object.keys(args).sort(), [
      "p_aog_opt_in",
      "p_mobilization_hours",
      "p_quiet_end",
      "p_quiet_start",
      "p_time_zone",
      "p_urgent_opt_in",
    ]);
    assertEquals(args.p_mobilization_hours, 24);
  },
);
