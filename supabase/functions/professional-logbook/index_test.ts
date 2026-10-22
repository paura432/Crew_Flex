import { assertEquals, assertThrows } from "@std/assert";
import { createArgs, handler, toLogbookEntry, updateColumns } from "./index.ts";
import { createLogbookEntryInput } from "../../../src/lib/validation/logbook.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

for (const method of ["GET", "POST", "PATCH", "DELETE"] as const) {
  Deno.test(`professional-logbook ${method} rejects unauthenticated requests`, async () => {
    const restore = silence();
    const res = await handler(
      new Request("http://fn/professional-logbook?id=22222222-2222-4222-8222-000000000001", {
        method,
        body: method === "GET" ? undefined : JSON.stringify({ technicianProfileId: "x" }),
      }),
    );
    restore();
    assertEquals(res.status, 401);
    assertEquals((await res.json()).error.code, "UNAUTHORIZED");
  });
}

Deno.test(
  "professional-logbook answers 405 to PUT and lists its four methods in CORS",
  async () => {
    const restore = silence();
    const previousOrigins = Deno.env.get("ALLOWED_ORIGINS");
    Deno.env.set("ALLOWED_ORIGINS", "http://localhost:3000");
    const put = await handler(new Request("http://fn/professional-logbook", { method: "PUT" }));
    const preflight = await handler(
      new Request("http://fn/professional-logbook", {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:3000" },
      }),
    );
    if (previousOrigins === undefined) Deno.env.delete("ALLOWED_ORIGINS");
    else Deno.env.set("ALLOWED_ORIGINS", previousOrigins);
    restore();
    assertEquals(put.status, 405);
    assertEquals(preflight.status, 204);
    assertEquals(
      preflight.headers.get("Access-Control-Allow-Methods"),
      "GET, POST, PATCH, DELETE, OPTIONS",
    );
  },
);

Deno.test("rows map to the API contract (date only, numeric hours, ISO timestamps)", () => {
  const entry = toLogbookEntry({
    id: "e1",
    entry_date: "2026-10-20",
    aircraft: "A320 EC-QAA",
    ata: "32",
    hours: "3.5",
    category: "component_replacement",
    environment: "line_maintenance",
    description: "Main wheel replaced.",
    cv_relevant: true,
    archived: false,
    created_at: "2026-10-20T10:00:00+00:00",
    updated_at: "2026-10-21T10:00:00+00:00",
  });
  assertEquals(entry, {
    id: "e1",
    entryDate: "2026-10-20",
    aircraft: "A320 EC-QAA",
    ata: "32",
    hours: 3.5,
    category: "component_replacement",
    environment: "line_maintenance",
    description: "Main wheel replaced.",
    cvRelevant: true,
    archived: false,
    createdAt: "2026-10-20T10:00:00.000Z",
    updatedAt: "2026-10-21T10:00:00.000Z",
  });
  assertThrows(() => toLogbookEntry({ id: "e1" }));
});

Deno.test("create sends the parsed fields, never an owner; a missing ATA is null", () => {
  const input = createLogbookEntryInput.parse({
    entryDate: "2026-10-01",
    aircraft: " B737 NG ",
    hours: 1.5,
    category: "inspection",
    environment: "base_maintenance",
    description: "Hydraulic leak check.",
  });
  const key = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
  assertEquals(createArgs(input, key), {
    p_idempotency_key: key,
    p_entry_date: "2026-10-01",
    p_aircraft: "B737 NG",
    p_ata: null,
    p_hours: 1.5,
    p_category: "inspection",
    p_environment: "base_maintenance",
    p_description: "Hydraulic leak check.",
    p_cv_relevant: false,
  });
});

Deno.test("PATCH maps only the fields sent to their columns", () => {
  assertEquals(updateColumns({ archived: true }), { archived: true });
  assertEquals(updateColumns({ cvRelevant: false, ata: null, hours: 2 }), {
    cv_relevant: false,
    ata: null,
    hours: 2,
  });
  assertEquals(
    Object.keys(
      updateColumns({
        entryDate: "2026-10-01",
        aircraft: "A",
        ata: "1",
        hours: 1,
        category: "inspection",
        environment: "workshop",
        description: "d",
        cvRelevant: true,
        archived: false,
      }),
    ),
    [
      "entry_date",
      "aircraft",
      "ata",
      "hours",
      "category",
      "environment",
      "description",
      "cv_relevant",
      "archived",
    ],
  );
});
