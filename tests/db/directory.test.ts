// Package directory (migration 20261024700000; v2-22 / v2-23 «Buscar candidatos»; BUSINESS_RULES BR-28,
// T-150…T-158). Who may search, whom an organization may find (parity with ranked_external_pool on randomized
// profiles; «Red visible» counts the same set), what a row carries, every filter with a negative case, the
// no-grant surface and the per-organization throttle. The organization-side block is not ported (tag
// `parked/directory-employer-block`): nothing here writes. Every case runs inside a rolled-back transaction
// (harness `asUser`).
import { createHash } from "node:crypto";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, orgIdByName, requirementIdByTitle, SEED } from "./harness";
import { DIRECTORY_CONFLICTS, DIRECTORY_REF_PATTERN } from "../../src/domain/directory";
import { candidateDeclarationsRow, toDeclarations } from "../../src/lib/candidate-pool";

const MAD_REQUIREMENT = "B1.1 · A320 line maintenance reinforcement";
const FOXTROT = "00000000-0000-4000-8000-000000000023";
const GOLF = "00000000-0000-4000-8000-000000000024";
const INDIA = "00000000-0000-4000-8000-000000000026";

let db: PGlite;
let mroId: string;
let lisbonId: string;
let madRequirementId: string;
let b11: string;

beforeAll(async () => {
  db = await createTestDatabase();
  mroId = await orgIdByName(db, "Demo MRO Madrid");
  lisbonId = await orgIdByName(db, "Demo Aero Services Lisbon");
  madRequirementId = await requirementIdByTitle(db, MAD_REQUIREMENT);
  b11 = (
    await db.query<{ id: string }>("select id from public.qualification_types where code = 'B1.1'")
  ).rows[0]!.id;
});

afterAll(async () => {
  await db.close();
});

async function actAs(tx: Transaction, userId: string | null) {
  await tx.exec("reset role");
  await tx.query("select set_config('request.jwt.claims', $1, true)", [
    userId ? JSON.stringify({ sub: userId, role: "authenticated" }) : "",
  ]);
  await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
}
const asOwner = (tx: Transaction) => tx.exec("reset role");

async function sqlError(tx: Transaction, sql: string, params: unknown[] = []) {
  await tx.exec("savepoint expected_error");
  try {
    await tx.query(sql, params);
  } catch (error) {
    await tx.exec("rollback to savepoint expected_error");
    return (error as { code?: string }).code;
  }
  throw new Error(`expected statement to fail: ${sql}`);
}

const conflict = (reason: (typeof DIRECTORY_CONFLICTS)[number]) =>
  `CFD${String(DIRECTORY_CONFLICTS.indexOf(reason) + 1).padStart(2, "0")}`;

interface Filters {
  category?: string | null;
  aircraft?: string | null;
  english?: string | null;
  minYears?: number | null;
  country?: string | null;
  base?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
  offset?: number;
}
interface Row {
  candidate_ref: string;
  candidate_display_name: string | null;
  candidate_base_location: string | null;
  candidate_years_experience: number | null;
  candidate_declarations: unknown;
  total: number;
}
const SEARCH =
  "select * from public.search_candidate_directory($1, $2, $3, $4, $5, $6, $7, $8::date, $9::date, $10, $11)";
const searchParams = (org: string, f: Filters = {}) => [
  org,
  f.category ?? null,
  f.aircraft ?? null,
  f.english ?? null,
  f.minYears ?? null,
  f.country ?? null,
  f.base ?? null,
  f.from ?? null,
  f.to ?? null,
  f.limit ?? 20,
  f.offset ?? 0,
];

/** Runs the search as `userId` for `org` and returns its rows. */
async function search(tx: Transaction, userId: string, org: string, f: Filters = {}) {
  await actAs(tx, userId);
  return (await tx.query<Row>(SEARCH, searchParams(org, f))).rows;
}
async function searchError(tx: Transaction, userId: string | null, org: string, f: Filters = {}) {
  await actAs(tx, userId);
  return sqlError(tx, SEARCH, searchParams(org, f));
}

