import { assertEquals, assertThrows } from "@std/assert";
import { corsHeaders } from "./cors.ts";
import { ApiError, fromDatabaseError } from "./errors.ts";
import { createdRow, idempotencyKey } from "./validation.ts";

const req = (headers: Record<string, string> = {}) =>
  new Request("http://localhost/fn", { method: "POST", headers });

Deno.test("Idempotency-Key: a valid UUID is used as is (lower-cased)", () => {
  assertEquals(
    idempotencyKey(req({ "Idempotency-Key": "6F1C2A52-7B8E-4C1E-9A3F-0D2B5E8C4A11" })),
    "6f1c2a52-7b8e-4c1e-9a3f-0d2b5e8c4a11",
  );
});

Deno.test("Idempotency-Key: a malformed key is a 400 with a field issue", () => {
  const error = assertThrows(() => idempotencyKey(req({ "Idempotency-Key": "retry-1" })), ApiError);
  assertEquals(error.code, "VALIDATION_ERROR");
  assertEquals(error.issues, [{ path: "Idempotency-Key", message: "v.idempotencyKey.invalid" }]);
});

Deno.test("Idempotency-Key: a missing key falls back to a fresh UUID (no deduplication)", () => {
  const a = idempotencyKey(req());
  const b = idempotencyKey(req());
  assertEquals(/^[0-9a-f-]{36}$/.test(a), true);
  assertEquals(a === b, false);
});

Deno.test("createdRow accepts the RPC row (array or object) and rejects anything else", () => {
  const id = crypto.randomUUID();
  assertEquals(createdRow([{ id, replayed: true }]), { id, replayed: true });
  assertEquals(createdRow({ id, replayed: false }), { id, replayed: false });
  assertThrows(() => createdRow([]), ApiError);
  assertThrows(() => createdRow([{ id }]), ApiError);
});

Deno.test(
  "idempotency and optimistic-concurrency failures map to 409 CONFLICT, never leaking SQL",
  () => {
    const reused = fromDatabaseError({
      code: "CF409",
      message: "idempotency key reused with a different request",
    });
    assertEquals([reused.code, reused.status], ["CONFLICT", 409]);
    assertEquals(reused.message.includes("idempotency key"), false);
    const stale = fromDatabaseError({
      code: "CF412",
      message: "profile was modified by another session",
    });
    assertEquals([stale.code, stale.status], ["CONFLICT", 409]);
    assertEquals(stale.message.includes("session"), false);
  },
);

Deno.test("CORS preflight allows the Idempotency-Key header for allowed origins only", () => {
  Deno.env.set("ALLOWED_ORIGINS", "https://crew-flex.vercel.app");
  try {
    const allowed = corsHeaders(
      new Request("http://x", { headers: { Origin: "https://crew-flex.vercel.app" } }),
      ["POST"],
    );
    assertEquals(allowed["Access-Control-Allow-Headers"]?.includes("idempotency-key"), true);
    const denied = corsHeaders(
      new Request("http://x", { headers: { Origin: "https://evil.example" } }),
      ["POST"],
    );
    assertEquals(denied["Access-Control-Allow-Headers"], undefined);
  } finally {
    Deno.env.delete("ALLOWED_ORIGINS");
  }
});
