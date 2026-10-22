import { assertEquals } from "@std/assert";
import { fromDatabaseError } from "../_shared/errors.ts";
import { handler, toDecision } from "./index.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

async function call(init: RequestInit = {}) {
  const restore = silence();
  try {
    const res = await handler(new Request("http://fn/organization-reviews", init));
    return { status: res.status, body: await res.json() };
  } finally {
    restore();
  }
}

Deno.test("unauthenticated calls are 401 before any database access", async () => {
  for (const method of ["GET", "POST"]) {
    const { status, body } = await call({
      method,
      body: method === "POST" ? JSON.stringify({ note: "x" }) : undefined,
    });
    assertEquals([status, body.error.code], [401, "UNAUTHORIZED"]);
  }
});

Deno.test("no PATCH/DELETE: a review is registered, never edited or removed", async () => {
  for (const method of ["PATCH", "DELETE"]) {
    const { status } = await call({ method });
    assertEquals(status, 405);
  }
});

Deno.test("the decision row maps to the minimal contract", () => {
  assertEquals(
    toDecision([{ id: "o1", review_status: "reviewed", reviewed_at: "2026-10-23T09:00:00+00:00" }]),
    { id: "o1", reviewStatus: "reviewed", reviewedAt: "2026-10-23T09:00:00.000Z" },
  );
});

Deno.test("review RPC failures map to safe API errors", () => {
  assertEquals(fromDatabaseError({ code: "42501", message: "own organization" }).status, 403);
  assertEquals(fromDatabaseError({ code: "P0002", message: "organization not found" }).status, 404);
  assertEquals(fromDatabaseError({ code: "55000", message: "not awaiting review" }).status, 409);
  assertEquals(fromDatabaseError({ code: "22023", message: "evidence" }).status, 400);
});
