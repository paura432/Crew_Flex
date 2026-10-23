// v1.8 profile requirements in matching (package matching-v18; BR-3.7–3.13, BR-5.6, T-80…T-87), migrations
// 20261023900000 / 900100 / 900200. The verdict is src/domain/matching.ts `evaluateMatch`; every SQL mirror
// (hard_eligibility / hard_eligibility_for, ranked_external_pool, count_viable_candidates, the applications
// trigger) must agree with it. Every case runs inside a rolled-back transaction (harness `asUser`).
import { createHash, randomUUID } from "node:crypto";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, orgIdByName, requirementIdByTitle, SEED } from "./harness";
import { APPLICATION_CONFLICTS } from "../../src/domain/applications";
import { evaluateMatch, type MatchableRequirement } from "../../src/domain/matching";
import { AIRCRAFT, ENGINES, PROFESSIONAL_CATEGORIES, SKILLS } from "../../src/domain/passport";
import type { EuCountry } from "../../src/domain/organization";
import { toCandidate, toProfileRules } from "../../src/lib/candidate-pool";

let db: PGlite;
let mroId: string;
let b11: string;
let a320: string;
let sms: string;

beforeAll(async () => {
  db = await createTestDatabase();
  mroId = await orgIdByName(db, "Demo MRO Madrid");
  const types = await db.query<{ id: string; code: string }>(
    "select id, code from public.qualification_types where code in ('B1.1', 'TR-A320', 'SMS')",
  );
  const id = (code: string) => types.rows.find((r) => r.code === code)!.id;
  b11 = id("B1.1");
  a320 = id("TR-A320");
  sms = id("SMS");
});

async function actAs(tx: Transaction, userId: string | null) {
  await tx.exec("reset role");
  await tx.query("select set_config('request.jwt.claims', $1, true)", [
    userId ? JSON.stringify({ sub: userId, role: "authenticated" }) : "",
  ]);
  await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
}

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

const conflict = (reason: (typeof APPLICATION_CONFLICTS)[number]) =>
  `CFA${String(APPLICATION_CONFLICTS.indexOf(reason) + 1).padStart(2, "0")}`;

const ref = (requirementId: string, profileId: string) =>
  "CF-" +
  createHash("sha256")
    .update(`${requirementId}:${profileId}`)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();

const DAY = 86_400_000;
const midnight = (days: number) => Math.floor(Date.now() / DAY) * DAY + days * DAY;
/** `YYYY-MM-DD`, `days` from today (UTC). */
const day = (days: number) => new Date(midnight(days)).toISOString().slice(0, 10);

interface Rules {
  country: EuCountry | null;
  category: string | null;
  aircraft: string[];
  requires_type_rating: boolean;
  engines: string[];
  min_years: number | null;
  required_skills: string[];
}
const NO_RULES: Rules = {
  country: null,
  category: null,
  aircraft: [],
  requires_type_rating: false,
  engines: [],
  min_years: null,
  required_skills: [],
};

/**
 * Owner-side fixture: an open Demo MRO requirement with hard B1.1 + TR-A320 and soft SMS, from day +10 at
 * 20:00Z to day +14 at 00:00Z exactly — its last UTC day is +13 (BR-2, endsAt − 1 ms).
 */
