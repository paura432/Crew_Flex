// Candidate Pack copy (v2-15 + v2-04, migration 20261024300000, BUSINESS_RULES BR-25, T-110…T-116): frozen when
// the application is created; read only by its two parties through get_application_pack(); never identity,
// contact, employer, blocks or documents; the preview the apply panel shows is the same builder. Every case
// runs in a rolled-back transaction (harness `asUser`).
import { randomUUID } from "node:crypto";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, orgIdByName, SEED } from "./harness";
import { PACK_EXPERIENCE_MAX } from "../../src/domain/candidate-pack";
import {
  passportPayload,
  updateProfessionalProfileInput,
  type ProfessionalPassportPayload,
} from "../../src/lib/validation/professional";

let db: PGlite;
let mroId: string;
let lisbonId: string;

beforeAll(async () => {
  db = await createTestDatabase();
  mroId = await orgIdByName(db, "Demo MRO Madrid");
  lisbonId = await orgIdByName(db, "Demo Aero Services Lisbon");
});

afterAll(async () => {
  await db.close();
});

/** The exact output of get_application_pack (the preview: the same without `application_id`). */
const PACK_COLUMNS = [
  "application_id",
  "copied_at",
  "primary_category",
  "categories",
  "years_experience",
  "english_level",
  "base_location",
  "base_country",
  "aircraft",
  "engines",
  "skills",
  "work_permits",
  "general_restrictions",
  "min_rate",
  "rate_unit",
  "type_ratings",
  "qualifications",
  "experience",
];
const RATING_KEYS = ["aircraft", "category", "expiresAt", "restrictions"];
const QUALIFICATION_KEYS = ["category", "code", "expiresAt", "name", "verificationStatus"];
const EXPERIENCE_KEYS = [
  "aircraft",
  "ata",
  "category",
  "date",
  "description",
  "environment",
  "hours",
];

type PackRow = Record<string, unknown> & {
  application_id?: string;
  copied_at: Date;
  type_ratings: Record<string, unknown>[];
  qualifications: Record<string, unknown>[];
  experience: Record<string, unknown>[];
};

async function actAs(tx: Transaction, userId: string | null) {
  await tx.exec("reset role");
  await tx.query("select set_config('request.jwt.claims', $1, true)", [
    userId ? JSON.stringify({ sub: userId, role: "authenticated" }) : "",
  ]);
  await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
}

/** Back to the owner with no JWT (the seed's situation). */
const asOwner = (tx: Transaction) => actAs(tx, null).then(() => tx.exec("reset role"));

async function sqlError(tx: Transaction, sql: string, params: unknown[] = []) {
  await tx.exec("savepoint expected_error");
  try {
    await tx.query(sql, params);
  } catch (error) {
    await tx.exec("rollback to savepoint expected_error");
    const e = error as { code?: string; message: string };
    return { code: e.code, message: e.message };
  }
  throw new Error(`expected statement to fail: ${sql}`);
}

