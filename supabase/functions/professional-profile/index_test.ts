import { assertEquals } from "@std/assert";
import { handler, toProfile } from "./index.ts";
import {
  passportPayload,
  updateProfessionalProfileInput,
} from "../../../src/lib/validation/professional.ts";

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

const V0_ROW = {
  profile_id: "p1",
  base_location: "Madrid (MAD)",
  mobility: "national",
  years_experience: 9,
  current_status: "employed",
  visibility: "private",
  updated_at: "2026-10-01T10:00:00+00:00",
  primary_category: null,
  categories: [],
  aircraft: [],
  engines: [],
  skills: [],
  english_level: null,
  own_tools: false,
  base_country: null,
  work_permits: [],
  general_restrictions: null,
  profiles: { display_name: "Technician Alpha", updated_at: "2026-10-02T10:00:00+00:00" },
};

Deno.test(
  "rows map to the API contract (name from profiles, version = technician_profiles.updated_at)",
  () => {
    const profile = toProfile({ profile: V0_ROW, privateDetails: null, blocks: [], ratings: [] });
    assertEquals(profile, {
      displayName: "Technician Alpha",
      baseLocation: "Madrid (MAD)",
      mobility: "national",
      yearsExperience: 9,
      currentStatus: "employed",
      visibility: "private",
      primaryCategory: null,
      categories: [],
      aircraft: [],
      engines: [],
      skills: [],
      englishLevel: null,
      ownTools: false,
      baseCountry: null,
      workPermits: [],
      generalRestrictions: null,
      typeRatings: [],
      // No private row before the first save: no phone, no rate, v1.8's per-day unit.
      phone: null,
      currentEmployerId: null,
      minRate: null,
      rateUnit: "day",
      blockedOrganizationIds: [],
      // profiles.updated_at (2026-10-02, e.g. a language change) is not the passport version (review L5).
      updatedAt: "2026-10-01T10:00:00.000Z",
    });
  },
);

Deno.test("v1.8 declarations come back in catalog order and the private row is merged", () => {
  const profile = toProfile({
    profile: {
      ...V0_ROW,
      primary_category: "B1.1",
      categories: ["B2", "B1.1"],
      aircraft: ["B737 NG", "A320 Family"],
      work_permits: ["ES", "PT"],
      general_restrictions: "Engine tasks under B1 supervision",
    },
    privateDetails: {
      phone: "+34 600 000 001",
      current_employer_id: "o1",
      min_rate: "45.50",
      rate_unit: "hour",
    },
    blocks: [{ organization_id: "o2" }],
    ratings: [
      { aircraft: "B737 NG", category: "B1.1", expires_at: null, restrictions: null },
      {
        aircraft: "A320 Family",
        category: "B2",
        expires_at: "2028-01-31",
        restrictions: "No CFM56",
      },
      { aircraft: "A320 Family", category: "B1.1", expires_at: null, restrictions: null },
    ],
  });
  assertEquals(profile.categories, ["B1.1", "B2"]);
  assertEquals(profile.aircraft, ["A320 Family", "B737 NG"]);
  assertEquals(profile.workPermits, ["PT", "ES"]); // v1.8 order (server/rules.mjs:1): PT before ES
  assertEquals(
    profile.typeRatings.map((r) => `${r.aircraft}·${r.category}`),
    ["A320 Family·B1.1", "A320 Family·B2", "B737 NG·B1.1"],
  );
  assertEquals(
    [profile.phone, profile.currentEmployerId, profile.minRate, profile.rateUnit],
    ["+34 600 000 001", "o1", 45.5, "hour"],
  );
  assertEquals(profile.blockedOrganizationIds, ["o2"]);
});

Deno.test("the PATCH body is GET's profile minus the version, and the RPC payload too", () => {
  const { updatedAt: _version, ...editable } = toProfile({
    profile: V0_ROW,
    privateDetails: null,
    blocks: [],
    ratings: [],
  });
  const input = updateProfessionalProfileInput.parse({
    ...editable,
    expectedUpdatedAt: "2026-10-01T10:00:00.000Z",
  });
  assertEquals(Object.keys(passportPayload(input)).sort(), Object.keys(editable).sort());
});
