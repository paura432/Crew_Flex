import { assert, assertEquals, assertFalse } from "@std/assert";
import { z } from "zod";
import { ApiError, fromDatabaseError } from "./errors.ts";
import { createHandler } from "./http.ts";
import { MAX_BODY_BYTES, parseJsonBody } from "./validation.ts";
import { handler as health } from "../health/index.ts";
import { handler as workRequirements } from "../work-requirements/index.ts";
import { handler as capacity } from "../capacity-evaluate/index.ts";
import { handler as matching } from "../matching-evaluate/index.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

Deno.test("health returns the standard success envelope", async () => {
  const restore = silence();
  const res = await health(new Request("http://fn/health"));
  restore();
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.ok, true);
  assertEquals(body.data.status, "ok");
  assertEquals(body.requestId, res.headers.get("x-request-id"));
  assertEquals(res.headers.get("Cache-Control"), "no-store");
});

Deno.test("H. internal errors are normalized and never leak details", async () => {
  const restore = silence();
  const fn = createHandler("test", {
    GET: () => {
      throw new Error('relation "secret_table" does not exist; password=hunter2');
    },
  });
  const res = await fn(new Request("http://fn/test"));
  restore();
  const text = await res.text();
  assertEquals(res.status, 500);
  assertFalse(text.includes("secret_table"));
  assertFalse(text.includes("hunter2"));
  assertFalse(text.includes("stack"));
  assertEquals(JSON.parse(text).error, {
    code: "INTERNAL_ERROR",
    message: "Unexpected server error. Try again later.",
  });
});

Deno.test("database errors map to safe codes without forwarding the DB message", () => {
  const rls = fromDatabaseError({
    code: "42501",
    message: "new row violates row-level security policy for table x",
  });
  assertEquals(
    [rls.code, rls.message],
    ["FORBIDDEN", "You do not have permission to perform this action."],
  );
  assertEquals(
    fromDatabaseError({ code: "23514", message: "check constraint c" }).code,
    "VALIDATION_ERROR",
  );
  assertEquals(
    fromDatabaseError({ code: "XX000", message: "boom at line 3" }).message.includes("boom"),
    false,
  );
});

for (const [name, fn, method] of [
  ["work-requirements", workRequirements, "GET"],
  ["work-requirements", workRequirements, "POST"],
  ["capacity-evaluate", capacity, "POST"],
  ["matching-evaluate", matching, "POST"],
] as const) {
  Deno.test(`${name} ${method} rejects unauthenticated requests`, async () => {
    const restore = silence();
    const res = await fn(
      new Request(`http://fn/${name}`, {
        method,
        body:
          method === "POST"
            ? JSON.stringify({ userId: "00000000-0000-4000-8000-000000000001" })
            : undefined,
      }),
    );
    restore();
    assertEquals(res.status, 401);
    assertEquals((await res.json()).error.code, "UNAUTHORIZED");
  });
}

Deno.test("unsupported methods return METHOD_NOT_ALLOWED", async () => {
  const restore = silence();
  const res = await health(new Request("http://fn/health", { method: "DELETE" }));
  restore();
  assertEquals(res.status, 405);
});

Deno.test("CORS: allowlisted origin is echoed, others get no ACAO and never *", async () => {
  const restore = silence();
  const allowed = await health(
    new Request("http://fn/health", { headers: { Origin: "http://localhost:3000" } }),
  );
  const denied = await health(
    new Request("http://fn/health", { headers: { Origin: "https://evil.example" } }),
  );
  const preflight = await health(
    new Request("http://fn/health", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000" },
    }),
  );
  restore();
  assertEquals(allowed.headers.get("Access-Control-Allow-Origin"), "http://localhost:3000");
  assertEquals(denied.headers.get("Access-Control-Allow-Origin"), null);
  assertEquals(preflight.status, 204);
  assert(preflight.headers.get("Access-Control-Allow-Methods")?.includes("GET"));
});

Deno.test("request id: valid UUID is propagated, anything else is replaced", async () => {
  const restore = silence();
  const id = crypto.randomUUID();
  const echoed = await health(new Request("http://fn/health", { headers: { "x-request-id": id } }));
  const replaced = await health(
    new Request("http://fn/health", { headers: { "x-request-id": "<script>" } }),
  );
  restore();
  assertEquals(echoed.headers.get("x-request-id"), id);
  assert(replaced.headers.get("x-request-id") !== "<script>");
});

Deno.test("E. strict payload schemas reject caller-supplied identity", async () => {
  const schema = z.strictObject({ requirementId: z.uuid() });
  const req = new Request("http://fn", {
    method: "POST",
    body: JSON.stringify({ requirementId: crypto.randomUUID(), userId: crypto.randomUUID() }),
  });
  try {
    await parseJsonBody(req, schema);
    throw new Error("expected validation error");
  } catch (error) {
    assert(error instanceof ApiError);
    assertEquals(error.code, "VALIDATION_ERROR");
  }
});

Deno.test("oversized and malformed bodies are rejected", async () => {
  const schema = z.strictObject({});
  const big = new Request("http://fn", { method: "POST", body: "x".repeat(MAX_BODY_BYTES + 1) });
  const bad = new Request("http://fn", { method: "POST", body: "{not json" });
  for (const [req, code] of [
    [big, "PAYLOAD_TOO_LARGE"],
    [bad, "VALIDATION_ERROR"],
  ] as const) {
    try {
      await parseJsonBody(req, schema);
      throw new Error("expected error");
    } catch (error) {
      assert(error instanceof ApiError);
      assertEquals(error.code, code);
    }
  }
});
