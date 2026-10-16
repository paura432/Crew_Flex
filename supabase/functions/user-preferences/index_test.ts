import { assertEquals } from "@std/assert";
import { handler, toPreferences } from "./index.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

for (const method of ["GET", "PATCH"] as const) {
  Deno.test(`user-preferences ${method} rejects unauthenticated requests`, async () => {
    const restore = silence();
    const res = await handler(
      new Request("http://fn/user-preferences", {
        method,
        body: method === "GET" ? undefined : JSON.stringify({ locale: "es", profileId: "x" }),
      }),
    );
    restore();
    assertEquals(res.status, 401);
    assertEquals((await res.json()).error.code, "UNAUTHORIZED");
  });
}

Deno.test("user-preferences has no POST/DELETE", async () => {
  const restore = silence();
  for (const method of ["POST", "DELETE"]) {
    const res = await handler(new Request("http://fn/user-preferences", { method }));
    assertEquals(res.status, 405);
  }
  restore();
});

Deno.test("rows map to the API contract", () => {
  assertEquals(toPreferences({ preferred_locale: "es", updated_at: "2026-10-11T10:00:00+00:00" }), {
    locale: "es",
    updatedAt: "2026-10-11T10:00:00.000Z",
  });
  assertEquals(
    toPreferences({ preferred_locale: null, updated_at: "2026-10-11T10:00:00Z" }).locale,
    null,
  );
});