async function createNeed(
  tx: Transaction,
  rules: Partial<Rules> = {},
  title = "matching-v18",
  status = "open",
) {
  await tx.exec("reset role");
  const r = { ...NO_RULES, ...rules };
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.work_requirements
       (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by,
        country, category, aircraft, requires_type_rating, engines, min_years, required_skills)
     values ($1, $2, 'Madrid (MAD)', $3, $4, 'night', 1, 'planned', $13, $5,
             $6, $7, $8, $9, $10, $11, $12)
     returning id`,
    [
      mroId,
      title,
      new Date(midnight(10) + 20 * 3_600_000).toISOString(),
      new Date(midnight(14)).toISOString(),
      SEED.adminMro,
      r.country,
      r.category,
      r.aircraft,
      r.requires_type_rating,
      r.engines,
      r.min_years,
      r.required_skills,
      status,
    ],
  );
  const id = rows[0]!.id;
  await tx.query(
    `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
     values ($1, $2, 'hard'), ($1, $3, 'hard'), ($1, $4, 'soft')`,
    [id, b11, a320, sms],
  );
  return id;
}

async function setRules(tx: Transaction, id: string, rules: Partial<Rules>) {
  await tx.exec("reset role");
  const r = { ...NO_RULES, ...rules };
  await tx.query(
    `update public.work_requirements set country = $2, category = $3, aircraft = $4, requires_type_rating = $5,
       engines = $6, min_years = $7, required_skills = $8 where id = $1`,
    [
      id,
      r.country,
      r.category,
      r.aircraft,
      r.requires_type_rating,
      r.engines,
      r.min_years,
      r.required_skills,
    ],
  );
}

/** The requirement as the Edge Functions read it (row parser of the shared code). */
async function tsRequirement(tx: Transaction, id: string): Promise<MatchableRequirement> {
  await tx.exec("reset role");
  const { rows } = await tx.query<
    Rules & { starts_at: Date; ends_at: Date; urgency: "planned" | "urgent" | "aog" }
  >(
    `select starts_at, ends_at, urgency, country, category, aircraft, requires_type_rating, engines,
            min_years, required_skills from public.work_requirements where id = $1`,
    [id],
  );
  const row = rows[0]!;
  const quals = await tx.query<{ id: string; code: string; level: "hard" | "soft" }>(
    `select qt.id, qt.code, wrq.requirement_level as level from public.work_requirement_qualifications wrq
     join public.qualification_types qt on qt.id = wrq.qualification_type_id where wrq.work_requirement_id = $1`,
    [id],
  );
  return {
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    urgency: row.urgency,
    location: "Madrid (MAD)",
    qualifications: quals.rows.map((q) => ({
      qualificationTypeId: q.id,
      code: q.code,
      name: q.code,
      level: q.level,
    })),
    country: row.country,
    ...toProfileRules(row as Parameters<typeof toProfileRules>[0]),
  };
}

/** Owner-side: availability around now for the given professionals (their seed windows are October). */
async function makeAvailable(tx: Transaction, profiles: string[]) {
  await tx.exec("reset role");
  await tx.query(
    `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
     select p, now() - interval '30 days', now() + interval '120 days', 'available' from unnest($1::uuid[]) p`,
    [profiles],
  );
}

describe("work_requirements profile-rule columns (20261023900000)", () => {
  async function rawError(tx: Transaction, set: string, params: unknown[] = []) {
    const id = await createNeed(tx);
    await tx.exec("savepoint s");
    try {
      await tx.query(`update public.work_requirements set ${set} where id = $1`, [id, ...params]);
      await tx.exec("rollback to savepoint s");
      return "ok";
    } catch (error) {
      await tx.exec("rollback to savepoint s");
      return (error as { code?: string }).code;
    }
  }

  it("every seed requirement states no profile rule (their documented outcomes stay)", async () => {
    const { rows } = await db.query<{ title: string; rules: boolean }>(
      `select title, (category is not null or cardinality(aircraft) > 0 or requires_type_rating
                      or cardinality(engines) > 0 or min_years is not null or cardinality(required_skills) > 0
                      or country is not null) as rules
       from public.work_requirements order by title`,
    );
    expect(rows.filter((r) => r.rules).map((r) => r.title)).toEqual([
      "B1.1 · A320 / B737 NG line check (v1.8 profile rules)",
    ]);
  });

  it("the CHECKs accept exactly the domain catalogs", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      for (const c of PROFESSIONAL_CATEGORIES)
        expect(await rawError(tx, "category = $2", [c]), c).toBe("ok");
      for (const c of ["B9", "", "b1.1"])
        expect(await rawError(tx, "category = $2", [c]), c).toBe("23514");
      expect(await rawError(tx, "aircraft = $2", [[...AIRCRAFT]])).toBe("ok");
      expect(await rawError(tx, "aircraft = $2", [["Concorde"]])).toBe("23514");
      expect(await rawError(tx, "engines = $2", [[...ENGINES]])).toBe("ok");
      expect(await rawError(tx, "engines = $2", [["RB211"]])).toBe("23514");
      expect(await rawError(tx, "required_skills = $2", [[...SKILLS]])).toBe("ok");
      expect(await rawError(tx, "required_skills = $2", [["juggling"]])).toBe("23514");
      for (const [years, code] of [
        [0, "ok"],
        [60, "ok"],
        [-1, "23514"],
        [61, "23514"],
      ] as const)
        expect(await rawError(tx, "min_years = $2", [years]), String(years)).toBe(code);
    });
  });

  it("a type rating is asked for a licence category on at least one aircraft (T-83)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const rating = "requires_type_rating = true, category = $2, aircraft = $3";
      expect(await rawError(tx, rating, ["B1.1", ["A320 Family"]])).toBe("ok");
      expect(await rawError(tx, rating, ["CAT-C", ["Cessna 172", "Piper PA-28"]])).toBe("ok");
      expect(await rawError(tx, rating, ["MECHANIC", ["A320 Family"]])).toBe("23514");
      expect(await rawError(tx, rating, ["B1.1", []])).toBe("23514");
      expect(await rawError(tx, rating, [null, ["A320 Family"]])).toBe("23514");
    });
  });

  it("no API role can write them directly (no grant)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const id = await createNeed(tx);
      await actAs(tx, SEED.adminMro);
      expect(
        await sqlError(tx, "update public.work_requirements set min_years = 3 where id = $1", [id]),
      ).toBe("42501");
    });
  });

  it("frozen with the rest of the requirement: after an application (CFA12) and once closed (55000)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const id = await createNeed(tx);
      await tx.query(
        "insert into public.applications (requirement_id, technician_profile_id) values ($1, $2)",
        [id, SEED.delta],
      );
      for (const set of [
        "category = 'B2'",
        "aircraft = '{B737 NG}'",
        "min_years = 3",
        "engines = '{GE90}'",
        "required_skills = '{ndt}'",
      ])
        expect(
          await sqlError(tx, `update public.work_requirements set ${set} where id = $1`, [id]),
          set,
        ).toBe(conflict("HAS_APPLICATIONS"));
      const closed = await createNeed(tx, {}, "matching-v18 closed");
      await tx.query("update public.work_requirements set status = 'closed' where id = $1", [
        closed,
      ]);
      expect(
        await sqlError(tx, "update public.work_requirements set min_years = 1 where id = $1", [
          closed,
        ]),
      ).toBe("55000");
    });
  });
});

describe("SQL ↔ TypeScript parity on the v1.8 profile requirements (BR-3.7–3.13)", () => {
  // Rule variants of one requirement: every rule alone and together, none (the old verdict), min 0.
  const VARIANTS: Partial<Rules>[] = [
    {},
    {
      country: "ES",
      category: "B1.1",
      aircraft: ["A320 Family", "B737 NG"],
      requires_type_rating: true,
      min_years: 5,
      required_skills: ["line_maintenance"],
    },
    {
      country: "PT",
      category: "B2",
      aircraft: ["ATR 72"],
      engines: ["PW127", "LEAP-1A"],
      required_skills: ["borescope", "ndt"],
    },
    { min_years: 0 },
    { category: "B2", aircraft: ["B737 NG"], requires_type_rating: true, min_years: 12 },
    { country: "FR", engines: ["CFM56-5B/7B"] },
  ];

  it("hard_eligibility = evaluateMatch().eligible (own data and pool rows) = ranked_external_pool = count_viable_candidates (180 randomized profiles × 6 rule sets)", async () => {
    let seed = 20261023;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
    const subset = <T>(xs: readonly T[], p: number) => xs.filter(() => rnd() < p);
    const ids = Array.from(
      { length: 180 },
      (_, i) => `00000000-0000-4000-9800-${String(i).padStart(12, "0")}`,
    );
    // Rating validity around the last UTC day (+13): before the start, the day before, the day, after.
    const expiries = [null, day(5), day(12), day(13), day(14)];
    await asUser(db, SEED.managerMro, async (tx) => {
      await tx.exec("reset role");
      const need = await createNeed(tx);
      await tx.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         select id, 'v18-' || id || '@crewflex.test', '{"account_type":"professional","display_name":"Parity"}'
         from unnest($1::uuid[]) id`,
        [ids],
      );
      // A third of the profiles are near misses of variant 1, a sixth of variant 2 (everything met, then
      // half of them break ONE thing: the rating's restriction or validity boundary, a permit, the
      // category, the aircraft, the years, a capability), the rest fully random.
      type Profile = {
        categories: string[];
        aircraft: string[];
        engines: string[];
        skills: string[];
        permits: string[];
        years: number | null;
        ratings: {
          aircraft: string;
          category: string;
          expires: string | null;
          restricted: boolean;
        }[];
      };
      const randomProfile = (): Profile => ({
        categories: subset(["B1.1", "B2", "CAT-A"], 0.6),
        aircraft: subset(["A320 Family", "B737 NG", "ATR 72"], 0.5),
        engines: subset(["CFM56-5B/7B", "LEAP-1A", "PW127"], 0.4),
        skills: subset(["line_maintenance", "borescope", "ndt"], 0.6),
        permits: subset(["ES", "PT", "FR"], 0.6),
        years: pick([null, 0, 4, 5, 6, 12]),
        ratings: Array.from({ length: Math.floor(rnd() * 3) }, () => ({
          aircraft: pick(["A320 Family", "B737 NG", "ATR 72"]),
          category: pick(["B1.1", "B2"]),
          expires: pick(expiries),
          restricted: rnd() < 0.3,
        })),
      });
      const nearV1 = (): Profile => ({
        categories: ["B1.1", ...subset(["B2"], 0.3)],
        aircraft: [pick(["A320 Family", "B737 NG"]), ...subset(["ATR 72"], 0.3)],
        engines: subset(["CFM56-5B/7B"], 0.5),
        skills: ["line_maintenance", ...subset(["ndt"], 0.3)],
        permits: ["ES", ...subset(["PT"], 0.3)],
        years: pick([5, 6, 12]),
        ratings: [
          {
            aircraft: pick(["A320 Family", "B737 NG"]),
            category: "B1.1",
            expires: pick(expiries),
            restricted: rnd() < 0.4,
          },
        ],
      });
      const nearV2 = (): Profile => ({
        categories: ["B2", ...subset(["B1.1"], 0.3)],
        aircraft: ["ATR 72"],
        engines: [pick(["PW127", "LEAP-1A"])],
        skills: ["borescope", "ndt"],
        permits: ["PT"],
        years: pick([null, 4, 12]),
        ratings: [],
      });
      const breakOne = (p: Profile): Profile => {
        switch (pick(["permit", "category", "aircraft", "years", "skill", "engine"] as const)) {
          case "permit":
            return { ...p, permits: p.permits.filter((c) => c !== "ES" && c !== "PT") };
          case "category":
            return { ...p, categories: ["CAT-A"] };
          case "aircraft":
            return { ...p, aircraft: [] };
          case "years":
            return { ...p, years: pick([null, 4]) };
          case "skill":
            return { ...p, skills: p.skills.slice(1) };
          case "engine":
            return { ...p, engines: [] };
        }
      };
      for (const id of ids) {
        const mode = rnd();
        let profile = mode < 1 / 3 ? nearV1() : mode < 0.5 ? nearV2() : randomProfile();
        if (mode < 0.5 && rnd() < 0.5) profile = breakOne(profile);
        await tx.query(
          `update public.technician_profiles set visibility = $2::public.profile_visibility,
             categories = $3, aircraft = $4, engines = $5, skills = $6, work_permits = $7,
             years_experience = $8, english_level = $9, mobility = $10::public.mobility
           where profile_id = $1`,
          [
            id,
            pick(["anonymous", "open", "private", "anonymous"] as const),
            profile.categories,
            profile.aircraft,
            profile.engines,
            profile.skills,
            profile.permits,
            profile.years,
            pick([null, "B1", "B2", "C1"]),
            pick(["local", "national", "international"]),
          ],
        );
        const seen = new Set<string>();
        for (const r of profile.ratings) {
          if (seen.has(r.aircraft + r.category)) continue;
          seen.add(r.aircraft + r.category);
          await tx.query(
            `insert into public.technician_type_ratings
               (technician_profile_id, aircraft, category, expires_at, restrictions) values ($1, $2, $3, $4, $5)`,
            [id, r.aircraft, r.category, r.expires, r.restricted ? "Synthetic restriction" : null],
          );
        }
        // Hard qualifications valid 90 % of the time (a pending one otherwise); availability 90 %.
        for (const type of [b11, a320])
          await tx.query(
            `insert into public.technician_qualifications
               (technician_profile_id, qualification_type_id, expires_at, verification_status)
             values ($1, $2, date '2031-01-01', $3)`,
            [id, type, rnd() < 0.9 ? "verified" : "pending"],
          );
        if (rnd() < 0.9) await makeAvailable(tx, [id]);
      }

      const own = new Map<string, ReturnType<typeof toCandidate>>();
      for (const id of ids) {
        await actAs(tx, id);
        const { rows } = await tx.query("select * from public.own_candidate_profile()");
        own.set(id, toCandidate(rows[0]));
      }

      let eligibleSeen = 0;
      let profileOnlyBlocked = 0;
      let poolCompared = 0;
      for (const variant of VARIANTS) {
        await setRules(tx, need, variant);
        const requirement = await tsRequirement(tx, need);
        const sql = new Map(
          (
            await tx.query<{ p: string; q: boolean; a: boolean; pr: boolean }>(
              `select p, h.qualifications_ok as q, h.availability_ok as a, h.profile_ok as pr
               from unnest($1::uuid[]) p cross join lateral app_private.hard_eligibility($2, p) h`,
              [ids, need],
            )
          ).rows.map((r) => [r.p, r]),
        );
        const ranked = new Map(
          (
            await tx.query<{ profile_id: string; hard_eligible: boolean }>(
              "select profile_id, hard_eligible from app_private.ranked_external_pool($1)",
              [need],
            )
          ).rows.map((r) => [r.profile_id, r.hard_eligible]),
        );
        const label = JSON.stringify(variant);
        for (const id of ids) {
          const h = sql.get(id)!;
          const ok = h.q && h.a && h.pr;
          const match = evaluateMatch(requirement, own.get(id)!);
          expect([label, id, ok]).toEqual([label, id, match.eligible]);
          if (ranked.has(id)) expect([label, id, ranked.get(id)]).toEqual([label, id, ok]);
          if (ok) eligibleSeen++;
          if (h.q && h.a && !h.pr) profileOnlyBlocked++;
        }

        // The organization's rows (pseudonym, filtered declarations) give the same verdict.
        await actAs(tx, SEED.managerMro);
        const pool = await tx.query("select * from public.get_requirement_candidate_pool($1)", [
          need,
        ]);
        const byRef = new Map(ids.map((id) => [ref(need, id), id]));
        for (const row of pool.rows) {
          const candidate = toCandidate(row);
          const id = byRef.get(candidate.id);
          if (!id) continue;
          const h = sql.get(id)!;
          expect([label, id, evaluateMatch(requirement, candidate).eligible]).toEqual([
            label,
            id,
            h.q && h.a && h.pr,
          ]);
          poolCompared++;
        }

        // The builder's live count knows the job's country only (MEDIUM-1): it must equal the members and
        // the pool's candidates passing the hard filters with that single rule.
        await tx.exec("reset role");
        const r = { ...NO_RULES, ...variant };
        const truth = (
          await tx.query<{ n: number }>(
            `with people as (
               select m.profile_id from public.organization_members m where m.organization_id = $2
               union
               select r.profile_id from app_private.ranked_external_pool($1) r)
             select count(*)::int as n from people p
             cross join lateral app_private.hard_eligibility_for($3, $4, 'planned', $5::uuid[], p.profile_id, $6) e
             where e.qualifications_ok and e.availability_ok and e.profile_ok`,
            [need, mroId, requirement.startsAt, requirement.endsAt, [b11, a320], r.country],
          )
        ).rows[0]!.n;
        await actAs(tx, SEED.managerMro);
        const counted = (
          await tx.query<{ n: number }>(
            `select public.count_viable_candidates($1, $2, $3, 'planned', $4::uuid[], p_country => $5) as n`,
            [mroId, requirement.startsAt, requirement.endsAt, [b11, a320], r.country],
          )
        ).rows[0]!.n;
        expect([label, counted]).toEqual([label, truth]);
      }
      expect(eligibleSeen).toBeGreaterThan(60); // the sample exercises both outcomes
      expect(profileOnlyBlocked).toBeGreaterThan(200); // …and the profile rules alone decide often
      expect(poolCompared).toBeGreaterThan(300);
    });
  }, 180_000);

  it("50 / 100 / 101 / 500 candidates: eligible ones are never cut by the cap; counts and order stable", async () => {
    const rules: Partial<Rules> = {
      country: "ES",
      category: "B1.1",
      aircraft: ["A320 Family", "B737 NG"],
      requires_type_rating: true,
      min_years: 5,
      required_skills: ["line_maintenance"],
    };
    // Each failing half misses exactly one profile rule (qualifications and availability are fine).
    const breakOne = [
      "work_permits = '{PT}'",
      "categories = '{B2}'",
      "aircraft = '{ATR 72}'",
      "years_experience = 4",
      "skills = '{ndt}'",
    ];
    for (const [n, block] of [
      [50, 1],
      [100, 2],
      [101, 3],
      [500, 4],
    ] as const) {
      await asUser(db, SEED.managerMro, async (tx) => {
        const need = await createNeed(tx, rules);
        const summary = async () => {
          await actAs(tx, SEED.managerMro);
          const s = await tx.query<{ prefiltered: number; hard_eligible: number; cap: number }>(
            "select * from public.get_requirement_external_pool_summary($1)",
            [need],
          );
          const pool = await tx.query<{ candidate_ref: string; candidate_pool: string }>(
            "select candidate_ref, candidate_pool from public.get_requirement_candidate_pool($1)",
            [need],
          );
          return {
            ...s.rows[0]!,
            external: pool.rows
              .filter((r) => r.candidate_pool === "external")
              .map((r) => r.candidate_ref),
          };
        };
        const baseline = await summary();
        await tx.exec("reset role");
        const ids = Array.from(
          { length: n },
          (_, i) =>
            `00000000-0000-4000-99${String(block).padStart(2, "0")}-${String(i).padStart(12, "0")}`,
        );
        await tx.query(
          `insert into auth.users (id, email, raw_user_meta_data)
           select id, 'cap-' || id || '@crewflex.test', '{"account_type":"professional","display_name":"Cap"}'
           from unnest($1::uuid[]) id`,
          [ids],
        );
        await tx.query(
          `update public.technician_profiles set visibility = 'anonymous', categories = '{B1.1}',
             aircraft = '{A320 Family}', work_permits = '{ES}', years_experience = 8,
             skills = '{line_maintenance}'
           where profile_id = any($1::uuid[])`,
          [ids],
        );
        await tx.query(
          `insert into public.technician_type_ratings (technician_profile_id, aircraft, category)
           select p, 'A320 Family', 'B1.1' from unnest($1::uuid[]) p`,
          [ids],
        );
        await tx.query(
          `insert into public.technician_qualifications
             (technician_profile_id, qualification_type_id, expires_at, verification_status)
           select p, t, date '2031-01-01', 'verified' from unnest($1::uuid[]) p, unnest($2::uuid[]) t`,
          [ids, [b11, a320]],
        );
        await makeAvailable(tx, ids);
        const half = Math.floor(n / 2);
        for (const [i, id] of ids.slice(half).entries())
          await tx.query(
            `update public.technician_profiles set ${breakOne[i % breakOne.length]} where profile_id = $1`,
            [id],
          );

        const first = await summary();
        const second = await summary();
        expect(first.prefiltered).toBe(baseline.prefiltered + n);
        expect(first.hard_eligible).toBe(baseline.hard_eligible + half);
        expect(first.cap).toBe(100);
        expect(first.external).toHaveLength(Math.min(100, baseline.prefiltered + n));
        expect(second.external).toEqual(first.external); // deterministic
        if (first.hard_eligible <= 100)
          for (const id of ids.slice(0, half)) expect(first.external).toContain(ref(need, id));
        else {
          const eligibleRefs = new Set(ids.slice(0, half).map((id) => ref(need, id)));
          expect(first.external.every((r) => eligibleRefs.has(r))).toBe(true);
        }
      });
    }
  }, 180_000);
});

