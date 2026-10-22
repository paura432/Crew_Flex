// Package passport (N-01, N-02, N-05…N-08): v1.8 declarations, owner-only private data, blocks and
// the candidate-card declarations. Migrations 20261023100000…100300.
import { createHash } from "node:crypto";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  asUser,
  createTestDatabase,
  orgIdByName,
  queryError,
  requirementIdByTitle,
  SEED,
} from "./harness";
import {
  AIRCRAFT,
  ENGINES,
  EU_COUNTRIES,
  LICENCE_CATEGORIES,
  PROFESSIONAL_CATEGORIES,
  SKILLS,
} from "../../src/domain/passport";
import { toCandidatePassport } from "../../src/lib/candidate-pool";
import {
  passportPayload,
  updateProfessionalProfileInput,
  type ProfessionalPassportPayload,
} from "../../src/lib/validation/professional";

const MAD_REQUIREMENT = "B1.1 · A320 line maintenance reinforcement";

let db: PGlite;
let mroId: string;
let lisbonId: string;
let madRequirementId: string;

beforeAll(async () => {
  db = await createTestDatabase();
  mroId = await orgIdByName(db, "Demo MRO Madrid");
  lisbonId = await orgIdByName(db, "Demo Aero Services Lisbon");
  madRequirementId = await requirementIdByTitle(db, MAD_REQUIREMENT);
});

afterAll(async () => {
  await db.close();
});

/** A complete, valid passport for the seed professional named `name`. */
function passport(
  name: string,
  overrides: Partial<ProfessionalPassportPayload> = {},
): ProfessionalPassportPayload {
  return passportPayload(
    updateProfessionalProfileInput.parse({
      displayName: name,
      baseLocation: "Barcelona (BCN)",
      mobility: "international",
      yearsExperience: 12,
      currentStatus: "contractor",
      visibility: "anonymous",
      primaryCategory: "B1.1",
      categories: ["B1.1", "B2"],
      aircraft: ["A320 Family", "B737 NG"],
      engines: ["CFM56-5B/7B"],
      skills: ["line_maintenance", "borescope"],
      englishLevel: "B2",
      ownTools: true,
      baseCountry: "ES",
      workPermits: ["ES", "PT"],
      generalRestrictions: null,
      typeRatings: [
        { aircraft: "A320 Family", category: "B1.1", expiresAt: null, restrictions: null },
        {
          aircraft: "B737 NG",
          category: "B2",
          expiresAt: "2028-06-30",
          restrictions: "No CFM56 tasks",
        },
      ],
      phone: "+34 600 000 001",
      currentEmployerId: null,
      minRate: 45.5,
      rateUnit: "hour",
      blockedOrganizationIds: [],
      ...overrides,
    }),
  );
}

async function save(tx: Transaction, payload: unknown, expected: string | null = null) {
  const { rows } = await tx.query<{ v: string }>(
    "select public.save_professional_passport($1::jsonb, $2::timestamptz) as v",
    [JSON.stringify(payload), expected],
  );
  return rows[0]!.v;
}

const saveSql = "select public.save_professional_passport($1::jsonb, $2::timestamptz)";

/** Inside an `asUser` transaction: act as another signed-in user from here on (same transaction). */
async function switchTo(tx: Transaction, userId: string) {
  await tx.exec("reset role");
  await tx.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
  await tx.exec("set local role authenticated");
}

const pseudonym = (requirementId: string, profileId: string) =>
  "CF-" +
  createHash("sha256")
    .update(`${requirementId}:${profileId}`)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();

async function poolRefs(tx: Transaction, requirementId: string) {
  const { rows } = await tx.query<{ candidate_ref: string }>(
    "select candidate_ref from public.get_requirement_candidate_pool($1)",
    [requirementId],
  );
  return rows.map((r) => r.candidate_ref).sort();
}