/** An open need of `org` with hard B1.1 + TR-A320 (Delta and Echo hold them verified), in 5 days. */
async function createNeed(tx: Transaction, org: string, createdBy: string, withWindows = true) {
  await asOwner(tx);
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.work_requirements
       (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
     values ($1, 'Pack need', 'Madrid (MAD)', now() + interval '5 days', now() + interval '8 days', 'day', 2,
             'planned', 'open', $2)
     returning id`,
    [org, createdBy],
  );
  const id = rows[0]!.id;
  await tx.query(
    `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
     select $1, id, 'hard' from public.qualification_types where code in ('B1.1', 'TR-A320')`,
    [id],
  );
  if (withWindows)
    await tx.query(
      `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
       select p, now() - interval '30 days', now() + interval '120 days', 'available'
       from unnest($1::uuid[]) p`,
      [[SEED.delta, SEED.echo]],
    );
  return id;
}

async function applyAs(tx: Transaction, technician: string, requirementId: string) {
  await actAs(tx, technician);
  const { rows } = await tx.query<{ id: string }>(
    "select * from public.apply_to_requirement($1, $2, true)",
    [requirementId, randomUUID()],
  );
  return rows[0]!.id;
}

async function withdraw(tx: Transaction, technician: string, applicationId: string) {
  await asOwner(tx);
  const { rows } = await tx.query<{ updated_at: Date }>(
    "select updated_at from public.applications where id = $1",
    [applicationId],
  );
  await actAs(tx, technician);
  await tx.query("select * from public.transition_application($1, 'withdrawn', $2, $3)", [
    applicationId,
    rows[0]!.updated_at.toISOString(),
    randomUUID(),
  ]);
}

async function packAs(tx: Transaction, userId: string, applicationId: string) {
  await actAs(tx, userId);
  const { rows } = await tx.query<PackRow>("select * from public.get_application_pack($1)", [
    applicationId,
  ]);
  return rows;
}

async function previewAs(tx: Transaction, userId: string) {
  await actAs(tx, userId);
  const { rows } = await tx.query<PackRow>("select * from public.get_my_candidate_pack_preview()");
  return rows[0]!;
}

async function addEntry(
  tx: Transaction,
  technician: string,
  entry: { aircraft: string; description: string; cvRelevant: boolean; archived?: boolean },
  daysAgo = 1,
) {
  await asOwner(tx);
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.logbook_entries
       (technician_profile_id, entry_date, aircraft, ata, hours, category, environment, description,
        cv_relevant, archived)
     values ($1, (now() at time zone 'Europe/Madrid')::date - $2::int, $3, '32', 3.5, 'inspection',
             'line_maintenance', $4, $5, $6)
     returning id`,
    [
      technician,
      daysAgo,
      entry.aircraft,
      entry.description,
      entry.cvRelevant,
      entry.archived ?? false,
    ],
  );
  return rows[0]!.id;
}

/** Delta's passport with every private field set (phone, employer, a block) and a restricted rating. */
function deltaPassport(overrides: Partial<ProfessionalPassportPayload> = {}) {
  return passportPayload(
    updateProfessionalProfileInput.parse({
      displayName: "Technician Delta",
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
      englishLevel: "C1",
      ownTools: true,
      baseCountry: "ES",
      workPermits: ["ES", "PT"],
      generalRestrictions: "No night shifts on weekends (synthetic)",
      typeRatings: [
        { aircraft: "A320 Family", category: "B1.1", expiresAt: null, restrictions: null },
        {
          aircraft: "B737 NG",
          category: "B2",
          expiresAt: "2028-06-30",
          restrictions: "No CFM56 tasks (synthetic)",
        },
      ],
      phone: "+34 600 111 222",
      currentEmployerId: lisbonId,
      minRate: 45.5,
      rateUnit: "hour",
      blockedOrganizationIds: [lisbonId],
      ...overrides,
    }),
  );
}

async function savePassport(tx: Transaction, payload: unknown) {
  await actAs(tx, SEED.delta);
  await tx.query("select public.save_professional_passport($1::jsonb, null)", [
    JSON.stringify(payload),
  ]);
}

const sortedKeys = (o: Record<string, unknown>) => Object.keys(o).sort();
/** The content only (the copy's id and date differ from the preview's by construction). */
function withoutTimes(row: PackRow) {
  const rest: Record<string, unknown> = { ...row };
  delete rest.copied_at;
  delete rest.application_id;
  return rest;
}