describe("apply and confirm re-check the profile rules (trigger applications_profile_rules)", () => {
  const RULES: Partial<Rules> = {
    country: "ES",
    category: "B1.1",
    aircraft: ["A320 Family", "B737 NG"],
    requires_type_rating: true,
    min_years: 5,
    required_skills: ["line_maintenance"],
  };
  const TRANSITION = "select * from public.transition_application($1, $2, $3, $4, $5, $6)";

  async function apply(tx: Transaction, technician: string, need: string) {
    await actAs(tx, technician);
    return tx.query<{ id: string }>("select * from public.apply_to_requirement($1, $2, true)", [
      need,
      randomUUID(),
    ]);
  }
  async function transitionArgs(tx: Transaction, id: string, to: string, proposalId?: string) {
    await tx.exec("reset role");
    const { rows } = await tx.query<{ updated_at: Date }>(
      "select updated_at from public.applications where id = $1",
      [id],
    );
    return [id, to, rows[0]!.updated_at.toISOString(), randomUUID(), null, proposalId ?? null];
  }
  async function step(tx: Transaction, actor: string, id: string, to: string, proposal?: string) {
    const args = await transitionArgs(tx, id, to, proposal);
    await actAs(tx, actor);
    return (await tx.query<{ proposal_id: string | null; status: string }>(TRANSITION, args))
      .rows[0]!;
  }
  async function toAccepted(tx: Transaction, technician: string, id: string) {
    await step(tx, SEED.managerMro, id, "shortlisted");
    const proposed = await step(tx, SEED.managerMro, id, "proposed");
    await step(tx, technician, id, "accepted", proposed.proposal_id!);
  }
  async function confirmError(tx: Transaction, id: string) {
    const args = await transitionArgs(tx, id, "confirmed");
    await actAs(tx, SEED.managerMro);
    return sqlError(tx, TRANSITION, args);
  }

  it("Delta (every rule met) applies and is confirmed; Echo (restricted rating) is refused with CFA14", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, RULES);
      await makeAvailable(tx, [SEED.delta, SEED.echo]);
      await tx.query(
        "update public.technician_profiles set skills = '{line_maintenance}' where profile_id = $1",
        [SEED.echo],
      );
      await actAs(tx, SEED.echo);
      expect(
        await sqlError(tx, "select * from public.apply_to_requirement($1, $2, true)", [
          need,
          randomUUID(),
        ]),
      ).toBe(conflict("PROFILE_REQUIREMENTS_UNMET"));
      // The qualification check of the RPC still comes first (CFA03).
      await tx.exec("reset role");
      await tx.query(
        "update public.technician_qualifications set status = 'withdrawn' where technician_profile_id = $1",
        [SEED.echo],
      );
      await actAs(tx, SEED.echo);
      expect(
        await sqlError(tx, "select * from public.apply_to_requirement($1, $2, true)", [
          need,
          randomUUID(),
        ]),
      ).toBe(conflict("QUALIFICATION_INVALID"));

      const { rows } = await apply(tx, SEED.delta, need);
      await toAccepted(tx, SEED.delta, rows[0]!.id);
      expect((await step(tx, SEED.managerMro, rows[0]!.id, "confirmed")).status).toBe("confirmed");
    });
  });

  it("a declaration that changes after acceptance is caught at confirmation (CFA14), and the seat stays free", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, RULES);
      await makeAvailable(tx, [SEED.delta]);
      const { rows } = await apply(tx, SEED.delta, need);
      await toAccepted(tx, SEED.delta, rows[0]!.id);
      await tx.exec("reset role");
      await tx.query(
        "update public.technician_profiles set work_permits = '{PT}' where profile_id = $1",
        [SEED.delta],
      );
      expect(await confirmError(tx, rows[0]!.id)).toBe(conflict("PROFILE_REQUIREMENTS_UNMET"));
      await tx.exec("reset role");
      const status = await tx.query<{ status: string }>(
        "select status from public.applications where id = $1",
        [rows[0]!.id],
      );
      expect(status.rows[0]!.status).toBe("accepted");
    });
  });

  it("general restrictions: applying is allowed, confirming is refused with CFA15 until they are removed (T-87)", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx); // no profile rule: only the restriction gate
      await makeAvailable(tx, [SEED.delta]);
      await tx.exec("reset role");
      await tx.query(
        "update public.technician_profiles set general_restrictions = 'Engine tasks under supervision' where profile_id = $1",
        [SEED.delta],
      );
      const { rows } = await apply(tx, SEED.delta, need);
      await toAccepted(tx, SEED.delta, rows[0]!.id);
      expect(await confirmError(tx, rows[0]!.id)).toBe(conflict("RESTRICTIONS_DECLARED"));
      await tx.exec("reset role");
      await tx.query(
        "update public.technician_profiles set general_restrictions = null where profile_id = $1",
        [SEED.delta],
      );
      expect((await step(tx, SEED.managerMro, rows[0]!.id, "confirmed")).status).toBe("confirmed");
    });
  });

  it("other status changes are not re-checked (withdrawing stays possible)", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, RULES);
      await makeAvailable(tx, [SEED.delta]);
      const { rows } = await apply(tx, SEED.delta, need);
      await tx.exec("reset role");
      await tx.query(
        "update public.technician_profiles set work_permits = '{}' where profile_id = $1",
        [SEED.delta],
      );
      expect((await step(tx, SEED.delta, rows[0]!.id, "withdrawn")).status).toBe("withdrawn");
    });
  });
});