describe("catalog (N-01, T-30)", () => {
  it("adds the v1.8 categories Next lacked, with the licence expiry rule", async () => {
    const { rows } = await db.query<{ code: string; category: string; requires_expiry: boolean }>(
      `select code, category, requires_expiry from public.qualification_types
       where code in ('B1.2', 'B1.4', 'B3', 'MECHANIC', 'SHEET-METAL', 'HELPER') order by code`,
    );
    expect(rows).toEqual([
      { code: "B1.2", category: "LICENSE", requires_expiry: true },
      { code: "B1.4", category: "LICENSE", requires_expiry: true },
      { code: "B3", category: "LICENSE", requires_expiry: true },
      { code: "HELPER", category: "SKILL", requires_expiry: false },
      { code: "MECHANIC", category: "SKILL", requires_expiry: false },
      { code: "SHEET-METAL", category: "SKILL", requires_expiry: false },
    ]);
  });

  it("the database CHECK lists accept exactly the domain catalogs", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      // Every catalog value at once is accepted (ratings: every aircraft × licence category is too many
      // for the 40 cap, so one per aircraft).
      await save(
        tx,
        passport("Technician Delta", {
          primaryCategory: "HELPER",
          categories: [...PROFESSIONAL_CATEGORIES],
          aircraft: [...AIRCRAFT],
          engines: [...ENGINES],
          skills: [...SKILLS],
          workPermits: [...EU_COUNTRIES],
          baseCountry: "SE",
          englishLevel: "C2",
          typeRatings: AIRCRAFT.map((aircraft, i) => ({
            aircraft,
            category: LICENCE_CATEGORIES[i % LICENCE_CATEGORIES.length]!,
            expiresAt: null,
            restrictions: null,
          })),
        }),
      );
      const { rows } = await tx.query<{ n: number }>(
        "select cardinality(categories) + cardinality(aircraft) + cardinality(engines) + cardinality(skills) + cardinality(work_permits) as n from public.technician_profiles where profile_id = $1",
        [SEED.delta],
      );
      expect(rows[0]!.n).toBe(12 + 12 + 7 + 9 + 27);
      // A value outside the catalog is refused by the CHECK even if the payload passes the key check.
      for (const [field, value] of [
        ["categories", ["B1.1", "B9"]],
        ["aircraft", ["A380"]],
        ["engines", ["CF6"]],
        ["skills", ["welding"]],
        ["workPermits", ["GB"]],
      ] as const) {
        const bad = { ...passport("Technician Delta"), [field]: value, typeRatings: [] };
        expect(await queryError(tx, saveSql, [JSON.stringify(bad), null]), field).toMatch(
          /check constraint/,
        );
      }
      for (const [field, value] of [
        ["baseCountry", "GB"],
        ["englishLevel", "D1"],
        ["rateUnit", "week"],
      ] as const) {
        const bad = { ...passport("Technician Delta"), [field]: value };
        expect(await queryError(tx, saveSql, [JSON.stringify(bad), null]), field).toMatch(
          /check constraint/,
        );
      }
    });
  });
});

