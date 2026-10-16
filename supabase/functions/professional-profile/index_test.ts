import { assertEquals } from "@std/assert";
import { handler, toProfile } from "./index.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

for (const method of ["GET", "PATCH"] as const) {
  Deno.test(`professional-profile ${method} rejects unauthenticated requests`, async () => {
    const restore = silence();
    const res = await handler(
      new Request("http://fn/professional-profile", {
        method,
        body: method === "GET" ? undefined : JSON.stringify({ displayName: "Mallory" }),
      }),
    );
    restore();
    assertEquals(res.status, 401);
    assertEquals((await res.json()).error.code, "UNAUTHORIZED");
  });
}

Deno.test(
  "professional-profile has no POST/DELETE (no create, no delete of a passport)",
  async () => {
    const restore = silence();
    for (const method of ["POST", "DELETE"]) {
      const res = await handler(new Request("http://fn/professional-profile", { method }));
      assertEquals(res.status, 405);
      assertEquals((await res.json()).error.code, "METHOD_NOT_ALLOWED");
    }
    restore();
  },
);

Deno.test(
  "rows map to the API contract (name from profiles, version = technician_profiles.updated_at)",
  () => {
    const profile = toProfile({
      profile_id: "p1",
      base_location: "Madrid (MAD)",
      mobility: "national",
      years_experience: 9,
      current_status: "employed",
      visibility: "private",
      updated_at: "2026-10-01T10:00:00+00:00",
      profiles: { display_name: "Technician Alpha", updated_at: "2026-10-02T10:00:00+00:00" },
    });
    assertEquals(profile, {
      displayName: "Technician Alpha",
      baseLocation: "Madrid (MAD)",
      mobility: "national",
      yearsExperience: 9,
      currentStatus: "employed",
      visibility: "private",
      // profiles.updated_at (2026-10-02, e.g. a language change) is not the passport version (review L5).
      updatedAt: "2026-10-01T10:00:00.000Z",
    });
  },
);
