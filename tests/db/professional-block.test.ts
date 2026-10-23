// Package professional-block (v2-16 «Bloqueo de empleador», MKT-01 #27, MKT-03 #4; migration 20261024800000;
// BR-14 / BR-15 / BR-18, T-160): the organizations a professional blocks in the passport (N-08) also lose their
// needs in the professional's «Oportunidades» and refuse a new application (CFA16 ORGANIZATION_BLOCKED), as v1.8
// does («Esta organización está bloqueada.»). Every case runs in a rolled-back transaction.
import { createHash, randomUUID } from "node:crypto";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, orgIdByName, SEED } from "./harness";
import { APPLICATION_CONFLICTS } from "../../src/domain/applications";
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

async function actAs(tx: Transaction, userId: string | null) {
  await tx.exec("reset role");
  await tx.query("select set_config('request.jwt.claims', $1, true)", [
    userId ? JSON.stringify({ sub: userId, role: "authenticated" }) : "",
  ]);
  await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
}

/** A statement expected to fail: its SQLSTATE and message (a savepoint keeps the transaction usable). */
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

const conflict = (reason: (typeof APPLICATION_CONFLICTS)[number]) =>
  `CFA${String(APPLICATION_CONFLICTS.indexOf(reason) + 1).padStart(2, "0")}`;

