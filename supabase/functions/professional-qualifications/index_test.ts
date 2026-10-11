import { assertEquals } from "@std/assert";
import { handler, toQualification } from "./index.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

for (const method of ["GET", "POST", "PATCH", "DELETE"] as const) {
  Deno.test(`professional-qualifications ${method} rejects unauthenticated requests`, async () => {
    const restore = silence();
    const res = await handler(
      new Request("http://fn/professional-qualifications?id=22222222-2222-4222-8222-000000000001", {
        method,
        body:
          method === "GET"
            ? undefined
            : JSON.stringify({ technicianProfileId: "x", verificationStatus: "verified" }),
      }),
    );
    restore();
    assertEquals(res.status, 401);
    assertEquals((await res.json()).error.code, "UNAUTHORIZED");
  });
}

Deno.test("professional-qualifications exposes the four methods in CORS preflight", async () => {
  const restore = silence();
  const previousOrigins = Deno.env.get("ALLOWED_ORIGINS");
  Deno.env.set("ALLOWED_ORIGINS", "http://localhost:3000");
  const res = await handler(
    new Request("http://fn/professional-qualifications", {
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
    "GET, POST, PATCH, DELETE, OPTIONS",
  );
});

Deno.test("rows map to the API contract with the catalog type and calendar dates", () => {
  const q = toQualification({
    id: "q1",
    status: "active",
    issued_at: "2020-01-15",
    expires_at: "2029-06-30",
    verification_status: "pending",
    updated_at: "2026-10-09T10:00:00+00:00",
    qualification_types: {
      id: "t1",
      code: "B1.1",
      name: "Part-66 B1.1 — Aeroplanes, turbine",
      category: "LICENSE",
      requires_expiry: true,
    },
  });
  assertEquals(q, {
    id: "q1",
    type: {
      id: "t1",
      code: "B1.1",
      name: "Part-66 B1.1 — Aeroplanes, turbine",
      category: "LICENSE",
      requiresExpiry: true,
    },
    status: "active",
    issuedAt: "2020-01-15",
    expiresAt: "2029-06-30",
    verificationStatus: "pending",
    updatedAt: "2026-10-09T10:00:00.000Z",
  });
});