describe("get_requirement_profile_rules (professionals' read of the requirement-side rules)", () => {
  const CALL = "select * from public.get_requirement_profile_rules($1::uuid[])";

  it("professionals only; published and current requirements, or ones they applied to", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const open = await createNeed(tx, { min_years: 3, engines: ["GE90"] }, "open one");
      const paused = await createNeed(tx, { min_years: 4 }, "paused one");
      const applied = await createNeed(tx, { min_years: 5 }, "applied one");
      await tx.query(
        "insert into public.applications (requirement_id, technician_profile_id) values ($1, $2)",
        [applied, SEED.delta],
      );
      await tx.query(
        "update public.work_requirements set status = 'paused' where id = any($1::uuid[])",
        [[paused, applied]],
      );
      const draft = await createNeed(tx, {}, "draft one", "draft");

      await actAs(tx, SEED.delta);
      const { rows } = await tx.query<{ requirement_id: string; min_years: number }>(CALL, [
        [open, paused, applied, draft, randomUUID()],
      ]);
      expect(rows.map((r) => r.requirement_id).sort()).toEqual([open, applied].sort());
      expect(Object.keys(rows[0]!).sort()).toEqual(
        [
          "aircraft",
          "category",
          "engines",
          "min_years",
          "required_skills",
          "requirement_id",
          "requires_type_rating",
        ].sort(),
      );
      await actAs(tx, SEED.echo); // never applied: the paused one is not readable
      const echo = await tx.query<{ requirement_id: string }>(CALL, [[paused, applied, open]]);
      expect(echo.rows.map((r) => r.requirement_id)).toEqual([open]);

      for (const user of [SEED.adminMro, SEED.adminOther]) {
        await actAs(tx, user); // organization accounts: no technician profile
        expect(await sqlError(tx, CALL, [[open]]), user).toBe("42501");
      }
      await actAs(tx, null);
      expect(await sqlError(tx, CALL, [[open]])).toBe("42501");
      await actAs(tx, SEED.delta);
      expect(await sqlError(tx, CALL, [Array.from({ length: 201 }, () => randomUUID())])).toBe(
        "22023",
      );
      expect(await sqlError(tx, "select * from public.get_requirement_profile_rules(null)")).toBe(
        "22023",
      );
    });
  });
});