describe("save_professional_passport (I-3 extended)", () => {
  it("saves every table of the passport in one call and moves the version", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const before = await tx.query<{ updated_at: string }>(
        "select updated_at from public.technician_profiles where profile_id = $1",
        [SEED.delta],
      );
      const version = await save(
        tx,
        passport("Technician Delta", {
          generalRestrictions: "  Engine tasks under supervision  ",
          blockedOrganizationIds: [lisbonId],
          currentEmployerId: mroId,
        }),
        before.rows[0]!.updated_at,
      );
      expect(version).toBeTruthy();
      const { rows } = await tx.query<Record<string, unknown>>(
        `select tp.primary_category, tp.categories, tp.aircraft, tp.english_level, tp.own_tools,
                tp.base_country, tp.work_permits, tp.general_restrictions, d.phone, d.min_rate::text,
                d.rate_unit, d.current_employer_id
         from public.technician_profiles tp
         join public.technician_private_details d on d.profile_id = tp.profile_id
         where tp.profile_id = $1`,
        [SEED.delta],
      );
      expect(rows[0]).toEqual({
        primary_category: "B1.1",
        categories: ["B1.1", "B2"],
        aircraft: ["A320 Family", "B737 NG"],
        english_level: "B2",
        own_tools: true,
        base_country: "ES",
        work_permits: ["PT", "ES"],
        general_restrictions: "Engine tasks under supervision",
        phone: "+34 600 000 001",
        min_rate: "45.50",
        rate_unit: "hour",
        current_employer_id: mroId,
      });
      const ratings = await tx.query<{ aircraft: string; category: string; restrictions: string }>(
        "select aircraft, category, restrictions from public.technician_type_ratings where technician_profile_id = $1 order by aircraft",
        [SEED.delta],
      );
      expect(ratings.rows).toEqual([
        { aircraft: "A320 Family", category: "B1.1", restrictions: null },
        { aircraft: "B737 NG", category: "B2", restrictions: "No CFM56 tasks" },
      ]);
      const blocks = await tx.query<{ organization_id: string }>(
        "select organization_id from public.technician_organization_blocks",
      );
      expect(blocks.rows).toEqual([{ organization_id: lisbonId }]);

      // A stale version writes nothing (CF412); the current one replaces lists, ratings and blocks.
      expect(
        await queryError(tx, saveSql, [
          JSON.stringify(passport("Stale write")),
          "2020-01-01T00:00:00Z",
        ]),
      ).toMatch(/modified by another session/);
      await save(
        tx,
        passport("Technician Delta", {
          categories: ["B1.1"],
          aircraft: ["A320 Family"],
          typeRatings: [
            {
              aircraft: "A320 Family",
              category: "B1.1",
              expiresAt: "2029-01-31",
              restrictions: null,
            },
          ],
        }),
        version,
      );
      const after = await tx.query<{ n: number; name: string }>(
        `select (select count(*)::int from public.technician_type_ratings) as n,
                (select display_name from public.profiles where id = $1) as name`,
        [SEED.delta],
      );
      expect(after.rows[0]).toEqual({ n: 1, name: "Technician Delta" });
      expect(
        (await tx.query("select 1 from public.technician_organization_blocks")).rows,
      ).toHaveLength(0);
    });
  });

  it("refuses what the CHECKs cannot see: keys, repeats, caps, undeclared ratings, blank primary", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const ok = passport("Technician Delta");
      const missingKey: Partial<ProfessionalPassportPayload> = { ...ok };
      delete missingKey.phone;
      const cases: [string, unknown, RegExp][] = [
        ["missing key", missingKey, /exactly its fields/],
        ["extra key", { ...ok, verificationStatus: "verified" }, /exactly its fields/],
        ["identity key", { ...ok, profileId: SEED.echo }, /exactly its fields/],
        ["repeat", { ...ok, aircraft: ["A320 Family", "A320 Family"] }, /repeats a value/],
        [
          "undeclared rating",
          {
            ...ok,
            typeRatings: [
              { aircraft: "A350", category: "B1.1", expiresAt: null, restrictions: null },
            ],
          },
          /declared aircraft and category/,
        ],
        [
          "rating twice",
          {
            ...ok,
            typeRatings: [ok.typeRatings[0], ok.typeRatings[0]],
          },
          /declared aircraft and category/,
        ],
        [
          "rating with an extra key",
          { ...ok, typeRatings: [{ ...ok.typeRatings[0], documentId: SEED.echo }] },
          /declared aircraft and category/,
        ],
        [
          "trade rating",
          {
            ...ok,
            categories: ["B1.1", "HELPER"],
            typeRatings: [
              { aircraft: "A320 Family", category: "HELPER", expiresAt: null, restrictions: null },
            ],
          },
          /check constraint/,
        ],
        ["primary not declared", { ...ok, primaryCategory: "B3" }, /check constraint/],
        ["empty primary", { ...ok, primaryCategory: "" }, /check constraint/],
        ["not a phone number", { ...ok, phone: "abc" }, /check constraint/],
        [
          "too many blocks",
          {
            ...ok,
            blockedOrganizationIds: Array.from(
              { length: 201 },
              (_, i) => `00000000-0000-4000-9000-${String(i).padStart(12, "0")}`,
            ),
          },
          /too many/,
        ],
        [
          "unknown organization",
          { ...ok, blockedOrganizationIds: ["00000000-0000-4000-9000-000000000999"] },
          /foreign key/,
        ],
        ["rate below 0.01", { ...ok, minRate: 0 }, /check constraint/],
      ];
      for (const [label, payload, error] of cases) {
        expect(await queryError(tx, saveSql, [JSON.stringify(payload), null]), label).toMatch(
          error,
        );
      }
    });
  });

  it("is for professionals only, never anon", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      expect(await queryError(tx, saveSql, [JSON.stringify(passport("Admin")), null])).toMatch(
        /not authorized/,
      );
    });
    await asUser(db, null, async (tx) => {
      expect(await queryError(tx, saveSql, [JSON.stringify(passport("Anon")), null])).toMatch(
        /permission denied/,
      );
    });
  });

  it("only writes the caller's rows (the payload has no way to name another professional)", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      await save(tx, passport("Technician Delta"));
      await tx.exec("reset role"); // read as the table owner: every row, no RLS
      const { rows } = await tx.query<{ profile_id: string }>(
        "select profile_id from public.technician_private_details",
      );
      expect(rows).toEqual([{ profile_id: SEED.delta }]); // the seed's row, now updated
      const echo = await tx.query<{ categories: string[]; display_name: string }>(
        `select tp.categories, p.display_name from public.technician_profiles tp
         join public.profiles p on p.id = tp.profile_id where tp.profile_id = $1`,
        [SEED.echo],
      );
      // Echo keeps the seed's declarations and name.
      expect(echo.rows[0]).toEqual({ categories: ["B1.1"], display_name: "Technician Echo" });
    });
  });
});