/** Every page of the search (limit 20, the database's bound), as `userId`. */
async function searchAll(tx: Transaction, userId: string, org: string, f: Filters = {}) {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 20) {
    const page = await search(tx, userId, org, { ...f, limit: 20, offset });
    rows.push(...page);
    if (page.length < 20) return rows;
  }
}

/** Owner side: the organization's pseudonym of one professional (what the directory shows). */
async function refOf(tx: Transaction, org: string, profile: string) {
  await asOwner(tx);
  const { rows } = await tx.query<{ ref: string }>(
    "select app_private.directory_ref($1, $2) as ref",
    [org, profile],
  );
  return rows[0]!.ref;
}

const DAY = 86_400_000;
const midnight = (days: number) => Math.floor(Date.now() / DAY) * DAY + days * DAY;
/** `YYYY-MM-DD`, `days` from today (UTC). */
const day = (days: number) => new Date(midnight(days)).toISOString().slice(0, 10);
const refs = (rows: Row[]) => rows.map((r) => r.candidate_ref);

/** Owner side: a whole-day window for a professional. */
async function addWindow(
  tx: Transaction,
  profile: string,
  fromDay: number,
  toDayExclusive: number,
  status: "available" | "unavailable" | "aog_only" = "available",
) {
  await asOwner(tx);
  await tx.query(
    `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
     values ($1, $2, $3, $4)`,
    [
      profile,
      new Date(midnight(fromDay)).toISOString(),
      new Date(midnight(toDayExclusive)).toISOString(),
      status,
    ],
  );
}

describe("search_candidate_directory — who may search (S-10)", () => {
  it("an admin or manager of the organization gets rows; a plain member, another organization, a professional, a platform admin and anon get 42501", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const asAdmin = await search(tx, SEED.adminMro, mroId);
      const asManager = await search(tx, SEED.managerMro, mroId);
      expect(asAdmin.length).toBeGreaterThan(0);
      expect(refs(asAdmin)).toEqual(refs(asManager));
      for (const ref of refs(asAdmin)) expect(ref).toMatch(DIRECTORY_REF_PATTERN);
      for (const user of [
        SEED.charlieMember,
        SEED.adminOther,
        SEED.delta,
        SEED.platformAdmin,
        null,
      ]) {
        expect(await searchError(tx, user, mroId), String(user)).toBe("42501");
      }
      // Lisbon's admin searches Lisbon, not Demo MRO.
      expect((await search(tx, SEED.adminOther, lisbonId)).length).toBeGreaterThan(0);
    });
  });

  it("the salt, the throttle table and the private helpers (visible, ref, throttle) have no API path (no grant) — admin, platform admin, professional and anon alike", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const probes: [string, unknown[]][] = [
        ["select * from app_private.directory_settings", []],
        ["select * from app_private.directory_search_events", []],
        ["insert into app_private.directory_search_events (organization_id) values ($1)", [mroId]],
        ["select * from app_private.directory_visible($1)", [mroId]],
        ["select app_private.directory_ref($1, $2)", [mroId, SEED.delta]],
        ["select app_private.directory_throttle($1)", [mroId]],
      ];
      for (const user of [SEED.adminMro, SEED.platformAdmin, SEED.delta, null]) {
        await actAs(tx, user);
        for (const [sql, params] of probes) {
          expect(await sqlError(tx, sql, params), `${String(user)}: ${sql}`).toBe("42501");
        }
      }
      // The parked employer block left nothing behind: no table, no RPC.
      await asOwner(tx);
      const { rows: leftovers } = await tx.query<{ n: number }>(
        `select (select count(*) from pg_tables where tablename = 'organization_candidate_blocks')::int
              + (select count(*) from pg_proc where proname = 'set_directory_block')::int as n`,
      );
      expect(leftovers[0]!.n).toBe(0);
    });
  });
});