describe("candidate rows carry the declarations, minimised for organizations", () => {
  it("the pool row: only the asked engines, capabilities and type ratings; never restriction text", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      const need = await createNeed(tx, {
        category: "B1.1",
        aircraft: ["A320 Family"],
        requires_type_rating: true,
        required_skills: ["line_maintenance", "ndt"],
      });
      await makeAvailable(tx, [SEED.delta, SEED.echo]);
      await tx.query(
        "update public.technician_profiles set general_restrictions = 'Secret general text' where profile_id = $1",
        [SEED.echo],
      );
      await actAs(tx, SEED.managerMro);
      const { rows } = await tx.query<{ candidate_ref: string; candidate_declarations: unknown }>(
        "select candidate_ref, candidate_declarations from public.get_requirement_candidate_pool($1)",
        [need],
      );
      const delta = rows.find((r) => r.candidate_ref === ref(need, SEED.delta))!;
      expect(delta.candidate_declarations).toEqual({
        primaryCategory: "B1.1",
        categories: ["B1.1", "B2"],
        aircraft: ["A320 Family", "B737 NG"],
        engines: [], // CFM56 declared, not asked
        skills: ["line_maintenance"], // aog_support declared, not asked
        englishLevel: "C1",
        mobility: "international",
        workPermits: ["PT", "ES", "FR"],
        typeRatings: [
          { aircraft: "A320 Family", category: "B1.1", expiresAt: null, restricted: false },
        ],
        hasRestrictions: false,
      });
      const echo = rows.find((r) => r.candidate_ref === ref(need, SEED.echo))!;
      expect(echo.candidate_declarations).toMatchObject({
        typeRatings: [
          { aircraft: "A320 Family", category: "B1.1", expiresAt: null, restricted: true },
        ],
        hasRestrictions: true,
      });
      const text = JSON.stringify(rows);
      expect(text).not.toContain("No engine run-ups");
      expect(text).not.toContain("Secret general text");
    });
  });

  it("own_candidate_profile returns the own declarations in full", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      await actAs(tx, SEED.delta);
      const { rows } = await tx.query<{ candidate_declarations: Record<string, unknown> }>(
        "select candidate_declarations from public.own_candidate_profile()",
      );
      expect(rows[0]!.candidate_declarations).toMatchObject({
        engines: ["CFM56-5B/7B"],
        skills: ["line_maintenance", "aog_support"],
        typeRatings: [
          { aircraft: "A320 Family", category: "B1.1", expiresAt: null, restricted: false },
        ],
      });
    });
  });

  it("an applicant's row (get_requirement_applications) has the same minimised declarations", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      const need = await createNeed(tx, { engines: ["CFM56-5B/7B", "LEAP-1A"] });
      await tx.query(
        "insert into public.applications (requirement_id, technician_profile_id) values ($1, $2)",
        [need, SEED.delta],
      );
      await actAs(tx, SEED.managerMro);
      const { rows } = await tx.query<{ candidate_declarations: Record<string, unknown> }>(
        "select candidate_declarations from public.get_requirement_applications($1)",
        [need],
      );
      expect(rows[0]!.candidate_declarations).toMatchObject({
        engines: ["CFM56-5B/7B"], // the asked one Delta declares
        skills: [],
        typeRatings: [],
        workPermits: ["PT", "ES", "FR"],
      });
    });
  });

  it("the organization-wide «Candidaturas» rows carry the same declarations and the requirement's rules (20261024100900)", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      const need = await createNeed(tx, { engines: ["CFM56-5B/7B"], min_years: 7 });
      await tx.query(
        "insert into public.applications (requirement_id, technician_profile_id) values ($1, $2)",
        [need, SEED.delta],
      );
      await actAs(tx, SEED.managerMro);
      const { rows } = await tx.query<Record<string, unknown>>(
        "select * from public.get_organization_applications($1, $2)",
        [mroId, need],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        category: null,
        aircraft: [],
        requires_type_rating: false,
        engines: ["CFM56-5B/7B"],
        min_years: 7,
        required_skills: [],
        candidate_declarations: { engines: ["CFM56-5B/7B"], skills: [], typeRatings: [] },
      });
      // The engine judges the row exactly as get_requirement_applications' row.
      const requirement = await tsRequirement(tx, need);
      await actAs(tx, SEED.managerMro);
      const single = await tx.query("select * from public.get_requirement_applications($1)", [
        need,
      ]);
      expect(evaluateMatch(requirement, toCandidate(rows[0])).blockers).toEqual(
        evaluateMatch(requirement, toCandidate(single.rows[0])).blockers,
      );
      for (const user of [SEED.adminOther, SEED.delta, SEED.charlieMember]) {
        await actAs(tx, user);
        expect(
          await sqlError(tx, "select * from public.get_organization_applications($1)", [mroId]),
          user,
        ).toBe("42501");
      }
    });
  });
});