describe("no direct write path (writes only through the RPC)", () => {
  it("the owner cannot insert, update or delete the new tables and columns through PostgREST", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      // Delta's seed rows exist (private details, one rating): updates and deletes have a target.
      await save(tx, passport("Technician Delta", { blockedOrganizationIds: [lisbonId] }));
      const columns: [string, string][] = [
        ["primary_category", "'B2'"],
        ["categories", "'{B2}'"],
        ["aircraft", "'{A330}'"],
        ["engines", "'{GE90}'"],
        ["skills", "'{ndt}'"],
        ["english_level", "'C2'"],
        ["own_tools", "false"],
        ["base_country", "'FR'"],
        ["work_permits", "'{FR}'"],
        ["general_restrictions", "null"],
      ];
      for (const sql of [
        "insert into public.technician_private_details (profile_id, phone) values (auth.uid(), '+34 600 000 000')",
        `insert into public.technician_organization_blocks (technician_profile_id, organization_id) values (auth.uid(), '${mroId}')`,
        "insert into public.technician_type_ratings (technician_profile_id, aircraft, category) values (auth.uid(), 'A330', 'B2')",
        "update public.technician_private_details set min_rate = 1 where profile_id = auth.uid()",
        "update public.technician_type_ratings set restrictions = null where technician_profile_id = auth.uid()",
        "update public.technician_organization_blocks set organization_id = organization_id where technician_profile_id = auth.uid()",
        "delete from public.technician_private_details where profile_id = auth.uid()",
        "delete from public.technician_type_ratings where technician_profile_id = auth.uid()",
        "delete from public.technician_organization_blocks where technician_profile_id = auth.uid()",
        ...columns.map(
          ([column, value]) =>
            `update public.technician_profiles set ${column} = ${value} where profile_id = auth.uid()`,
        ),
      ]) {
        expect(await queryError(tx, sql), sql).toMatch(/permission denied/);
      }
      // The V0 column grants still work (and the new CHECKs do not get in their way).
      const v0 = await tx.query(
        "update public.technician_profiles set base_location = 'Girona (GRO)' where profile_id = auth.uid()",
      );
      expect(v0.affectedRows).toBe(1);
    });
  });
});

