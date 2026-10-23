import { assertEquals, assertThrows } from "@std/assert";
import { fromDatabaseError } from "../_shared/errors.ts";
import { handler, toDecision, toRepresentedClient } from "./index.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

async function call(path: string, init: RequestInit = {}) {
  const restore = silence();
  try {
    const res = await handler(new Request(`http://fn/represented-clients${path}`, init));
    return { status: res.status, body: await res.json() };
  } finally {
    restore();
  }
}

const ORG = "22222222-2222-4222-8222-000000000001";
const CLIENT = "44444444-4444-4444-8444-000000000001";

Deno.test("unauthenticated calls are 401 before any validation or database access", async () => {
  for (const [path, init] of [
    [`?organizationId=${ORG}`, {}],
    ["?view=review", {}],
    ["", { method: "POST", body: JSON.stringify({ organizationId: ORG, name: "Cliente" }) }],
    ["", { method: "PATCH", body: JSON.stringify({ id: CLIENT, action: "revoke" }) }],
    ["", { method: "PATCH", body: JSON.stringify({ id: CLIENT, action: "activate", note: "x" }) }],
  ] as const) {
    const { status, body } = await call(path, init);
    assertEquals(
      [status, body.error.code],
      [401, "UNAUTHORIZED"],
      `${init.method ?? "GET"} ${path}`,
    );
  }
});

Deno.test(
  "no DELETE: a representation is revoked, never removed (history stays true)",
  async () => {
    assertEquals((await call("", { method: "DELETE" })).status, 405);
    assertEquals((await call("", { method: "PUT" })).status, 405);
  },
);

Deno.test(
  "rows map to the contract (no evidence, no creator; a member's row has no e-mail)",
  () => {
    assertEquals(
      toRepresentedClient({
        id: CLIENT,
        agency_id: ORG,
        name: "Operador cliente 1",
        contact_email: "ops@client.test",
        status: "active",
        created_at: "2026-10-23T09:00:00+00:00",
        activated_at: "2026-10-23T10:00:00+00:00",
        revoked_at: null,
      }),
      {
        id: CLIENT,
        organizationId: ORG,
        name: "Operador cliente 1",
        contactEmail: "ops@client.test",
        status: "active",
        createdAt: "2026-10-23T09:00:00.000Z",
        activatedAt: "2026-10-23T10:00:00.000Z",
        revokedAt: null,
      },
    );
    assertThrows(() => toRepresentedClient({ id: CLIENT, status: "approved" }));
  },
);

Deno.test("a decision returns the id and the status only", () => {
  assertEquals(
    toDecision([{ id: CLIENT, status: "revoked", revoked_at: "2026-10-23T10:00:00Z" }]),
    { id: CLIENT, status: "revoked" },
  );
});

Deno.test(
  "refusals map to safe errors: own agency / not an agency 403, cap and duplicates 409, missing 404",
  () => {
    assertEquals(
      fromDatabaseError({ code: "42501", message: "only a staffing agency" }).status,
      403,
    );
    assertEquals(fromDatabaseError({ code: "23505" }).status, 409);
    assertEquals(fromDatabaseError({ code: "55000" }).status, 409);
    assertEquals(fromDatabaseError({ code: "P0002" }).status, 404);
    assertEquals(fromDatabaseError({ code: "22023" }).status, 400);
  },
);
