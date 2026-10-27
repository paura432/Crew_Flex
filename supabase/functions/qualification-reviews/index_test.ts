import { assertEquals } from "@std/assert";
import { fromDatabaseError } from "../_shared/errors.ts";
import { handler, toHistoryItem, toQueueItem } from "./index.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

async function call(init: RequestInit = {}) {
  const restore = silence();
  try {
    const res = await handler(new Request("http://fn/qualification-reviews", init));
    return { status: res.status, body: await res.json() };
  } finally {
    restore();
  }
}

Deno.test("fails closed: without QUALIFICATION_REVIEW_ENABLED every method is 404", async () => {
  Deno.env.delete("QUALIFICATION_REVIEW_ENABLED");
  for (const method of ["GET", "POST"]) {
    const { status, body } = await call({ method, headers: { Authorization: "Bearer x" } });
    assertEquals([status, body.error.code], [404, "NOT_FOUND"]);
  }
});

Deno.test("enabled: unauthenticated calls are 401 before any database access", async () => {
  Deno.env.set("QUALIFICATION_REVIEW_ENABLED", "true");
  try {
    const { status, body } = await call({ method: "POST", body: "{}" });
    assertEquals([status, body.error.code], [401, "UNAUTHORIZED"]);
  } finally {
    Deno.env.delete("QUALIFICATION_REVIEW_ENABLED");
  }
});

Deno.test("no PATCH/DELETE", async () => {
  Deno.env.set("QUALIFICATION_REVIEW_ENABLED", "true");
  try {
    for (const method of ["PATCH", "DELETE"]) {
      const { status } = await call({ method });
      assertEquals(status, 405);
    }
  } finally {
    Deno.env.delete("QUALIFICATION_REVIEW_ENABLED");
  }
});

Deno.test(
  "queue and history rows map to the minimal contract (no e-mail, no free-text note)",
  () => {
    const item = toQueueItem({
      id: "q1",
      issued_at: null,
      expires_at: "2029-06-30",
      created_at: "2026-10-15T10:00:00+00:00",
      updated_at: "2026-10-15T10:30:00+00:00",
      qualification_types: { code: "B1.1", name: "Part-66 B1.1", category: "LICENSE" },
      technician_profiles: {
        profile_id: "p1",
        base_location: "MAD",
        general_restrictions: "No CRS on engines (QA)",
        profiles: { display_name: "Golf" },
      },
    });
    // The declared restrictions travel to the reviewer (ADM-03 #9); nothing else of the passport does.
    assertEquals(item.professional, {
      id: "p1",
      displayName: "Golf",
      baseLocation: "MAD",
      restrictions: "No CRS on engines (QA)",
    });
    assertEquals(item.declaredAt, "2026-10-15T10:00:00.000Z");
    const history = toHistoryItem({
      entity_id: "q1",
      actor_profile_id: "a1",
      created_at: "2026-10-15T11:00:00+00:00",
      metadata: {
        verification_status: "rejected",
        note_provided: true,
        request_id: "r1",
        previous_verification_status: "pending",
      },
    });
    assertEquals(history, {
      qualificationId: "q1",
      reviewerId: "a1",
      decision: "rejected",
      noteProvided: true,
      requestId: "r1",
      at: "2026-10-15T11:00:00.000Z",
    });
  },
);

Deno.test("review RPC failures map to safe API errors", () => {
  assertEquals(
    fromDatabaseError({ code: "55000", message: "qualification is not awaiting review" }).status,
    409,
  );
  assertEquals(
    fromDatabaseError({ code: "P0002", message: "qualification not found" }).status,
    404,
  );
  assertEquals(
    fromDatabaseError({ code: "42501", message: "nobody reviews their own qualification" }).status,
    403,
  );
});