describe("who reads what (RLS)", () => {
  it("private details and blocks are owner-only; ratings and declarations follow the qualifications", async () => {
    // Alpha is a member of Demo MRO Madrid (internal workforce, OD-4). One transaction, rolled back.
    await asUser(db, SEED.alpha, async (tx) => {
      await save(tx, passport("Technician Alpha", { blockedOrganizationIds: [lisbonId] }));
      const readers: [
        string,
        string,
        { priv: number; blocks: number; ratings: number; decl: number },
      ][] = [
        ["owner", SEED.alpha, { priv: 1, blocks: 1, ratings: 2, decl: 1 }],
        ["own-org admin", SEED.adminMro, { priv: 0, blocks: 0, ratings: 2, decl: 1 }],
        ["own-org manager", SEED.managerMro, { priv: 0, blocks: 0, ratings: 2, decl: 1 }],
        ["plain member colleague", SEED.charlieMember, { priv: 0, blocks: 0, ratings: 0, decl: 0 }],
        ["other organization", SEED.adminOther, { priv: 0, blocks: 0, ratings: 0, decl: 0 }],
        ["other professional", SEED.delta, { priv: 0, blocks: 0, ratings: 0, decl: 0 }],
        ["platform admin", SEED.platformAdmin, { priv: 0, blocks: 0, ratings: 2, decl: 1 }],
      ];
      for (const [label, reader, expected] of readers) {
        await switchTo(tx, reader);
        const count = async (sql: string) =>
          (await tx.query<{ n: number }>(sql, [SEED.alpha])).rows[0]!.n;
        expect(
          {
            priv: await count(
              "select count(*)::int as n from public.technician_private_details where profile_id = $1",
            ),
            blocks: await count(
              "select count(*)::int as n from public.technician_organization_blocks where technician_profile_id = $1",
            ),
            ratings: await count(
              "select count(*)::int as n from public.technician_type_ratings where technician_profile_id = $1",
            ),
            decl: await count(
              "select count(*)::int as n from public.technician_profiles where profile_id = $1 and primary_category = 'B1.1'",
            ),
          },
          label,
        ).toEqual(expected);
      }
    });
    await asUser(db, null, async (tx) => {
      for (const table of [
        "technician_private_details",
        "technician_organization_blocks",
        "technician_type_ratings",
      ]) {
        expect(await queryError(tx, `select * from public.${table}`), table).toMatch(
          /permission denied/,
        );
      }
    });
  });
});