/** Owner-side fixture: hard B1.1 + TR-A320, soft SMS, starting in 5 days unless told otherwise. */
async function createNeed(
  tx: Transaction,
  opts: { org: string; createdBy: string; status?: string; startsIn?: string; endsIn?: string },
): Promise<string> {
  await tx.exec("reset role");
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.work_requirements
       (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
     values ($1, 'Professional block fixture', 'Madrid (MAD)', now() + $2::interval, now() + $3::interval,
             'day', 2, 'planned', $4, $5)
     returning id`,
    [
      opts.org,
      opts.startsIn ?? "5 days",
      opts.endsIn ?? "8 days",
      opts.status ?? "open",
      opts.createdBy,
    ],
  );
  const id = rows[0]!.id;
  await tx.query(
    `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
     select $1, id, case when code = 'SMS' then 'soft' else 'hard' end::public.requirement_level
     from public.qualification_types where code in ('B1.1', 'TR-A320', 'SMS')`,
    [id],
  );
  return id;
}

/** Owner-side fixture: the seed professionals are available around now (their October windows end). */
async function makeAvailable(tx: Transaction, profiles: string[]) {
  await tx.exec("reset role");
  await tx.query(
    `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
     select p, now() - interval '30 days', now() + interval '120 days', 'available' from unnest($1::uuid[]) p`,
    [profiles],
  );
}

/** Owner-side fixture: the row the passport save writes, without the rest of the passport. */
async function blockDirectly(tx: Transaction, technician: string, organization: string) {
  await tx.exec("reset role");
  await tx.query(
    "insert into public.technician_organization_blocks (technician_profile_id, organization_id) values ($1, $2)",
    [technician, organization],
  );
}

/** A complete, valid passport for the seed professional named `name` (as tests/db/passport.test.ts). */
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
      ],
      phone: null,
      currentEmployerId: null,
      minRate: null,
      rateUnit: "hour",
      blockedOrganizationIds: [],
      ...overrides,
    }),
  );
}

/** The only write path of a block: the passport save, as the professional. */
async function savePassportAs(tx: Transaction, technician: string, blocked: string[]) {
  await actAs(tx, technician);
  await tx.query("select public.save_professional_passport($1::jsonb, null)", [
    JSON.stringify(passport("Technician Delta", { blockedOrganizationIds: blocked })),
  ]);
}

const APPLY = "select * from public.apply_to_requirement($1, $2, true)";

async function applyAs(tx: Transaction, technician: string, need: string, key = randomUUID()) {
  await actAs(tx, technician);
  return (await tx.query<{ id: string; replayed: boolean }>(APPLY, [need, key])).rows[0]!;
}

async function listedIds(tx: Transaction, user: string, id: string | null = null) {
  await actAs(tx, user);
  return (
    await tx.query<{ id: string }>("select id from public.list_opportunities($1)", [id])
  ).rows.map((r) => r.id);
}

async function rulesFor(tx: Transaction, user: string, ids: string[]) {
  await actAs(tx, user);
  return (
    await tx.query<{ requirement_id: string }>(
      "select requirement_id from public.get_requirement_profile_rules($1::uuid[])",
      [ids],
    )
  ).rows.map((r) => r.requirement_id);
}

const pseudonym = (requirementId: string, profileId: string) =>
  "CF-" +
  createHash("sha256")
    .update(`${requirementId}:${profileId}`)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();

/** The organization's external pool of a need, read by its admin (the passport package's exclusion). */
async function poolRefs(tx: Transaction, admin: string, requirementId: string) {
  await actAs(tx, admin);
  const { rows } = await tx.query<{ candidate_ref: string }>(
    "select candidate_ref from public.get_requirement_candidate_pool($1)",
    [requirementId],
  );
  return rows.map((r) => r.candidate_ref);
}

describe("professional block (v2-16, 20261024800000)", () => {
  it("CFA16 is the 16th APPLICATION_CONFLICTS entry", () => {
    expect(conflict("ORGANIZATION_BLOCKED")).toBe("CFA16");
    expect(APPLICATION_CONFLICTS).toHaveLength(16);
  });

  it("acceptance: Delta blocks Demo MRO Madrid → its needs leave «Oportunidades» (list, detail, rules), applying is CFA16, the pool still excludes Delta; another professional is unaffected; unblocking restores everything", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const mroNeed = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      const lisNeed = await createNeed(tx, { org: lisbonId, createdBy: SEED.adminOther });
      await makeAvailable(tx, [SEED.delta, SEED.echo]);
      const deltaRef = pseudonym(mroNeed, SEED.delta);

      // Before: both needs listed, Delta in the MRO need's pool.
      expect(await listedIds(tx, SEED.delta)).toEqual(expect.arrayContaining([mroNeed, lisNeed]));
      expect(await poolRefs(tx, SEED.adminMro, mroNeed)).toContain(deltaRef);

      // The block, through the passport (the only write path).
      await savePassportAs(tx, SEED.delta, [mroId]);

      // (a) The list, the detail by id and the professional-side rules no longer carry the MRO need.
      const listed = await listedIds(tx, SEED.delta);
      expect(listed).not.toContain(mroNeed);
      expect(listed).toContain(lisNeed);
      expect(await listedIds(tx, SEED.delta, mroNeed)).toEqual([]);
      expect(await listedIds(tx, SEED.delta, lisNeed)).toEqual([lisNeed]);
      expect(await rulesFor(tx, SEED.delta, [mroNeed, lisNeed])).toEqual([lisNeed]);

      // (b) Applying to the MRO need is CFA16; the Lisbon one is fine.
      await actAs(tx, SEED.delta);
      expect((await sqlError(tx, APPLY, [mroNeed, randomUUID()])).code).toBe(
        conflict("ORGANIZATION_BLOCKED"),
      );
      expect((await applyAs(tx, SEED.delta, lisNeed)).replayed).toBe(false);
      await tx.exec("reset role");
      expect(
        (
          await tx.query(
            "select 1 from public.applications where requirement_id = $1 and technician_profile_id = $2",
            [mroNeed, SEED.delta],
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await tx.query(
            "select 1 from public.audit_events where action = 'application.received' and metadata ->> 'requirement_id' = $1",
            [mroNeed],
          )
        ).rows,
      ).toHaveLength(0);

      // The pool (passport package, 20261023100300) still leaves Delta out.
      expect(await poolRefs(tx, SEED.adminMro, mroNeed)).not.toContain(deltaRef);

      // Another professional sees and applies to the MRO need as before.
      expect(await listedIds(tx, SEED.echo)).toEqual(expect.arrayContaining([mroNeed, lisNeed]));
      expect(await rulesFor(tx, SEED.echo, [mroNeed])).toEqual([mroNeed]);
      expect((await applyAs(tx, SEED.echo, mroNeed)).replayed).toBe(false);

      // Unblocking restores the list, the rules, the pool and the application.
      await savePassportAs(tx, SEED.delta, []);
      expect(await listedIds(tx, SEED.delta)).toEqual(expect.arrayContaining([mroNeed, lisNeed]));
      expect(await rulesFor(tx, SEED.delta, [mroNeed])).toEqual([mroNeed]);
      expect(await poolRefs(tx, SEED.adminMro, mroNeed)).toContain(deltaRef);
      expect((await applyAs(tx, SEED.delta, mroNeed)).replayed).toBe(false);
    });
  });

  it("precedence (v1.8 order): the requirement's state first, then the block, before the history and the eligibility; an existing application and its replay survive the block", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const open = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      const paused = await createNeed(tx, {
        org: mroId,
        createdBy: SEED.adminMro,
        status: "paused",
      });
      const started = await createNeed(tx, {
        org: mroId,
        createdBy: SEED.adminMro,
        startsIn: "-1 hour",
      });
      const far = await createNeed(tx, {
        org: mroId,
        createdBy: SEED.adminMro,
        startsIn: "200 days",
        endsIn: "203 days",
      });
      const applied = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      await makeAvailable(tx, [SEED.delta]);
      const key = randomUUID();
      const before = await applyAs(tx, SEED.delta, applied, key);
      expect(before.replayed).toBe(false);

      await blockDirectly(tx, SEED.delta, mroId);
      await actAs(tx, SEED.delta);
      expect((await sqlError(tx, APPLY, [paused, randomUUID()])).code).toBe(
        conflict("REQUIREMENT_NOT_OPEN"),
      );
      expect((await sqlError(tx, APPLY, [started, randomUUID()])).code).toBe(
        conflict("REQUIREMENT_STARTED"),
      );
      // Before CFA09 (an active application) and CFA04 (availability), as v1.8 checks the block first.
      for (const need of [open, applied, far]) {
        expect((await sqlError(tx, APPLY, [need, randomUUID()])).code).toBe(
          conflict("ORGANIZATION_BLOCKED"),
        );
      }
      // The application made before the block stays, is still the professional's own and replays as before.
      expect(
        (
          await tx.query<{ status: string }>(
            "select status from public.applications where id = $1",
            [before.id],
          )
        ).rows,
      ).toEqual([{ status: "received" }]);
      expect(
        (
          await tx.query<{ application_id: string }>(
            "select application_id from public.get_my_applications()",
          )
        ).rows.map((r) => r.application_id),
      ).toContain(before.id);
      expect(await rulesFor(tx, SEED.delta, [applied, open])).toEqual([applied]);
      expect(await applyAs(tx, SEED.delta, applied, key)).toEqual({
        id: before.id,
        replayed: true,
      });
    });
  });

  it("a member who is also a professional: the network view hides a blocked organization's need too (one predicate); the helper has no API grant", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      const lisNeed = await createNeed(tx, { org: lisbonId, createdBy: SEED.adminOther });
      expect(await listedIds(tx, SEED.managerMro)).toContain(lisNeed);
      await blockDirectly(tx, SEED.managerMro, lisbonId);
      expect(await listedIds(tx, SEED.managerMro)).not.toContain(lisNeed);
      // Someone else's block changes nothing for Delta.
      expect(await listedIds(tx, SEED.delta)).toContain(lisNeed);

      await tx.exec("reset role");
      const grants = (
        await tx.query<{ anon: boolean; authenticated: boolean; pub: boolean }>(
          `select has_function_privilege('anon', 'app_private.technician_blocks_organization(uuid, uuid)', 'execute') as anon,
                  has_function_privilege('authenticated', 'app_private.technician_blocks_organization(uuid, uuid)', 'execute') as authenticated,
                  has_function_privilege('public', 'app_private.technician_blocks_organization(uuid, uuid)', 'execute') as pub`,
        )
      ).rows[0]!;
      expect(grants).toEqual({ anon: false, authenticated: false, pub: false });
      await actAs(tx, SEED.delta);
      expect(
        (
          await sqlError(
            tx,
            "select app_private.technician_blocks_organization((select auth.uid()), $1)",
            [lisbonId],
          )
        ).code,
      ).toBe("42501");
    });
  });
});
