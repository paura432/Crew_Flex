import { assertEquals } from "@std/assert";
import { handler, toWindow } from "./index.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

for (const method of ["GET", "POST", "PATCH", "DELETE"] as const) {
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

Deno.test("professional-availability exposes the four methods in CORS preflight", async () => {
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
    "GET, POST, PATCH, DELETE, OPTIONS",
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