describe("list_blockable_organizations (N-08)", () => {
  it("professionals get id and name of organizations that published; not the whole directory (MEDIUM-1)", async () => {
    const published = await db.query<{ name: string }>(
      `select o.name from public.organizations o
       where exists (select 1 from public.work_requirements wr
                     where wr.organization_id = o.id and wr.status <> 'draft')
       order by o.name`,
    );
    expect(published.rows.length).toBeGreaterThan(0);
    await asUser(db, SEED.echo, async (tx) => {
      const { rows, fields } = await tx.query<{ id: string; name: string }>(
        "select * from public.list_blockable_organizations()",
      );
      expect(fields.map((f) => f.name)).toEqual(["id", "name"]);
      expect(rows.map((r) => r.name)).toEqual(published.rows.map((r) => r.name));
      // An organization that never published (the platform's own) is not offered…
      expect(rows.map((r) => r.name)).not.toContain("CrewFlex Operaciones");
      // …nor one that only has a draft.
      await tx.exec("reset role");
      await tx.query(
        `with o as (insert into public.organizations (name, type, country)
                    values ('Quiet Draft Org', 'mro', 'ES') returning id)
         insert into public.work_requirements
           (organization_id, title, location, starts_at, ends_at, headcount, status, created_by)
         select o.id, 'Draft need', 'Madrid (MAD)', now() + interval '30 days',
                now() + interval '31 days', 1, 'draft', $1 from o`,
        [SEED.adminMro],
      );
      await switchTo(tx, SEED.echo);
      expect(
        (
          await tx.query<{ name: string }>("select name from public.list_blockable_organizations()")
        ).rows.map((r) => r.name),
      ).not.toContain("Quiet Draft Org");
    });
    // A member sees their own organization even without publications.
    await asUser(db, SEED.platformAdmin, async (tx) => {
      const { rows } = await tx.query<{ name: string }>(
        "select name from public.list_blockable_organizations()",
      );
      expect(rows.map((r) => r.name)).toContain("CrewFlex Operaciones");
    });
    await asUser(db, SEED.adminMro, async (tx) => {
      expect(await queryError(tx, "select * from public.list_blockable_organizations()")).toMatch(
        /not authorized/,
      );
    });
    await asUser(db, null, async (tx) => {
      expect(await queryError(tx, "select * from public.list_blockable_organizations()")).toMatch(
        /permission denied/,
      );
    });
  });

  it("always lists the professional's own blocks and employer, first", async () => {
    const operaciones = await orgIdByName(db, "CrewFlex Operaciones");
    await asUser(db, SEED.echo, async (tx) => {
      const { rows: orgs } = await tx.query<{ id: string; name: string }>(
        "select * from public.list_blockable_organizations()",
      );
      const last = orgs.at(-1)!;
      // An organization outside the list (never published) stays visible once chosen, so a
      // full-replacement save of the form can never silently drop it.
      await save(
        tx,
        passport("Technician Echo", {
          visibility: "open",
          blockedOrganizationIds: [last.id],
          currentEmployerId: operaciones,
        }),
      );
      const { rows } = await tx.query<{ id: string }>(
        "select id from public.list_blockable_organizations()",
      );
      expect(
        rows
          .slice(0, 2)
          .map((r) => r.id)
          .sort(),
      ).toEqual([last.id, operaciones].sort());
    });
  });
});

describe("blocked organizations leave the external pool (N-08, T-35)", () => {
  it("Delta disappears from Demo MRO Madrid's pool and counts, and comes back when unblocked", async () => {
    const deltaRef = pseudonym(madRequirementId, SEED.delta);
    const refsBefore = await asUser(db, SEED.adminMro, (tx) => poolRefs(tx, madRequirementId));
    expect(refsBefore).toContain(deltaRef);
    const summary = (tx: Transaction) =>
      tx.query<{ prefiltered: number; hard_eligible: number }>(
        "select prefiltered, hard_eligible from public.get_requirement_external_pool_summary($1)",
        [madRequirementId],
      );
    const before = (await asUser(db, SEED.adminMro, summary)).rows[0]!;

    await asUser(db, SEED.delta, async (tx) => {
      await save(tx, passport("Technician Delta", { blockedOrganizationIds: [mroId] }));
      await switchTo(tx, SEED.adminMro);
      const refs = await poolRefs(tx, madRequirementId);
      expect(refs).not.toContain(deltaRef);
      expect(refs).toHaveLength(refsBefore.length - 1);
      const after = (await summary(tx)).rows[0]!;
      expect(after).toEqual({
        prefiltered: before.prefiltered - 1,
        hard_eligible: before.hard_eligible - 1,
      });
      // The block names one organization: the professional's own data is untouched elsewhere.
      const passports = await tx.query<{ candidate_ref: string }>(
        "select candidate_ref from public.get_requirement_candidate_passports($1)",
        [madRequirementId],
      );
      expect(passports.rows.map((r) => r.candidate_ref)).not.toContain(deltaRef);
    });
    // Rolled back: unblocked again.
    expect(await asUser(db, SEED.adminMro, (tx) => poolRefs(tx, madRequirementId))).toContain(
      deltaRef,
    );
  });
});