describe("pack copy: schema and grants", () => {
  it("RLS on; no API role reads the table; the RPCs exist for authenticated only", async () => {
    const { rows } = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where oid = 'public.application_packs'::regclass",
    );
    expect(rows[0]!.relrowsecurity).toBe(true);
    const grants = await db.query<Record<string, boolean>>(
      `select has_table_privilege('authenticated', 'public.application_packs', 'select') as auth_select,
              has_table_privilege('authenticated', 'public.application_packs', 'insert') as auth_insert,
              has_table_privilege('authenticated', 'public.application_packs', 'update') as auth_update,
              has_table_privilege('authenticated', 'public.application_packs', 'delete') as auth_delete,
              has_table_privilege('anon', 'public.application_packs', 'select') as anon_select,
              has_function_privilege('anon', 'public.get_application_pack(uuid)', 'execute') as anon_read,
              has_function_privilege('anon', 'public.get_my_candidate_pack_preview()', 'execute') as anon_preview,
              has_function_privilege('anon', 'public.get_my_application_packs()', 'execute') as anon_export,
              has_function_privilege('authenticated', 'public.get_application_pack(uuid)', 'execute') as auth_read,
              has_function_privilege('authenticated', 'app_private.candidate_pack_content(uuid)', 'execute') as auth_builder,
              has_function_privilege('authenticated', 'public.freeze_application_pack()', 'execute') as auth_trigger`,
    );
    expect(grants.rows[0]).toEqual({
      auth_select: false,
      auth_insert: false,
      auth_update: false,
      auth_delete: false,
      anon_select: false,
      anon_read: false,
      anon_preview: false,
      anon_export: false,
      auth_read: true,
      auth_builder: false,
      auth_trigger: false,
    });
  });

  it("every DEFINER function of the package pins search_path = ''", async () => {
    const { rows } = await db.query<{ proname: string; config: string[] | null; definer: boolean }>(
      `select p.proname, p.proconfig as config, p.prosecdef as definer
       from pg_proc p
       where p.proname in ('get_application_pack', 'get_my_candidate_pack_preview',
                           'get_my_application_packs', 'freeze_application_pack',
                           'drop_application_pack', 'candidate_pack_content')
       order by p.proname`,
    );
    expect(rows).toHaveLength(6);
    for (const row of rows) expect(row.config, row.proname).toContain('search_path=""');
    expect(rows.filter((r) => r.definer).map((r) => r.proname)).toEqual([
      "drop_application_pack",
      "freeze_application_pack",
      "get_application_pack",
      "get_my_application_packs",
      "get_my_candidate_pack_preview",
    ]);
  });

  it("the output column lists are fixed: nothing identifying, no contact, employer, blocks or documents", async () => {
    const { rows } = await db.query<{ fn: string; result: string }>(
      `select 'pack' as fn, pg_get_function_result('public.get_application_pack(uuid)'::regprocedure) as result
       union all
       select 'preview', pg_get_function_result('public.get_my_candidate_pack_preview()'::regprocedure)
       union all
       select 'export', pg_get_function_result('public.get_my_application_packs()'::regprocedure)`,
    );
    expect(rows).toHaveLength(3);
    for (const { fn, result } of rows) {
      const columns = [
        ...result.matchAll(/(\w+) (?:text|uuid|integer|numeric|jsonb|timestamp)/g),
      ].map((m) => m[1]);
      expect(columns, fn).toEqual(
        fn === "preview" ? PACK_COLUMNS.filter((c) => c !== "application_id") : PACK_COLUMNS,
      );
      for (const forbidden of [
        "name",
        "display_name",
        "phone",
        "email",
        "employer",
        "current_employer_id",
        "blocked",
        "document",
        "file",
        "storage_path",
        "visibility",
        "technician_profile_id",
      ])
        expect(
          columns.some((c) => c!.includes(forbidden)),
          `${fn}: ${forbidden}`,
        ).toBe(false);
    }
  });
});

