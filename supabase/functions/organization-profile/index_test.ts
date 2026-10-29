import { assertEquals } from "@std/assert";
import { fromDatabaseError } from "../_shared/errors.ts";
import { toOrganization } from "../_shared/organizations.ts";
import { handler, toActivity } from "./index.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

async function call(init: RequestInit = {}, query = "") {
  const restore = silence();
  try {
    const res = await handler(new Request(`http://fn/organization-profile${query}`, init));
    return { status: res.status, body: await res.json() };
  } finally {
    restore();
  }
}

const ORG = "3f0c6a52-1d4b-4c55-9a4e-2f1f6f0e9a10";

for (const method of ["GET", "PATCH"] as const) {
  Deno.test(
    `organization-profile ${method}: unauthenticated → 401 before any database access`,
    async () => {
      const { status, body } = await call(
        {
          method,
          body:
            method === "GET" ? undefined : JSON.stringify({ organizationId: ORG, name: "Mallory" }),
        },
        `?organizationId=${ORG}`,
      );
      assertEquals([status, body.error.code], [401, "UNAUTHORIZED"]);
    },
  );
}

Deno.test(
  "organization-profile has no POST/PUT/DELETE (organizations are created at sign-up only)",
  async () => {
    for (const method of ["POST", "PUT", "DELETE"]) {
      const { status } = await call({ method });
      assertEquals(status, 405);
    }
  },
);

Deno.test(
  "rows map to the contract: fiscal data, review state and the version; no evidence",
  () => {
    const organization = toOrganization({
      id: ORG,
      name: "Demo MRO Madrid",
      type: "mro",
      country: "ES",
      tax_id: "ESB00000000",
      tax_address: "Calle Ficticia 1, 28042 Madrid",
      review_status: "reviewed",
      reviewed_at: "2026-10-23T09:00:00+00:00",
      updated_at: "2026-10-23T09:00:00.123456+00:00",
    });
    assertEquals(organization, {
      id: ORG,
      name: "Demo MRO Madrid",
      type: "mro",
      country: "ES",
      taxId: "ESB00000000",
      taxAddress: "Calle Ficticia 1, 28042 Madrid",
      reviewStatus: "reviewed",
      reviewedAt: "2026-10-23T09:00:00.000Z",
      updatedAt: "2026-10-23T09:00:00.123Z",
    });
  },
);

Deno.test("activity keeps only the action code and the time (no actor, entity or metadata)", () => {
  assertEquals(
    toActivity({
      action: "organization.updated",
      created_at: "2026-10-23T09:00:00+00:00",
      actor_profile_id: "someone",
      metadata: { fields: ["tax_id"] },
    }),
    { action: "organization.updated", at: "2026-10-23T09:00:00.000Z" },
  );
});

Deno.test("save RPC failures map to safe API errors", () => {
  assertEquals(fromDatabaseError({ code: "CF412", message: "modified" }).status, 409);
  assertEquals(fromDatabaseError({ code: "42501", message: "not authorized" }).status, 403);
  assertEquals(
    fromDatabaseError({ code: "22023", message: "invalid organization data" }).status,
    400,
  );
});
