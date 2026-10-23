import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Actor } from "../_shared/auth.ts";
import { ApiError } from "../_shared/errors.ts";
import { parseValue } from "../_shared/validation.ts";
import { applicationPackQuery } from "../../../src/lib/validation/candidate-pack.ts";
import { handler } from "./index.ts";
import { loadApplicationPack, loadPackPreview, toCandidatePack } from "./pack.ts";

const ID = "00000000-0000-4000-8000-0000000000aa";

const ROW = {
  application_id: ID,
  copied_at: "2026-10-24 09:30:00.123+00",
  primary_category: "B1.1",
  categories: ["B1.1", "B2"],
  years_experience: 12,
  english_level: "C1",
  base_location: "Barcelona (BCN)",
  base_country: "ES",
  aircraft: ["A320 Family"],
  engines: ["CFM56-5B/7B"],
  skills: ["borescope"],
  work_permits: ["PT", "ES"],
  general_restrictions: null,
  min_rate: "45.50",
  rate_unit: "hour",
  type_ratings: [
    { aircraft: "A320 Family", category: "B1.1", expiresAt: null, restrictions: "No run-ups" },
  ],
  qualifications: [
    {
      code: "B1.1",
      name: "Part-66 B1.1",
      category: "LICENSE",
      verificationStatus: "verified",
      expiresAt: "2030-01-31",
    },
  ],
  experience: [
    {
      date: "2026-10-20",
      aircraft: "A320 EC-QAA",
      ata: "32",
      hours: 3.5,
      category: "inspection",
      environment: "line_maintenance",
      description: "Main wheel replaced (synthetic).",
    },
  ],
};

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

/** An actor whose client answers one RPC (and the professional check) with fixed data. */
function fakeActor(rpc: { data: unknown; error: unknown }, technician = true): Actor {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: () =>
      Promise.resolve({ data: technician ? { profile_id: ID } : null, error: null }),
  };
  const client = {
    rpc: () => Promise.resolve(rpc),
    from: () => query,
  } as unknown as SupabaseClient;
  return { id: ID, email: null, client };
}

Deno.test("a copy row maps field by field; nothing the database adds reaches the client", () => {
  const pack = toCandidatePack({
    ...ROW,
    display_name: "Technician Delta",
    phone: "+34 600 111 222",
    current_employer_id: ID,
    type_ratings: [{ ...ROW.type_ratings[0], documentId: ID }],
    experience: [{ ...ROW.experience[0], id: ID }],
  });
  assertEquals(pack.minRate, { amount: 45.5, unit: "hour" });
  assertEquals(pack.copiedAt, "2026-10-24T09:30:00.123Z");
  assertEquals(pack.applicationId, ID);
  assertEquals(Object.keys(pack.typeRatings[0]!), [
    "aircraft",
    "category",
    "expiresAt",
    "restrictions",
  ]);
  assertEquals(Object.keys(pack.experience[0]!).includes("id"), false);
  const text = JSON.stringify(pack);
  for (const secret of ["Technician Delta", "+34 600 111 222", "display", "phone", "employer"])
    assertEquals(text.includes(secret), false, secret);
});

Deno.test("the preview row has no application id; no rate without a unit", () => {
  const { application_id: _id, ...preview } = ROW;
  const pack = toCandidatePack({ ...preview, min_rate: null, rate_unit: null });
  assertEquals([pack.applicationId, pack.minRate], [null, null]);
});

Deno.test("an unknown catalog value is refused, not passed through", () => {
  assertThrows(() => toCandidatePack({ ...ROW, aircraft: ["Concorde"] }));
  assertThrows(() =>
    toCandidatePack({ ...ROW, experience: [{ ...ROW.experience[0], hours: "x" }] }),
  );
});

Deno.test("the pack query is strict: the side never comes from the request", () => {
  for (const extra of [{ userId: ID }, { organizationId: ID }, { side: "organization" }]) {
    const error = assertThrows(
      () => parseValue({ view: "pack", applicationId: ID, ...extra }, applicationPackQuery),
      ApiError,
    );
    assertEquals(error.code, "VALIDATION_ERROR");
  }
});

Deno.test("loadApplicationPack: a party's copy, no copy (null), not a party (404)", async () => {
  assertEquals(
    (await loadApplicationPack(fakeActor({ data: [ROW], error: null }), ID)).pack?.applicationId,
    ID,
  );
  assertEquals(await loadApplicationPack(fakeActor({ data: [], error: null }), ID), { pack: null });
  const notParty = await assertRejects(
    () => loadApplicationPack(fakeActor({ data: null, error: { code: "P0002" } }), ID),
    ApiError,
  );
  assertEquals(notParty.code, "NOT_FOUND");
  const other = await assertRejects(
    () =>
      loadApplicationPack(
        fakeActor({ data: [{ ...ROW, application_id: crypto.randomUUID() }], error: null }),
        ID,
      ),
    ApiError,
  );
  assertEquals(other.code, "INTERNAL_ERROR");
});

Deno.test("loadPackPreview: professionals only, exactly one row", async () => {
  const { application_id: _id, ...preview } = ROW;
  const ok = await loadPackPreview(fakeActor({ data: [preview], error: null }));
  assertEquals(ok.pack.applicationId, null);
  const org = await assertRejects(
    () => loadPackPreview(fakeActor({ data: [preview], error: null }, false)),
    ApiError,
  );
  assertEquals(org.code, "FORBIDDEN");
});

for (const query of ["view=pack&applicationId=" + ID, "view=pack-preview"]) {
  Deno.test(`GET ?${query} needs a session before any database access`, async () => {
    const restore = silence();
    const res = await handler(new Request(`http://fn/applications?${query}`));
    restore();
    assertEquals([res.status, (await res.json()).error.code], [401, "UNAUTHORIZED"]);
  });
}