describe("pack copy: frozen at application time", () => {
  it("the copy is the passport and the selected logbook of that moment; later edits do not change it", async () => {
    await asUser(db, null, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await savePassport(tx, deltaPassport());
      await addEntry(tx, SEED.delta, {
        aircraft: "A320 EC-QAA",
        description: "Selected one",
        cvRelevant: true,
      });
      await addEntry(tx, SEED.delta, {
        aircraft: "ATR 72",
        description: "Not selected",
        cvRelevant: false,
      });
      await addEntry(tx, SEED.delta, {
        aircraft: "B737",
        description: "Selected but archived",
        cvRelevant: true,
        archived: true,
      });
      const preview = await previewAs(tx, SEED.delta);
      const app = await applyAs(tx, SEED.delta, need);

      const [copy] = await packAs(tx, SEED.adminMro, app);
      expect(Object.keys(copy!)).toEqual(PACK_COLUMNS);
      expect(copy).toMatchObject({
        application_id: app,
        primary_category: "B1.1",
        categories: ["B1.1", "B2"],
        years_experience: 12,
        english_level: "C1",
        base_location: "Barcelona (BCN)",
        base_country: "ES",
        aircraft: ["A320 Family", "B737 NG"],
        engines: ["CFM56-5B/7B"],
        skills: ["line_maintenance", "borescope"],
        work_permits: ["PT", "ES"], // the schema keeps the catalog (v1.8) order
        general_restrictions: "No night shifts on weekends (synthetic)",
        rate_unit: "hour",
      });
      expect(Number(copy!.min_rate)).toBe(45.5);
      expect(copy!.type_ratings).toEqual([
        { aircraft: "A320 Family", category: "B1.1", expiresAt: null, restrictions: null },
        {
          aircraft: "B737 NG",
          category: "B2",
          expiresAt: "2028-06-30",
          restrictions: "No CFM56 tasks (synthetic)",
        },
      ]);
      expect(copy!.experience.map((e) => e.description)).toEqual(["Selected one"]);
      for (const r of copy!.type_ratings) expect(sortedKeys(r)).toEqual(RATING_KEYS);
      for (const q of copy!.qualifications) expect(sortedKeys(q)).toEqual(QUALIFICATION_KEYS);
      for (const e of copy!.experience) expect(sortedKeys(e)).toEqual(EXPERIENCE_KEYS);
      expect(copy!.qualifications.map((q) => q.code)).toEqual(
        expect.arrayContaining(["B1.1", "TR-A320"]),
      );
      // The panel showed exactly this (same builder), before the consent (T-111).
      expect(withoutTimes(preview)).toEqual(withoutTimes(copy!));

      // Nothing private leaks, not even inside the jsonb: name, phone, employer or blocked organization.
      const text = JSON.stringify(copy);
      for (const secret of ["Technician Delta", "+34 600 111 222", lisbonId, SEED.delta])
        expect(text, secret).not.toContain(secret);

      // The professional edits everything afterwards…
      await savePassport(
        tx,
        deltaPassport({
          yearsExperience: 13,
          englishLevel: "C2",
          generalRestrictions: null,
          typeRatings: [],
          minRate: 60,
          rateUnit: "day",
        }),
      );
      await asOwner(tx);
      await tx.query(
        `update public.logbook_entries set description = 'Edited later', cv_relevant = true
         where technician_profile_id = $1`,
        [SEED.delta],
      );
      await tx.query(
        `update public.technician_qualifications set status = 'withdrawn'
         where technician_profile_id = $1`,
        [SEED.delta],
      );
      // …the copy stays as it was, for both parties, and the next preview shows the new data.
      for (const reader of [SEED.adminMro, SEED.managerMro, SEED.delta]) {
        const [again] = await packAs(tx, reader, app);
        expect(again, reader).toEqual(copy);
      }
      const next = await previewAs(tx, SEED.delta);
      expect(next).toMatchObject({ years_experience: 13, english_level: "C2", rate_unit: "day" });
      expect(next.type_ratings).toEqual([]);
      expect(next.qualifications).toEqual([]);
      // Both active entries are selected now; the archived one stays out.
      expect(next.experience.map((e) => e.description)).toEqual(["Edited later", "Edited later"]);
    });
  });

  it("a copy cannot be rewritten, not even by the owner", async () => {
    await asUser(db, null, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      const app = await applyAs(tx, SEED.delta, need);
      await asOwner(tx);
      const error = await sqlError(
        tx,
        "update public.application_packs set years_experience = 40 where application_id = $1",
        [app],
      );
      expect(error.code).toBe("55000");
    });
  });

  it("at most the newest 20 selected entries; no rate unit without a rate; no logbook = []", async () => {
    await asUser(db, null, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      // Echo: no private row (no rate), no logbook.
      const echoApp = await applyAs(tx, SEED.echo, need);
      const [echo] = await packAs(tx, SEED.adminMro, echoApp);
      expect(echo).toMatchObject({ min_rate: null, rate_unit: null, experience: [] });

      for (let i = 0; i < PACK_EXPERIENCE_MAX + 3; i++)
        await addEntry(
          tx,
          SEED.delta,
          { aircraft: "A320", description: `e${i}`, cvRelevant: true },
          i + 1,
        );
      const app = await applyAs(tx, SEED.delta, need);
      const [copy] = await packAs(tx, SEED.adminMro, app);
      expect(copy!.experience).toHaveLength(PACK_EXPERIENCE_MAX);
      expect(copy!.experience[0]!.description).toBe("e0"); // newest first
      expect(copy!.experience.at(-1)!.description).toBe(`e${PACK_EXPERIENCE_MAX - 1}`);
    });
  });

  it("withdrawing deletes the copy; applying again freezes a new one with that day's data", async () => {
    await asUser(db, null, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      const first = await applyAs(tx, SEED.delta, need);
      expect(await packAs(tx, SEED.adminMro, first)).toHaveLength(1);
      await withdraw(tx, SEED.delta, first);
      expect(await packAs(tx, SEED.adminMro, first)).toEqual([]);
      expect(await packAs(tx, SEED.delta, first)).toEqual([]);

      await addEntry(tx, SEED.delta, {
        aircraft: "A320",
        description: "After withdrawing",
        cvRelevant: true,
      });
      const second = await applyAs(tx, SEED.delta, need);
      const [copy] = await packAs(tx, SEED.adminMro, second);
      expect(copy!.experience.map((e) => e.description)).toEqual(["After withdrawing"]);
    });
  });

  it("rejected applications keep their copy (the organization's record)", async () => {
    await asUser(db, null, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      const app = await applyAs(tx, SEED.delta, need);
      await asOwner(tx);
      const { rows } = await tx.query<{ updated_at: Date }>(
        "select updated_at from public.applications where id = $1",
        [app],
      );
      await actAs(tx, SEED.adminMro);
      await tx.query(
        "select * from public.transition_application($1, 'rejected', $2, $3, 'Not this time')",
        [app, rows[0]!.updated_at.toISOString(), randomUUID()],
      );
      expect(await packAs(tx, SEED.adminMro, app)).toHaveLength(1);
      expect(await packAs(tx, SEED.delta, app)).toHaveLength(1);
    });
  });

  it("an application row written by someone other than the applicant gets no copy", async () => {
    await asUser(db, null, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      // A future path inserting for someone else (simulated: owner insert under another user's JWT).
      await actAs(tx, SEED.adminMro);
      await tx.exec("reset role");
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.applications (requirement_id, technician_profile_id) values ($1, $2) returning id",
        [need, SEED.delta],
      );
      const { rows: packs } = await tx.query(
        "select 1 from public.application_packs where application_id = $1",
        [rows[0]!.id],
      );
      expect(packs).toEqual([]);
    });
  });
});