describe("whom the organization may find (S-7 without a requirement)", () => {
  it("never a private profile, never a member; the total counts exactly the visible set", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      await asOwner(tx);
      // A member who is `open` is still internal, never in the directory.
      await tx.query(
        "update public.technician_profiles set visibility = 'open' where profile_id = $1",
        [SEED.alpha],
      );
      const hotel = await refOf(tx, mroId, SEED.hotelPrivate);
      const alpha = await refOf(tx, mroId, SEED.alpha);
      const rows = await searchAll(tx, SEED.adminMro, mroId);
      expect(refs(rows)).not.toContain(hotel);
      expect(refs(rows)).not.toContain(alpha);
      expect(refs(rows)).toContain(await refOf(tx, mroId, SEED.delta));
      await asOwner(tx);
      const { rows: visible } = await tx.query<{ n: number }>(
        "select count(*)::int as n from app_private.directory_visible($1)",
        [mroId],
      );
      expect(rows.length).toBe(visible[0]!.n);
      expect(new Set(rows.map((r) => r.total))).toEqual(new Set([visible[0]!.n]));
      // «Red visible» (shell-visual T-146) is the same definition: it counts exactly the rows the directory lists.
      await actAs(tx, SEED.adminMro);
      const { rows: network } = await tx.query<{ n: number }>(
        "select public.count_visible_network($1) as n",
        [mroId],
      );
      expect(network[0]!.n).toBe(rows.length);
    });
  });

  it("`verified_orgs` only for a reviewed organization (BR-8)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      await asOwner(tx);
      await tx.query(
        "update public.technician_profiles set visibility = 'verified_orgs' where profile_id = $1",
        [INDIA],
      );
      const india = await refOf(tx, mroId, INDIA);
      expect(refs(await searchAll(tx, SEED.adminMro, mroId))).not.toContain(india);
      await asOwner(tx);
      await tx.query(
        "update public.organizations set review_status = 'reviewed', reviewed_at = now() where id = $1",
        [mroId],
      );
      expect(refs(await searchAll(tx, SEED.adminMro, mroId))).toContain(india);
    });
  });

  it("never someone who blocked the organization (N-08), who stays visible to another one", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      await asOwner(tx);
      await tx.query(
        "insert into public.technician_organization_blocks (technician_profile_id, organization_id) values ($1, $2)",
        [SEED.delta, mroId],
      );
      expect(refs(await searchAll(tx, SEED.adminMro, mroId))).not.toContain(
        await refOf(tx, mroId, SEED.delta),
      );
      expect(refs(await searchAll(tx, SEED.adminOther, lisbonId))).toContain(
        await refOf(tx, lisbonId, SEED.delta),
      );
    });
  });

  it("pseudonyms (T-151): stable for the organization, different per organization and from the per-requirement ref, not computable without the salt", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const first = await refOf(tx, mroId, SEED.delta);
      expect(first).toMatch(DIRECTORY_REF_PATTERN);
      expect(await refOf(tx, mroId, SEED.delta)).toBe(first);
      expect(await refOf(tx, lisbonId, SEED.delta)).not.toBe(first);
      const perRequirement =
        "CF-" +
        createHash("sha256")
          .update(`${madRequirementId}:${SEED.delta}`)
          .digest("hex")
          .slice(0, 10)
          .toUpperCase();
      expect(first).not.toBe(perRequirement);
      const unsalted =
        "CF-" +
        createHash("sha256")
          .update(`${mroId}:${SEED.delta}`)
          .digest("hex")
          .slice(0, 10)
          .toUpperCase();
      expect(first).not.toBe(unsalted);
      // Two searches agree on the ref (the UI pages and opens by it).
      const a = refs(await searchAll(tx, SEED.adminMro, mroId));
      const b = refs(await searchAll(tx, SEED.managerMro, mroId));
      expect(a).toEqual(b);
      expect(a).toContain(first);
    });
  });

  it("a professional who turns `open` → `anonymous` keeps the same ref and loses the name", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const echoRef = await refOf(tx, mroId, SEED.echo);
      const before = (await searchAll(tx, SEED.adminMro, mroId)).find(
        (r) => r.candidate_ref === echoRef,
      )!;
      expect(before.candidate_display_name).toBe("Technician Echo");
      await asOwner(tx);
      await tx.query(
        "update public.technician_profiles set visibility = 'anonymous' where profile_id = $1",
        [SEED.echo],
      );
      const after = (await searchAll(tx, SEED.adminMro, mroId)).find(
        (r) => r.candidate_ref === echoRef,
      )!;
      expect(after).toBeDefined();
      expect(after.candidate_display_name).toBeNull();
      expect(after.candidate_base_location).toBe(before.candidate_base_location);
    });
  });

  it("a row carries the name only for `open`, and the passport card minimised (T-153): no engines, capabilities, ratings, restriction text, qualifications, contact or rate", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const rows = await searchAll(tx, SEED.adminMro, mroId);
      const delta = rows.find((r) => r.candidate_base_location === "Barcelona (BCN)")!;
      const echo = rows.find((r) => r.candidate_display_name === "Technician Echo")!;
      expect(delta.candidate_display_name).toBeNull(); // anonymous
      expect(delta.candidate_years_experience).toBe(12);
      const d = toDeclarations(candidateDeclarationsRow.parse(delta.candidate_declarations));
      // Delta declares engines, capabilities and a type rating in the seed: none of it travels.
      expect(d.engines).toEqual([]);
      expect(d.skills).toEqual([]);
      expect(d.typeRatings).toEqual([]);
      expect(d.categories).toEqual(["B1.1", "B2"]);
      expect(d.aircraft).toEqual(["A320 Family", "B737 NG"]);
      expect(d.englishLevel).toBe("C1");
      expect(d.workPermits).toEqual(["FR", "PT", "ES"]);
      expect(typeof d.hasRestrictions).toBe("boolean");
      expect(Object.keys(delta.candidate_declarations as object).sort()).toEqual(
        [
          "aircraft",
          "categories",
          "engines",
          "englishLevel",
          "hasRestrictions",
          "mobility",
          "primaryCategory",
          "skills",
          "typeRatings",
          "workPermits",
        ].sort(),
      );
      // Echo (open) is named; their restricted rating is a flag only.
      expect(echo.candidate_display_name).toBe("Technician Echo");
      const e = toDeclarations(candidateDeclarationsRow.parse(echo.candidate_declarations));
      expect(e.hasRestrictions).toBe(true);
      expect(JSON.stringify(echo.candidate_declarations)).not.toMatch(/run-ups/);
      // The row shape itself: nothing else (no id, e-mail, phone, employer, rate, documents).
      expect(Object.keys(delta).sort()).toEqual([
        "candidate_base_location",
        "candidate_declarations",
        "candidate_display_name",
        "candidate_ref",
        "candidate_years_experience",
        "total",
      ]);
    });
  });
});

