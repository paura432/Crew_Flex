import { assertEquals, assertThrows } from "@std/assert";
import { fromDatabaseError } from "../_shared/errors.ts";
import { parseValue } from "../_shared/validation.ts";
import { DIRECTORY_CONFLICTS } from "../../../src/domain/directory.ts";
import {
  directoryBlockInput,
  directorySearchQuery,
} from "../../../src/lib/validation/directory.ts";
import { handler, toDirectoryCandidate, toSearchResponse } from "./index.ts";

const silence = () => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, { log, error });
};

const ORG = "22222222-2222-4222-8222-000000000001";
const today = new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function call(init: RequestInit = {}, query = "") {
  const restore = silence();
  try {
    const res = await handler(new Request(`http://fn/candidate-directory${query}`, init));
    return { status: res.status, body: await res.json() };
  } finally {
    restore();
  }
}

Deno.test("candidate-directory: unauthenticated → 401 before any database access", async () => {
  const get = await call({ method: "GET" }, `?organizationId=${ORG}`);
  assertEquals([get.status, get.body.error.code], [401, "UNAUTHORIZED"]);
  const put = await call({
    method: "PUT",
    body: JSON.stringify({ organizationId: ORG, candidateRef: "CF-0123456789", blocked: true }),
  });
  assertEquals([put.status, put.body.error.code], [401, "UNAUTHORIZED"]);
});

Deno.test("candidate-directory has no POST/PATCH/DELETE", async () => {
  for (const method of ["POST", "PATCH", "DELETE"]) {
    assertEquals((await call({ method })).status, 405);
  }
});

Deno.test(
  "CFD01/CFD02 are 409 with the stable reason, in DIRECTORY_CONFLICTS order, without the DB message",
  () => {
    const reasons = ["CFD01", "CFD02"].map((code) => {
      const error = fromDatabaseError({ code, message: "internal detail" });
      assertEquals([error.status, error.code], [409, "CONFLICT"]);
      assertEquals(error.message.includes("internal"), false);
      return error.reason;
    });
    assertEquals(reasons, [...DIRECTORY_CONFLICTS]);
    assertEquals(fromDatabaseError({ code: "CFD03" }).code, "INTERNAL_ERROR");
  },
);

Deno.test(
  "the query admits only the seven v1.8 filters, a page and the blocked switch — never an identity",
  () => {
    const ok = (q: Record<string, unknown>) => {
      try {
        parseValue({ organizationId: ORG, ...q }, directorySearchQuery);
        return true;
      } catch {
        return false;
      }
    };
    assertEquals(ok({}), true);
    assertEquals(
      ok({
        category: "B1.1",
        aircraft: "A320 Family",
        englishLevel: "B2",
        minYears: "5",
        country: "ES",
        base: "Madrid",
        from: today,
        to: plusDays(30),
        blocked: "1",
        page: "2",
      }),
      true,
    );
    const rejected: Record<string, unknown>[] = [
      { userId: ORG },
      { profileId: ORG },
      { role: "admin" },
      { q: "x" },
      { category: "B9" },
      { aircraft: "Concorde" },
      { englishLevel: "D1" },
      { minYears: "61" },
      { minYears: "-1" },
      { minYears: "five" },
      { country: "UK" },
      { base: "x".repeat(81) },
      { from: today }, // half a window
      { to: plusDays(3) },
      { from: plusDays(3), to: today }, // reversed
      { from: today, to: plusDays(366) }, // longer than a year
      { from: plusDays(-1), to: plusDays(3) }, // in the past
      { from: "2026/11/01", to: "2026/11/02" },
      { blocked: "yes" },
      { page: "0" },
      { page: "501" },
      { page: "1.5" },
    ];
    for (const bad of rejected) assertEquals(ok(bad), false, JSON.stringify(bad));
    assertEquals(ok({ from: today, to: plusDays(365) }), true);
    assertEquals(ok({ minYears: "0" }), true);
  },
);

Deno.test("the block body is strict: organization, the organization's ref and the state", () => {
  const ok = (body: unknown) => {
    try {
      parseValue(body, directoryBlockInput);
      return true;
    } catch {
      return false;
    }
  };
  assertEquals(ok({ organizationId: ORG, candidateRef: "CF-0123456789", blocked: true }), true);
  assertEquals(ok({ organizationId: ORG, candidateRef: "CF-ABCDEF0123", blocked: false }), true);
  for (const bad of [
    { organizationId: ORG, candidateRef: "cf-0123456789", blocked: true },
    { organizationId: ORG, candidateRef: "CF-012345678", blocked: true },
    { organizationId: ORG, candidateRef: ORG, blocked: true }, // an id is not a ref
    { organizationId: ORG, candidateRef: "CF-0123456789", blocked: "true" },
    { organizationId: ORG, candidateRef: "CF-0123456789" },
    { organizationId: ORG, candidateRef: "CF-0123456789", blocked: true, profileId: ORG },
  ]) {
    assertEquals(ok(bad), false, JSON.stringify(bad));
  }
});

const row = {
  candidate_ref: "CF-0123456789",
  candidate_display_name: null,
  candidate_base_location: "Madrid (MAD)",
  candidate_years_experience: 12,
  candidate_declarations: {
    primaryCategory: "B1.1",
    categories: ["B1.1", "B2"],
    aircraft: ["A320 Family"],
    engines: [],
    skills: [],
    englishLevel: "C1",
    mobility: "international",
    workPermits: ["ES", "PT"],
    typeRatings: [],
    hasRestrictions: false,
  },
  total: 23,
};

Deno.test("a row maps to the contract and an unexpected shape fails loudly", () => {
  assertEquals(toDirectoryCandidate(row), {
    ref: "CF-0123456789",
    displayName: null,
    baseLocation: "Madrid (MAD)",
    yearsExperience: 12,
    declarations: {
      primaryCategory: "B1.1",
      categories: ["B1.1", "B2"],
      aircraft: ["A320 Family"],
      engines: [],
      skills: [],
      englishLevel: "C1",
      mobility: "international",
      workPermits: ["PT", "ES"], // catalog order (EU_COUNTRIES), whatever order the row has
      typeRatings: [],
      hasRestrictions: false,
    },
  });
  assertThrows(() => toDirectoryCandidate({ ...row, candidate_declarations: null }));
  assertThrows(() => toDirectoryCandidate({ ...row, total: -1 }));
});

Deno.test(
  "the response carries the page, the fixed page size and the rows' total (0 when the page is empty)",
  () => {
    const full = toSearchResponse([row, { ...row, candidate_ref: "CF-9876543210" }], 2, false);
    assertEquals(
      [full.total, full.page, full.pageSize, full.blocked, full.candidates.length],
      [23, 2, 20, false, 2],
    );
    const empty = toSearchResponse([], 1, true);
    assertEquals([empty.total, empty.candidates.length, empty.blocked], [0, 0, true]);
  },
);