describe("pack copy: who reads it", () => {
  it("only the applicant and the requirement organization's admins/managers", async () => {
    await asUser(db, null, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      const app = await applyAs(tx, SEED.delta, need);
      for (const reader of [SEED.adminMro, SEED.managerMro, SEED.delta])
        expect(await packAs(tx, reader, app), reader).toHaveLength(1);

      // Another organization's admin, a plain member, another technician, a platform admin: the same
      // P0002 as a random id (no oracle).
      for (const stranger of [
        SEED.adminOther,
        SEED.adminAirline,
        SEED.charlieMember,
        SEED.echo,
        SEED.platformAdmin,
      ]) {
        await actAs(tx, stranger);
        const error = await sqlError(tx, "select * from public.get_application_pack($1)", [app]);
        expect(error.code, stranger).toBe("P0002");
        const random = await sqlError(tx, "select * from public.get_application_pack($1)", [
          randomUUID(),
        ]);
        expect(random.code, stranger).toBe("P0002");
        // and the table is closed to them (and to the applicant) through PostgREST
        expect((await sqlError(tx, "select * from public.application_packs")).code).toBe("42501");
      }
      await actAs(tx, SEED.delta);
      expect((await sqlError(tx, "select * from public.application_packs")).code).toBe("42501");

      // Anonymous: no EXECUTE at all.
      await actAs(tx, null);
      expect(
        (await sqlError(tx, "select * from public.get_application_pack($1)", [app])).code,
      ).toBe("42501");
      expect(
        (await sqlError(tx, "select * from public.get_my_candidate_pack_preview()")).code,
      ).toBe("42501");
    });
  });

  it("a manager who loses the role loses the copy; the preview is for professionals only", async () => {
    await asUser(db, null, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      const app = await applyAs(tx, SEED.delta, need);
      await asOwner(tx);
      await tx.query(
        "update public.organization_members set role = 'member' where organization_id = $1 and profile_id = $2",
        [mroId, SEED.managerMro],
      );
      await actAs(tx, SEED.managerMro);
      expect(
        (await sqlError(tx, "select * from public.get_application_pack($1)", [app])).code,
      ).toBe("P0002");
      await actAs(tx, SEED.adminMro);
      expect(
        (await sqlError(tx, "select * from public.get_my_candidate_pack_preview()")).code,
      ).toBe("42501");
    });
  });

  it("the preview reads only the caller's own data", async () => {
    await asUser(db, null, async (tx) => {
      await savePassport(tx, deltaPassport());
      const echo = await previewAs(tx, SEED.echo);
      expect(echo).toMatchObject({ english_level: "B1", min_rate: null });
      expect(JSON.stringify(echo)).not.toContain("No CFM56 tasks");
    });
  });
});