describe("filters (v1.8 «Más filtros», T-154), each with a negative case", () => {
  const has = async (tx: Transaction, profile: string, f: Filters) =>
    refs(await searchAll(tx, SEED.adminMro, mroId, f)).includes(await refOf(tx, mroId, profile));

  it("category: a declared category (BR-3.8)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      expect(await has(tx, SEED.delta, { category: "B2" })).toBe(true);
      expect(await has(tx, SEED.echo, { category: "B2" })).toBe(false);
      expect(await has(tx, SEED.delta, { category: "NDT" })).toBe(false);
    });
  });

  it("aircraft: a declared aircraft (BR-3.9)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      expect(await has(tx, SEED.delta, { aircraft: "B737 NG" })).toBe(true);
      expect(await has(tx, SEED.echo, { aircraft: "B737 NG" })).toBe(false);
      expect(await has(tx, SEED.echo, { aircraft: "A320 Family" })).toBe(true);
    });
  });

  it("English minimum: CEFR order; no declared level never meets a minimum", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      expect(await has(tx, SEED.delta, { english: "C1" })).toBe(true);
      expect(await has(tx, SEED.echo, { english: "C1" })).toBe(false); // B1
      expect(await has(tx, SEED.echo, { english: "B1" })).toBe(true);
      expect(await has(tx, GOLF, { english: "A1" })).toBe(false); // nothing declared
      expect(await has(tx, GOLF, {})).toBe(true);
    });
  });

  it("minimum years: declared experience, undeclared counts as 0 (BR-3.12)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      expect(await has(tx, SEED.delta, { minYears: 12 })).toBe(true);
      expect(await has(tx, SEED.echo, { minYears: 12 })).toBe(false); // 6
      await asOwner(tx);
      await tx.query(
        "update public.technician_profiles set years_experience = null where profile_id = $1",
        [GOLF],
      );
      expect(await has(tx, GOLF, { minYears: 0 })).toBe(true);
      expect(await has(tx, GOLF, { minYears: 1 })).toBe(false);
    });
  });

  it("country: a declared work permit (BR-3.7, T-34)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      expect(await has(tx, SEED.delta, { country: "FR" })).toBe(true);
      expect(await has(tx, FOXTROT, { country: "FR" })).toBe(false); // PT, ES
      expect(await has(tx, FOXTROT, { country: "PT" })).toBe(true);
    });
  });

  it("base: a case-insensitive substring of the declared base; wildcards are literal", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      expect(await has(tx, SEED.delta, { base: "barcelona" })).toBe(true);
      expect(await has(tx, SEED.delta, { base: "lisboa" })).toBe(false);
      expect(await has(tx, FOXTROT, { base: "LIS" })).toBe(true);
      expect(await searchAll(tx, SEED.adminMro, mroId, { base: "%" })).toEqual([]);
      expect(await searchAll(tx, SEED.adminMro, mroId, { base: "_" })).toEqual([]);
    });
  });

  it("availability window: every day published as available (BR-4 as a planned need): `unavailable` and `aog_only` block, a partial window fails", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      await addWindow(tx, SEED.delta, 10, 21); // days 10…20 available
      await addWindow(tx, SEED.echo, 10, 21, "aog_only");
      await addWindow(tx, FOXTROT, 10, 21);
      await addWindow(tx, FOXTROT, 15, 16, "unavailable"); // one day off in the middle
      const window = { from: day(11), to: day(15) };
      expect(await has(tx, SEED.delta, window)).toBe(true);
      expect(await has(tx, SEED.echo, window)).toBe(false);
      expect(await has(tx, FOXTROT, window)).toBe(false);
      expect(await has(tx, FOXTROT, { from: day(11), to: day(14) })).toBe(true);
      expect(await has(tx, SEED.delta, { from: day(15), to: day(25) })).toBe(false); // ends day 20
      expect(await has(tx, SEED.delta, { from: day(10), to: day(20) })).toBe(true); // exact fit
      expect(await has(tx, SEED.delta, { from: day(10), to: day(21) })).toBe(false); // one day more
      expect(await has(tx, GOLF, window)).toBe(false); // no window at all
    });
  });

  it("filters combine (AND) and the total follows the filtered set", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const rows = await searchAll(tx, SEED.adminMro, mroId, {
        category: "B1.1",
        aircraft: "A320 Family",
        country: "ES",
        english: "B1",
      });
      expect(rows.length).toBeGreaterThan(0);
      expect(new Set(rows.map((r) => r.total))).toEqual(new Set([rows.length]));
      expect(
        refs(await searchAll(tx, SEED.adminMro, mroId, { category: "B2", country: "PT" })),
      ).toEqual([await refOf(tx, mroId, SEED.delta)]);
    });
  });

  it("pagination: 20 by default, pages are disjoint and share the total", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const first = await search(tx, SEED.adminMro, mroId, { limit: 2, offset: 0 });
      const second = await search(tx, SEED.adminMro, mroId, { limit: 2, offset: 2 });
      expect(first.length).toBe(2);
      expect(refs(first)).not.toEqual(expect.arrayContaining(refs(second)));
      expect(first[0]!.total).toBe(second[0]!.total);
      // Declared experience first, then the ref.
      const all = await searchAll(tx, SEED.adminMro, mroId);
      const years = all.map((r) => r.candidate_years_experience ?? -1);
      expect(years).toEqual([...years].sort((a, b) => b - a));
      await actAs(tx, SEED.adminMro);
      const { rows } = await tx.query<Row>("select * from public.search_candidate_directory($1)", [
        mroId,
      ]);
      expect(rows.length).toBeLessThanOrEqual(20);
    });
  });

  it("out-of-domain filters are 22023: half a window, reversed, longer than a year, in the past; bounds of English, years, base, limit and offset", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const bad: Filters[] = [
        { from: day(1) },
        { to: day(1) },
        { from: day(5), to: day(4) },
        { from: day(1), to: day(367) },
        { from: day(-1), to: day(3) },
        { english: "Z9" },
        { english: "" },
        { minYears: 61 },
        { minYears: -1 },
        { base: "x".repeat(81) },
        { limit: 0 },
        { limit: 21 },
        { offset: -1 },
        { offset: 10001 },
      ];
      for (const f of bad)
        expect(await searchError(tx, SEED.adminMro, mroId, f), JSON.stringify(f)).toBe("22023");
      // The boundaries themselves are fine.
      expect(await search(tx, SEED.adminMro, mroId, { from: day(0), to: day(365) })).toBeDefined();
      expect(
        await search(tx, SEED.adminMro, mroId, { minYears: 0, limit: 20, offset: 10000 }),
      ).toEqual([]);
    });
  });
});

