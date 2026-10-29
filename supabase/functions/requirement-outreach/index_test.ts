import { assertEquals, assertThrows } from "@std/assert";
import { fromDatabaseError } from "../_shared/errors.ts";
import { handler, toDistributeResponse, toDistribution } from "./index.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

const REQ = "00000000-0000-4000-8000-0000000000b1";

async function call(init: RequestInit = {}, query = "") {
  const restore = silence();
  try {
    const res = await handler(new Request(`http://fn/requirement-outreach${query}`, init));
    return { status: res.status, body: await res.json() };
  } finally {
    restore();
  }
}

for (const method of ["GET", "POST"] as const) {
  Deno.test(
    `requirement-outreach ${method}: unauthenticated → 401 before any database access`,
    async () => {
      const { status, body } = await call(
        {
          method,
          body: method === "GET" ? undefined : JSON.stringify({ requirementId: "not-a-uuid" }),
        },
        `?requirementId=${REQ}`,
      );
      assertEquals([status, body.error.code], [401, "UNAUTHORIZED"]);
    },
  );
}

Deno.test(
  "requirement-outreach has no PUT/PATCH/DELETE (a distribution is never edited)",
  async () => {
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      assertEquals((await call({ method })).status, 405);
    }
  },
);

Deno.test(
  "CFO01…CFO05 are 409 with the stable reason, in OUTREACH_CONFLICTS order, without the DB message",
  () => {
    const reasons = ["CFO01", "CFO02", "CFO03", "CFO04", "CFO05"].map((code) => {
      const error = fromDatabaseError({ code, message: "internal detail" });
      assertEquals([error.status, error.code], [409, "CONFLICT"]);
      assertEquals(error.message.includes("internal"), false);
      return error.reason;
    });
    assertEquals(reasons, [
      "OUTREACH_NOT_OPEN",
      "OUTREACH_PLANNED",
      "OUTREACH_ALREADY_SENT",
      "OUTREACH_STARTED",
      "OUTREACH_DAILY_LIMIT",
    ]);
    // An unknown code of the family is not a business conflict (generic 500, never a guessed reason).
    assertEquals(fromDatabaseError({ code: "CFO09" }).code, "INTERNAL_ERROR");
    // The other families are unchanged.
    assertEquals(fromDatabaseError({ code: "CFA01" }).reason, "REQUIREMENT_NOT_OPEN");
    assertEquals(fromDatabaseError({ code: "CFV01" }).reason, "ASSIGNMENT_PROTECTED");
  },
);

Deno.test(
  "a distribution maps to a count and a time — the contract has no field for recipients",
  () => {
    const stored = toDistribution({
      requirement_id: REQ,
      urgency: "aog",
      notified_count: 3,
      created_at: "2026-10-23T08:00:00+00:00",
    });
    assertEquals(stored, {
      requirementId: REQ,
      urgency: "aog",
      notified: 3,
      distributedAt: "2026-10-23T08:00:00.000Z",
    });
    const sent = toDistributeResponse(REQ, [
      { notified: 0, distributed_at: "2026-10-23T08:00:00Z", urgency: "urgent" },
    ]);
    assertEquals(Object.keys(sent).sort(), [
      "distributedAt",
      "notified",
      "requirementId",
      "urgency",
    ]);
    assertEquals(sent.notified, 0);
    // T-128: below 5 eligible professionals the number is not reported, here or in the stored row.
    assertEquals(
      toDistributeResponse(REQ, [
        { notified: null, distributed_at: "2026-10-23T08:00:00Z", urgency: "aog" },
      ]).notified,
      null,
    );
    assertEquals(
      toDistribution({
        requirement_id: REQ,
        urgency: "aog",
        notified_count: null,
        created_at: "2026-10-23T08:00:00Z",
      }).notified,
      null,
    );
    // Planned never comes back as a distributed urgency; negative counts are refused.
    assertThrows(() =>
      toDistribution({
        requirement_id: REQ,
        urgency: "planned",
        notified_count: 1,
        created_at: "x",
      }),
    );
    assertThrows(() =>
      toDistributeResponse(REQ, [{ notified: -1, distributed_at: "x", urgency: "aog" }]),
    );
  },
);