describe("pack copy: the professional's own records and account closure (T-42, T-43)", () => {
  it("«Exportar mis datos» lists every own copy, and only own ones", async () => {
    await asUser(db, null, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      const delta = await applyAs(tx, SEED.delta, need);
      const echo = await applyAs(tx, SEED.echo, need);
      await actAs(tx, SEED.delta);
      const { rows } = await tx.query<PackRow>("select * from public.get_my_application_packs()");
      expect(rows.map((r) => r.application_id)).toEqual([delta]);
      expect(Object.keys(rows[0]!)).toEqual(PACK_COLUMNS);
      await actAs(tx, SEED.adminMro); // an organization account has no copies of its own
      expect((await tx.query("select * from public.get_my_application_packs()")).rows).toEqual([]);
      expect(await packAs(tx, SEED.adminMro, echo)).toHaveLength(1);
    });
  });

  it("closing the account deletes every copy; the applications stay without the technician", async () => {
    await asUser(db, null, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      const second = await createNeed(tx, mroId, SEED.adminMro, false);
      const inProgress = await applyAs(tx, SEED.delta, need);
      const rejected = await applyAs(tx, SEED.delta, second);
      await asOwner(tx);
      const { rows: version } = await tx.query<{ updated_at: Date }>(
        "select updated_at from public.applications where id = $1",
        [rejected],
      );
      await actAs(tx, SEED.adminMro);
      await tx.query(
        "select * from public.transition_application($1, 'rejected', $2, $3, 'Not this time')",
        [rejected, version[0]!.updated_at.toISOString(), randomUUID()],
      );

      await actAs(tx, SEED.delta);
      await tx.query("select * from public.close_my_account()");
      await asOwner(tx);
      const { rows: apps } = await tx.query<{ id: string; status: string; t: string | null }>(
        `select id, status, technician_profile_id as t from public.applications
         where id = any ($1::uuid[]) order by status`,
        [[inProgress, rejected]],
      );
      expect(apps).toEqual([
        { id: rejected, status: "rejected", t: null },
        { id: inProgress, status: "withdrawn", t: null },
      ]);
      const { rows: packs } = await tx.query(
        "select 1 from public.application_packs where application_id = any ($1::uuid[])",
        [[inProgress, rejected]],
      );
      expect(packs).toEqual([]);

      // The organization is still a party of the kept application (no copy); a stranger still gets the
      // same P0002 as a random id, although the application has no technician any more (null-safe check).
      expect(await packAs(tx, SEED.adminMro, rejected)).toEqual([]);
      await actAs(tx, SEED.adminOther);
      expect(
        (await sqlError(tx, "select * from public.get_application_pack($1)", [rejected])).code,
      ).toBe("P0002");
    });
  });
});