describe("privileges and minimisation of the package's functions (S-10, T-85)", () => {
  it("every function pins search_path; anon executes none; authenticated only the RPCs and the INVOKER declarations helper", async () => {
    const { rows } = await db.query<{
      name: string;
      definer: boolean;
      config: string[] | null;
      anon: boolean;
      authenticated: boolean;
    }>(
      `select p.oid::regprocedure::text as name, p.prosecdef as definer, p.proconfig as config,
              has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as authenticated
       from pg_proc p join pg_namespace s on s.oid = p.pronamespace
       where (s.nspname = 'public' and p.proname in ('count_viable_candidates', 'get_requirement_candidate_pool',
               'own_candidate_profile', 'get_requirement_applications', 'get_requirement_profile_rules',
               'get_organization_applications', 'guard_application_profile_rules', 'guard_closed_requirement',
               'guard_requirement_with_applications'))
          or (s.nspname = 'app_private' and p.proname in ('profile_rules_ok', 'candidate_declarations',
               'hard_eligibility', 'hard_eligibility_for'))`,
    );
    expect(rows).toHaveLength(13);
    for (const row of rows) {
      expect(row.config, row.name).toEqual(['search_path=""']);
      expect(row.anon, row.name).toBe(false);
    }
    const name = (r: { name: string }) => r.name.split("(")[0]!;
    expect(
      rows
        .filter((r) => r.authenticated)
        .map(name)
        .sort(),
    ).toEqual([
      "app_private.candidate_declarations",
      "count_viable_candidates",
      "get_organization_applications",
      "get_requirement_applications",
      "get_requirement_candidate_pool",
      "get_requirement_profile_rules",
      "own_candidate_profile",
    ]);
    expect(
      rows
        .filter((r) => !r.definer)
        .map(name)
        .sort(),
    ).toEqual([
      "app_private.candidate_declarations",
      "app_private.hard_eligibility",
      "app_private.hard_eligibility_for",
      "app_private.profile_rules_ok",
      "own_candidate_profile",
    ]);
    // MEDIUM-1: the live count takes the country and nothing else of the profile rules.
    const count = rows.find((r) => name(r) === "count_viable_candidates")!;
    expect(count.name).toBe(
      "count_viable_candidates(uuid,timestamp with time zone,timestamp with time zone,requirement_urgency,uuid[],text)",
    );
  });

  it("the live count refuses every other profile rule as a parameter (no reconstruction of one candidate's declarations)", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      const base = `$1, now() + interval '10 days', now() + interval '12 days', 'planned', $2::uuid[]`;
      for (const extra of [
        "p_min_years => 9",
        "p_engines => '{GE90}'::text[]",
        "p_required_skills => '{aog_support}'::text[]",
        "p_category => 'B1.1', p_aircraft => '{A320 Family}'::text[], p_requires_type_rating => true",
      ]) {
        expect(
          await sqlError(tx, `select public.count_viable_candidates(${base}, ${extra})`, [
            mroId,
            [b11],
          ]),
          extra,
        ).toBe("42883"); // undefined_function: no such signature
      }
      const { rows } = await tx.query<{ n: number }>(
        `select public.count_viable_candidates(${base}, p_country => 'ES') as n`,
        [mroId, [b11]],
      );
      expect(rows[0]!.n).toBeGreaterThanOrEqual(0);
    });
  });

  it("app_private.candidate_declarations called directly reads under RLS: someone else's profile is null", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      const own = await tx.query<{ d: unknown }>(
        "select app_private.candidate_declarations($1, null) as d",
        [SEED.managerMro],
      );
      expect(own.rows[0]!.d).not.toBeNull();
      // Delta is not a member of Demo MRO: the manager has no row to read.
      const other = await tx.query<{ d: unknown }>(
        "select app_private.candidate_declarations($1, null) as d",
        [SEED.delta],
      );
      expect(other.rows[0]!.d).toBeNull();
      await actAs(tx, SEED.delta);
      const peer = await tx.query<{ d: unknown }>(
        "select app_private.candidate_declarations($1, null) as d",
        [SEED.echo],
      );
      expect(peer.rows[0]!.d).toBeNull();
    });
  });
});