describe("get_requirement_candidate_passports (candidate cards)", () => {
  it("returns exactly the pool's references, with declarations and no private data", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      await save(
        tx,
        passport("Technician Delta", {
          generalRestrictions: "Engine tasks under supervision",
          phone: "+34 611 222 333",
          minRate: 99,
          blockedOrganizationIds: [lisbonId],
        }),
      );
      await switchTo(tx, SEED.adminMro);
      const { rows, fields } = await tx.query<{
        candidate_ref: string;
        primary_category: string | null;
        categories: string[];
        aircraft: string[];
        english_level: string | null;
        work_permits: string[];
        has_restrictions: boolean;
      }>("select * from public.get_requirement_candidate_passports($1)", [madRequirementId]);
      expect(fields.map((f) => f.name)).toEqual([
        "candidate_ref",
        "primary_category",
        "categories",
        "aircraft",
        "english_level",
        "work_permits",
        "has_restrictions",
      ]);
      expect(rows.map((r) => r.candidate_ref).sort()).toEqual(await poolRefs(tx, madRequirementId));
      const delta = rows.find((r) => r.candidate_ref === pseudonym(madRequirementId, SEED.delta));
      expect(delta).toEqual({
        candidate_ref: pseudonym(madRequirementId, SEED.delta),
        primary_category: "B1.1",
        categories: ["B1.1", "B2"],
        aircraft: ["A320 Family", "B737 NG"],
        english_level: "B2",
        work_permits: ["PT", "ES"],
        has_restrictions: true,
      });
      // The shared parser (Edge Functions) maps the row to the API shape.
      expect(new Map(rows.map(toCandidatePassport)).get(delta!.candidate_ref)).toEqual({
        primaryCategory: "B1.1",
        categories: ["B1.1", "B2"],
        aircraft: ["A320 Family", "B737 NG"],
        englishLevel: "B2",
        workPermits: ["PT", "ES"],
        hasRestrictions: true,
      });
      // Internal members are listed by profile id, like the pool.
      expect(rows.map((r) => r.candidate_ref)).toContain(SEED.alpha);
      // No private value anywhere in the output.
      expect(JSON.stringify(rows)).not.toMatch(/611 222 333|Engine tasks/);
    });
  });

  it("a private professional never appears, even fully qualified and with declarations", async () => {
    await asUser(db, SEED.hotelPrivate, async (tx) => {
      await save(tx, passport("Technician Hotel", { visibility: "private" }));
      await switchTo(tx, SEED.adminMro);
      const { rows } = await tx.query<{ candidate_ref: string }>(
        "select candidate_ref from public.get_requirement_candidate_passports($1)",
        [madRequirementId],
      );
      expect(rows.map((r) => r.candidate_ref)).not.toContain(
        pseudonym(madRequirementId, SEED.hotelPrivate),
      );
    });
  });

  it("is refused to other organizations, plain members, professionals and a non-member platform admin (same 42501 as the pool)", async () => {
    for (const reader of [SEED.adminOther, SEED.charlieMember, SEED.delta, SEED.platformAdmin]) {
      await asUser(db, reader, async (tx) => {
        expect(
          await queryError(tx, "select * from public.get_requirement_candidate_passports($1)", [
            madRequirementId,
          ]),
        ).toMatch(/not authorized/);
        expect(
          await queryError(tx, "select * from public.get_requirement_candidate_passports($1)", [
            "00000000-0000-4000-9000-000000000001",
          ]),
        ).toMatch(/not authorized/);
      });
    }
    await asUser(db, null, async (tx) => {
      expect(
        await queryError(tx, "select * from public.get_requirement_candidate_passports($1)", [
          madRequirementId,
        ]),
      ).toMatch(/permission denied/);
    });
  });
});