describe("parity with ranked_external_pool (S-7) on randomized profiles", () => {
  it("directory set = pool set; directory with the need's rules and window = the pool's hard-eligible set; count_viable_candidates agrees (150 profiles, with and without the review)", async () => {
    let seed = 20261024;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
    const subset = <T>(xs: readonly T[], p: number) => xs.filter(() => rnd() < p);
    const ids = Array.from(
      { length: 150 },
      (_, i) => `00000000-0000-4000-9700-${String(i).padStart(12, "0")}`,
    );
    await asUser(db, SEED.adminMro, async (tx) => {
      await asOwner(tx);
      await tx.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         select id, 'dir-' || id || '@crewflex.test', '{"account_type":"professional","display_name":"Parity"}'
         from unnest($1::uuid[]) id`,
        [ids],
      );
      for (const id of ids) {
        await tx.query(
          `update public.technician_profiles set visibility = $2::public.profile_visibility,
             categories = $3, aircraft = $4, work_permits = $5, years_experience = $6, english_level = $7,
             base_location = $8
           where profile_id = $1`,
          [
            id,
            pick(["anonymous", "open", "private", "verified_orgs", "anonymous"] as const),
            subset(["B1.1", "B2", "CAT-A"], 0.6),
            subset(["A320 Family", "B737 NG", "ATR 72"], 0.5),
            subset(["ES", "PT", "FR"], 0.6),
            pick([null, 0, 4, 5, 6, 12]),
            pick([null, "B1", "B2", "C1"]),
            pick(["Madrid (MAD)", "Lisboa (LIS)", null]),
          ],
        );
        // Everyone holds the need's hard type, active and verified, no expiry: the pool's «≥ 1 required
        // qualification» holds for all and `hard_eligible` reduces to availability ∧ profile rules.
        await tx.query(
          `insert into public.technician_qualifications
             (technician_profile_id, qualification_type_id, status, verification_status, expires_at)
           values ($1, $2, 'active', 'verified', $3)`,
          [id, b11, day(400)],
        );
        if (rnd() < 0.15)
          await tx.query(
            "insert into public.technician_organization_blocks (technician_profile_id, organization_id) values ($1, $2)",
            [id, mroId],
          );
        if (rnd() < 0.1)
          await tx.query(
            "insert into public.organization_members (organization_id, profile_id, role) values ($1, $2, 'member')",
            [mroId, id],
          );
        // Availability around the need (days 10…13): full, partial, none, or blocked by a day off.
        const mode = rnd();
        if (mode < 0.4) await addWindow(tx, id, 9, 15);
        else if (mode < 0.55) await addWindow(tx, id, 11, 15);
        else if (mode < 0.7) {
          await addWindow(tx, id, 9, 15);
          await addWindow(tx, id, 12, 13, pick(["unavailable", "aog_only"] as const));
        }
      }
      // The need: Demo MRO, hard B1.1, days 10…13 (ends day 14 at 00:00Z), one aircraft so the directory's
      // single-aircraft filter states the same rule.
      const { rows: need } = await tx.query<{ id: string }>(
        `insert into public.work_requirements
           (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by,
            country, category, aircraft, min_years)
         values ($1, 'directory parity', 'Madrid (MAD)', $2, $3, 'day', 1, 'planned', 'open', $4,
                 'ES', 'B1.1', '{A320 Family}', 5)
         returning id`,
        [
          mroId,
          new Date(midnight(10)).toISOString(),
          new Date(midnight(14)).toISOString(),
          SEED.adminMro,
        ],
      );
      const needId = need[0]!.id;
      await tx.query(
        `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
         values ($1, $2, 'hard')`,
        [needId, b11],
      );

      for (const reviewed of [false, true]) {
        await asOwner(tx);
        await tx.query(
          "update public.organizations set review_status = $2, reviewed_at = $3 where id = $1",
          [mroId, reviewed ? "reviewed" : "pending", reviewed ? new Date().toISOString() : null],
        );
        const { rows: byRef } = await tx.query<{ profile_id: string; ref: string }>(
          "select profile_id, app_private.directory_ref($1, profile_id) as ref from public.technician_profiles",
          [mroId],
        );
        const idOf = new Map(byRef.map((r) => [r.ref, r.profile_id]));
        const { rows: pool } = await tx.query<{ profile_id: string; hard_eligible: boolean }>(
          "select profile_id, hard_eligible from app_private.ranked_external_pool($1)",
          [needId],
        );
        const poolSet = new Set(pool.map((p) => p.profile_id));
        const eligibleSet = new Set(pool.filter((p) => p.hard_eligible).map((p) => p.profile_id));
        expect(poolSet.size).toBeGreaterThan(20);
        expect(eligibleSet.size).toBeGreaterThan(3);
        expect(eligibleSet.size).toBeLessThan(poolSet.size);

        const inIds = (id: string) => ids.includes(id);
        const all = refs(await searchAll(tx, SEED.managerMro, mroId)).map((r) => idOf.get(r)!);
        expect(new Set(all.filter(inIds))).toEqual(new Set([...poolSet].filter(inIds)));
        // Over every profile (seed included) the directory is the pool plus exactly the visible professionals
        // who hold no active qualification of the need's types — the one predicate a requirement adds.
        for (const id of poolSet) expect(all).toContain(id);
        await asOwner(tx);
        const { rows: unqualified } = await tx.query<{ profile_id: string }>(
          `select v.profile_id from app_private.directory_visible($1) v
           where not exists (select 1 from public.technician_qualifications tq
                             where tq.technician_profile_id = v.profile_id and tq.status = 'active'
                               and tq.qualification_type_id = $2)`,
          [mroId, b11],
        );
        expect(new Set(all.filter((id) => !poolSet.has(id)))).toEqual(
          new Set(unqualified.map((r) => r.profile_id)),
        );

        const eligible = refs(
          await searchAll(tx, SEED.managerMro, mroId, {
            country: "ES",
            category: "B1.1",
            aircraft: "A320 Family",
            minYears: 5,
            from: day(10),
            to: day(13),
          }),
        ).map((r) => idOf.get(r)!);
        expect(new Set(eligible.filter(inIds))).toEqual(new Set([...eligibleSet].filter(inIds)));
        for (const id of eligibleSet) expect(eligible).toContain(id);

        // The builder's live count (country only) = eligible members + the pool's hard-eligible rows for the
        // same single rule.
        await asOwner(tx);
        await tx.query(
          "update public.work_requirements set category = null, aircraft = '{}', min_years = null where id = $1",
          [needId],
        );
        const { rows: pool2 } = await tx.query<{ n: number }>(
          "select count(*)::int as n from app_private.ranked_external_pool($1) where hard_eligible",
          [needId],
        );
        const { rows: internal } = await tx.query<{ n: number }>(
          `select count(*)::int as n from public.organization_members m
           cross join lateral app_private.hard_eligibility_for($2, $3, 'planned', array[$4]::uuid[], m.profile_id, 'ES') e
           where m.organization_id = $1 and e.qualifications_ok and e.availability_ok and e.profile_ok`,
          [mroId, new Date(midnight(10)).toISOString(), new Date(midnight(14)).toISOString(), b11],
        );
        await actAs(tx, SEED.managerMro);
        const { rows: count } = await tx.query<{ n: number }>(
          "select public.count_viable_candidates($1, $2, $3, 'planned', array[$4]::uuid[], 'ES') as n",
          [mroId, new Date(midnight(10)).toISOString(), new Date(midnight(14)).toISOString(), b11],
        );
        expect(count[0]!.n).toBe(pool2[0]!.n + internal[0]!.n);
        await asOwner(tx);
        await tx.query(
          "update public.work_requirements set category = 'B1.1', aircraft = '{A320 Family}', min_years = 5 where id = $1",
          [needId],
        );
      }
    });
  });
});

describe("throttle (T-157): 60 searches per organization per minute", () => {
  it("the 61st search of the organization is CFD01 for any of its managers, another organization is unaffected, a minute later the slot is free, hour-old rows are pruned", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      await asOwner(tx);
      await tx.query(
        "insert into app_private.directory_search_events (organization_id, created_at) values ($1, now() - interval '2 hours')",
        [mroId],
      );
      for (let i = 0; i < 60; i++) await search(tx, SEED.adminMro, mroId, { limit: 1 });
      const limited = conflict("DIRECTORY_RATE_LIMITED");
      expect(await searchError(tx, SEED.adminMro, mroId, { limit: 1 })).toBe(limited);
      expect(await searchError(tx, SEED.managerMro, mroId, { limit: 1 })).toBe(limited);
      expect((await search(tx, SEED.adminOther, lisbonId, { limit: 1 })).length).toBeGreaterThan(0);
      await asOwner(tx);
      const { rows: events } = await tx.query<{ n: number; old: number }>(
        `select count(*)::int as n, count(*) filter (where created_at < now() - interval '1 hour')::int as old
         from app_private.directory_search_events where organization_id = $1`,
        [mroId],
      );
      expect(events[0]).toEqual({ n: 60, old: 0 }); // the refused attempts left no row; the old one is gone
      await tx.query(
        "update app_private.directory_search_events set created_at = created_at - interval '2 minutes' where organization_id = $1",
        [mroId],
      );
      expect((await search(tx, SEED.adminMro, mroId, { limit: 1 })).length).toBeGreaterThan(0);
    });
  });

  it("the throttle rows follow the organization (cascade)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      await asOwner(tx);
      const { rows: org } = await tx.query<{ id: string }>(
        "insert into public.organizations (name, type, country) values ('Directory cascade', 'other', 'ES') returning id",
      );
      await tx.query(
        "insert into app_private.directory_search_events (organization_id) values ($1)",
        [org[0]!.id],
      );
      await tx.query("delete from public.organizations where id = $1", [org[0]!.id]);
      expect(
        (
          await tx.query(
            "select 1 from app_private.directory_search_events where organization_id = $1",
            [org[0]!.id],
          )
        ).rows,
      ).toHaveLength(0);
    });
  });
});