describe("seed scenario: «B1.1 · A320 / B737 NG line check (v1.8 profile rules)» (Demo Airline Ops Barcelona)", () => {
  it("Delta eligible; Echo restricted rating; Foxtrot without the rating; Golf below the minimum years", async () => {
    const id = await requirementIdByTitle(
      db,
      "B1.1 · A320 / B737 NG line check (v1.8 profile rules)",
    );
    await asUser(db, SEED.adminAirline, async (tx) => {
      const requirement = await tsRequirement(tx, id);
      await actAs(tx, SEED.adminAirline);
      const { rows } = await tx.query("select * from public.get_requirement_candidate_pool($1)", [
        id,
      ]);
      const byId = new Map(rows.map(toCandidate).map((c) => [c.id, c]));
      const codes = (profile: string) =>
        evaluateMatch(requirement, byId.get(ref(id, profile))!).blockers.map((b) => b.code);
      expect(codes(SEED.delta)).toEqual([]);
      expect(codes("00000000-0000-4000-8000-000000000022")).toEqual([
        "TYPE_RATING_RESTRICTED",
        "MISSING_SKILL",
      ]);
      expect(codes("00000000-0000-4000-8000-000000000023")).toEqual([
        "TYPE_RATING_MISSING",
        "MISSING_SKILL",
      ]);
      expect(codes("00000000-0000-4000-8000-000000000024")).toContain("INSUFFICIENT_EXPERIENCE");
      // The SQL mirror agrees: only Delta is hard-eligible.
      await tx.exec("reset role");
      const eligible = await tx.query<{ profile_id: string }>(
        "select profile_id from app_private.ranked_external_pool($1) where hard_eligible",
        [id],
      );
      expect(eligible.rows.map((r) => r.profile_id)).toEqual([SEED.delta]);
    });
  });
});
