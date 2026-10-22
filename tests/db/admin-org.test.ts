// Package admin-org (v2 diff 10 #5, #9, #13, #15; 20 N-09): organization data and review, the
// «Empresas verificadas» visibility in the external pool, platform figures and the audit read.
// Migrations 20261023500000…500300. Every case runs in a rolled-back transaction (harness.asUser).
import { createHash } from "node:crypto";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, orgIdByName, requirementIdByTitle, SEED } from "./harness";
import {
  isExternallyMatchable,
  type OrganizationReviewStatus,
} from "../../src/domain/organization";
import { PROFILE_VISIBILITIES, type ProfileVisibility } from "../../src/domain/professional";

const MAD_REQUIREMENT = "B1.1 · A320 line maintenance reinforcement";

let db: PGlite;
let mroId: string;
let otherOrgId: string;
let crewflexOrgId: string;
let madRequirementId: string;

beforeAll(async () => {
  db = await createTestDatabase();
  mroId = await orgIdByName(db, "Demo MRO Madrid");
  otherOrgId = await orgIdByName(db, "Demo Aero Services Lisbon");
  crewflexOrgId = await orgIdByName(db, "CrewFlex Operaciones");
  madRequirementId = await requirementIdByTitle(db, MAD_REQUIREMENT);
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

/** A statement expected to fail: its SQLSTATE (a savepoint keeps the transaction usable). */
async function sqlState(tx: Transaction, sql: string, params: unknown[] = []) {
  await tx.exec("savepoint expected_error");
  try {
    await tx.query(sql, params);
  } catch (error) {
    await tx.exec("rollback to savepoint expected_error");
    return (error as { code?: string }).code;
  }
  throw new Error(`expected statement to fail: ${sql}`);
}

async function version(tx: Transaction, orgId: string): Promise<string> {
  const { rows } = await tx.query<{ v: string }>(
    "select to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as v from public.organizations where id = $1",
    [orgId],
  );
  return rows[0]!.v;
}

const UPDATE = `select public.update_organization_profile($1, $2, $3, $4::public.organization_type, $5, $6, $7) as v`;
const REVIEW = "select * from public.review_organization($1, $2, $3, $4)";

/** The «Organización» save as the organization's admin; returns the new version. */
async function saveAsAdmin(
  tx: Transaction,
  admin: string,
  orgId: string,
  fields: Partial<{
    name: string;
    type: string;
    country: string;
    taxId: string;
    taxAddress: string;
  }>,
) {
  await actAs(tx, null);
  await tx.exec("reset role");
  const { rows } = await tx.query<{
    name: string;
    type: string;
    country: string;
    tax_id: string | null;
    tax_address: string | null;
  }>("select name, type, country, tax_id, tax_address from public.organizations where id = $1", [
    orgId,
  ]);
  const current = rows[0]!;
  const v = await version(tx, orgId);
  await actAs(tx, admin);
  await tx.query(UPDATE, [
    orgId,
    v,
    fields.name ?? current.name,
    fields.type ?? current.type,
    fields.country ?? current.country,
    fields.taxId ?? current.tax_id ?? "PT500000000",
    fields.taxAddress ?? current.tax_address ?? "Rua Ficticia 1, Lisboa",
  ]);
}

async function reviewState(tx: Transaction, orgId: string) {
  await tx.exec("reset role");
  const { rows } = await tx.query<{ review_status: string; reviewed_at: Date | null }>(
    "select review_status, reviewed_at from public.organizations where id = $1",
    [orgId],
  );
  return rows[0]!;
}

describe("organization data («Organización», migration 20261023500100)", () => {
  it("every existing organization starts pending; only Demo MRO Madrid has seed fiscal data", async () => {
    const { rows } = await db.query<{ name: string; review_status: string; complete: boolean }>(
      `select name, review_status, (tax_id is not null and tax_address is not null) as complete
       from public.organizations order by name`,
    );
    expect(rows.every((r) => r.review_status === "pending")).toBe(true);
    expect(rows.filter((r) => r.complete).map((r) => r.name)).toEqual(["Demo MRO Madrid"]);
  });

  it("the organization admin saves through the INVOKER RPC; the change is audited by field name", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const v = await version(tx, mroId);
      await actAs(tx, SEED.adminMro);
      const { rows } = await tx.query<{ v: Date }>(UPDATE, [
        mroId,
        v,
        "  Demo MRO Madrid  ",
        "mro",
        "es",
        "ESB00000000",
        "Calle Ficticia 2, 28042 Madrid",
      ]);
      expect(rows[0]!.v.toISOString()).not.toBe(v);
      const org = await tx.query<{ name: string; country: string; tax_address: string }>(
        "select name, country, tax_address from public.organizations where id = $1",
        [mroId],
      );
      expect(org.rows[0]).toEqual({
        name: "Demo MRO Madrid",
        country: "ES",
        tax_address: "Calle Ficticia 2, 28042 Madrid",
      });
      // The organization admin reads its own trail (RLS audit_events_select): names and flags only.
      const audit = await tx.query<{ actor_profile_id: string; metadata: object }>(
        "select actor_profile_id, metadata from public.audit_events where entity_id = $1 and action = 'organization.updated' and actor_profile_id is not null",
        [mroId],
      );
      expect(audit.rows).toEqual([
        {
          actor_profile_id: SEED.adminMro,
          metadata: { fields: ["tax_address"], review_reset: false },
        },
      ]);
    });
  });

  it("a save that changes nothing writes nothing (same version, no audit row)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const v = await version(tx, mroId);
      await actAs(tx, SEED.adminMro);
      const { rows } = await tx.query<{ v: Date }>(UPDATE, [
        mroId,
        v,
        "Demo MRO Madrid",
        "mro",
        "ES",
        "ESB00000000",
        "Calle Ficticia 1, 28042 Madrid",
      ]);
      expect(rows[0]!.v.toISOString()).toBe(v);
      const audit = await tx.query(
        "select 1 from public.audit_events where entity_id = $1 and actor_profile_id = $2",
        [mroId, SEED.adminMro],
      );
      expect(audit.rows).toHaveLength(0);
    });
  });

  it("stale version → CF412; missing version or invalid data → 22023; nothing is written", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const v = await version(tx, mroId);
      await actAs(tx, SEED.adminMro);
      const args = (over: Partial<Record<number, unknown>>) =>
        [mroId, v, "Demo MRO Madrid", "mro", "ES", "ESB00000000", "Calle 1"].map((a, i) =>
          i in over ? over[i] : a,
        );
      expect(await sqlState(tx, UPDATE, args({ 1: "2020-01-01T00:00:00.000Z" }))).toBe("CF412");
      expect(await sqlState(tx, UPDATE, args({ 1: null }))).toBe("22023");
      expect(await sqlState(tx, UPDATE, args({ 2: "X" }))).toBe("22023");
      expect(await sqlState(tx, UPDATE, args({ 4: "Spain" }))).toBe("22023");
      expect(await sqlState(tx, UPDATE, args({ 5: "   " }))).toBe("22023");
      expect(await sqlState(tx, UPDATE, args({ 6: "x".repeat(401) }))).toBe("22023");
      expect(await version(tx, mroId)).toBe(v);
    });
  });

  it("managers, plain members, other organizations, professionals and random ids get the same 42501", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const v = await version(tx, mroId);
      const args = [mroId, v, "Hijacked", "mro", "ES", "X1", "Y1"];
      for (const user of [SEED.managerMro, SEED.charlieMember, SEED.adminOther, SEED.delta]) {
        await actAs(tx, user);
        expect(await sqlState(tx, UPDATE, args), user).toBe("42501");
      }
      await actAs(tx, SEED.adminMro);
      expect(
        await sqlState(tx, UPDATE, ["00000000-0000-4000-8000-00000000dead", ...args.slice(1)]),
      ).toBe("42501");
      await actAs(tx, null);
      expect(await sqlState(tx, UPDATE, args)).toBe("42501"); // anon: no EXECUTE
      expect((await reviewState(tx, mroId)).review_status).toBe("pending");
      await tx.exec("reset role");
      const { rows } = await tx.query("select 1 from public.organizations where name = 'Hijacked'");
      expect(rows).toHaveLength(0);
    });
  });

  it("nobody but review_organization() can write review_status / reviewed_at (no column grant)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      for (const sql of [
        "update public.organizations set review_status = 'reviewed', reviewed_at = now() where id = $1",
        "update public.organizations set reviewed_at = now() where id = $1",
      ]) {
        expect(await sqlState(tx, sql, [mroId])).toBe("42501");
      }
      await actAs(tx, SEED.platformAdmin);
      expect(
        await sqlState(
          tx,
          "update public.organizations set review_status = 'reviewed' where id = $1",
          [mroId],
        ),
      ).toBe("42501");
      for (const sql of [
        "insert into public.organization_reviews (organization_id, note, organization_version) values ($1, 'x', now())",
        "delete from public.organization_reviews where organization_id = $1",
      ]) {
        expect(await sqlState(tx, sql, [mroId])).toBe("42501");
      }
    });
  });

  it("members read the review state; other organizations still cannot read the row", async () => {
    await asUser(db, SEED.charlieMember, async (tx) => {
      const { rows } = await tx.query<{ review_status: string; tax_id: string }>(
        "select review_status, tax_id from public.organizations where id = $1",
        [mroId],
      );
      expect(rows).toEqual([{ review_status: "pending", tax_id: "ESB00000000" }]);
    });
    await asUser(db, SEED.adminOther, async (tx) => {
      const { rows } = await tx.query("select 1 from public.organizations where id = $1", [mroId]);
      expect(rows).toHaveLength(0);
    });
  });
});

describe("organization review by a platform admin (review_organization)", () => {
  it("registers the review with evidence: status, evidence row, audit without note or organization id", async () => {
    await asUser(db, SEED.platformAdmin, async (tx) => {
      const v = await version(tx, mroId);
      await actAs(tx, SEED.platformAdmin);
      const requestId = "7d1f5a2e-0000-4000-8000-000000000001";
      const { rows } = await tx.query<{ id: string; review_status: string; reviewed_at: Date }>(
        REVIEW,
        [mroId, v, "  Registro mercantil consultado (ficticio)  ", requestId],
      );
      expect(rows[0]).toMatchObject({ id: mroId, review_status: "reviewed" });
      expect(rows[0]!.reviewed_at).toBeInstanceOf(Date);
      const evidence = await tx.query<{ reviewed_by: string; note: string; v: Date }>(
        "select reviewed_by, note, organization_version as v from public.organization_reviews where organization_id = $1",
        [mroId],
      );
      expect(evidence.rows).toHaveLength(1);
      expect(evidence.rows[0]).toMatchObject({
        reviewed_by: SEED.platformAdmin,
        note: "Registro mercantil consultado (ficticio)",
      });
      expect(evidence.rows[0]!.v.toISOString()).toBe(v);
      const audit = await tx.query<{ organization_id: string | null; metadata: object }>(
        "select organization_id, metadata from public.audit_events where entity_id = $1 and action = 'organization.reviewed'",
        [mroId],
      );
      expect(audit.rows).toEqual([
        {
          organization_id: null,
          metadata: {
            previous_review_status: "pending",
            review_status: "reviewed",
            note_provided: true,
            request_id: requestId,
          },
        },
      ]);
      // The organization sees the status, never the evidence nor the reviewer's audit row.
      await actAs(tx, SEED.adminMro);
      expect(
        (
          await tx.query("select 1 from public.organization_reviews where organization_id = $1", [
            mroId,
          ])
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await tx.query(
            "select 1 from public.audit_events where entity_id = $1 and action = 'organization.reviewed'",
            [mroId],
          )
        ).rows,
      ).toHaveLength(0);
      const own = await tx.query<{ review_status: string }>(
        "select review_status from public.organizations where id = $1",
        [mroId],
      );
      expect(own.rows[0]!.review_status).toBe("reviewed");
    });
  });

  it("refuses: no evidence (22023), stale version or already reviewed (55000), incomplete data (55000)", async () => {
    await asUser(db, SEED.platformAdmin, async (tx) => {
      const v = await version(tx, mroId);
      await actAs(tx, SEED.platformAdmin);
      expect(await sqlState(tx, REVIEW, [mroId, v, "   ", null])).toBe("22023");
      expect(await sqlState(tx, REVIEW, [mroId, v, "x".repeat(2001), null])).toBe("22023");
      expect(await sqlState(tx, REVIEW, [mroId, "2020-01-01T00:00:00Z", "ok", null])).toBe("55000");
      // Lisbon has no fiscal data yet (organizations created at sign-up carry none).
      const lisbon = await version(tx, otherOrgId);
      await actAs(tx, SEED.platformAdmin);
      expect(await sqlState(tx, REVIEW, [otherOrgId, lisbon, "ok", null])).toBe("55000");
      await tx.query(REVIEW, [mroId, v, "ok", null]);
      const again = await version(tx, mroId);
      await actAs(tx, SEED.platformAdmin);
      expect(await sqlState(tx, REVIEW, [mroId, again, "ok", null])).toBe("55000");
      expect(
        await sqlState(tx, REVIEW, ["00000000-0000-4000-8000-00000000dead", v, "ok", null]),
      ).toBe("P0002");
    });
  });

  it("nobody reviews their own organization: the platform admin of «CrewFlex Operaciones» gets 42501", async () => {
    await asUser(db, SEED.platformAdmin, async (tx) => {
      await saveAsAdmin(tx, SEED.platformAdmin, crewflexOrgId, {
        taxId: "ESB11111111",
        taxAddress: "Calle Ficticia 3, Madrid",
      });
      const v = await version(tx, crewflexOrgId);
      await actAs(tx, SEED.platformAdmin);
      expect(await sqlState(tx, REVIEW, [crewflexOrgId, v, "self", null])).toBe("42501");
      expect((await reviewState(tx, crewflexOrgId)).review_status).toBe("pending");
    });
  });

  it("organization roles and professionals cannot review (42501); anon has no EXECUTE", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const v = await version(tx, mroId);
      for (const user of [SEED.adminMro, SEED.managerMro, SEED.adminOther, SEED.delta]) {
        await actAs(tx, user);
        expect(await sqlState(tx, REVIEW, [mroId, v, "self-verify", null]), user).toBe("42501");
      }
      await actAs(tx, null);
      expect(await sqlState(tx, REVIEW, [mroId, v, "x", null])).toBe("42501");
      expect((await reviewState(tx, mroId)).review_status).toBe("pending");
    });
  });

  it("changing any datum of a reviewed organization sends it back to pending, whatever the path", async () => {
    await asUser(db, SEED.platformAdmin, async (tx) => {
      const v = await version(tx, mroId);
      await actAs(tx, SEED.platformAdmin);
      await tx.query(REVIEW, [mroId, v, "ok", null]);
      // through the RPC
      await saveAsAdmin(tx, SEED.adminMro, mroId, { taxAddress: "Calle Ficticia 9, Madrid" });
      expect(await reviewState(tx, mroId)).toEqual({ review_status: "pending", reviewed_at: null });
      const audit = await tx.query<{ metadata: { review_reset: boolean } }>(
        "select metadata from public.audit_events where entity_id = $1 and action = 'organization.updated' and actor_profile_id = $2",
        [mroId, SEED.adminMro],
      );
      expect(audit.rows.map((r) => r.metadata)).toEqual([
        { fields: ["tax_address"], review_reset: true },
      ]);
      // and through a direct PostgREST update of a granted column
      await actAs(tx, SEED.platformAdmin);
      await tx.query(REVIEW, [mroId, await version(tx, mroId), "ok", null]);
      expect((await reviewState(tx, mroId)).review_status).toBe("reviewed");
      await actAs(tx, SEED.adminMro);
      await tx.query("update public.organizations set type = 'airline' where id = $1", [mroId]);
      expect((await reviewState(tx, mroId)).review_status).toBe("pending");
    });
  });
});

/** The external pool's members (profile ids) for a requirement, read as the owner. */
async function externalPool(tx: Transaction, requirementId: string): Promise<Set<string>> {
  await tx.exec("reset role");
  const { rows } = await tx.query<{ profile_id: string }>(
    "select profile_id from app_private.ranked_external_pool($1)",
    [requirementId],
  );
  return new Set(rows.map((r) => r.profile_id));
}

const pseudonym = (requirementId: string, profileId: string) =>
  "CF-" +
  createHash("sha256")
    .update(`${requirementId}:${profileId}`)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();

describe("«Empresas verificadas» in the external pool (BR-8, migrations 20261023500000/500200)", () => {
  it("a verified_orgs professional is invisible to an unreviewed organization and pseudonymous to a reviewed one", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      await tx.exec("reset role");
      // Hotel is the seed's private professional with the full B1.1/A320 set; Delta is anonymous.
      await tx.query(
        "update public.technician_profiles set visibility = 'verified_orgs' where profile_id = any($1::uuid[])",
        [[SEED.hotelPrivate, SEED.delta]],
      );
      const pending = await externalPool(tx, madRequirementId);
      expect(pending.has(SEED.hotelPrivate)).toBe(false);
      expect(pending.has(SEED.delta)).toBe(false);

      await tx.query(
        "update public.organizations set review_status = 'reviewed', reviewed_at = now() where id = $1",
        [mroId],
      );
      const reviewed = await externalPool(tx, madRequirementId);
      expect(reviewed.has(SEED.hotelPrivate)).toBe(true);
      expect(reviewed.has(SEED.delta)).toBe(true);
      expect(reviewed.size).toBe(pending.size + 2);

      await actAs(tx, SEED.managerMro);
      const { rows } = await tx.query<{
        candidate_ref: string;
        candidate_pool: string;
        candidate_display_name: string | null;
      }>(
        "select candidate_ref, candidate_pool, candidate_display_name from public.get_requirement_candidate_pool($1)",
        [madRequirementId],
      );
      for (const id of [SEED.hotelPrivate, SEED.delta]) {
        const row = rows.find((r) => r.candidate_ref === pseudonym(madRequirementId, id));
        expect(row, id).toMatchObject({ candidate_pool: "external", candidate_display_name: null });
        expect(rows.some((r) => r.candidate_ref === id)).toBe(false);
      }
      const summary = await tx.query<{ prefiltered: number }>(
        "select prefiltered from public.get_requirement_external_pool_summary($1)",
        [madRequirementId],
      );
      expect(summary.rows[0]!.prefiltered).toBe(reviewed.size);
    });
  });

  it("parity: pool membership = isExternallyMatchable(visibility, review status) for every combination", async () => {
    const ids = PROFILE_VISIBILITIES.map(
      (_, i) => `00000000-0000-4000-9500-${String(i).padStart(12, "0")}`,
    );
    await asUser(db, SEED.managerMro, async (tx) => {
      await tx.exec("reset role");
      await tx.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         select id, 'vo-' || id || '@crewflex.test', '{"account_type":"professional","display_name":"Visibility"}'
         from unnest($1::uuid[]) id`,
        [ids],
      );
      await tx.query(
        `update public.technician_profiles tp set visibility = v.visibility::public.profile_visibility
         from unnest($1::uuid[], $2::text[]) as v(id, visibility) where tp.profile_id = v.id`,
        [ids, [...PROFILE_VISIBILITIES]],
      );
      await tx.query(
        `insert into public.technician_qualifications (technician_profile_id, qualification_type_id, expires_at)
         select p, qt.id, date '2030-01-01' from unnest($1::uuid[]) p, public.qualification_types qt
         where qt.code = 'SMS'`,
        [ids],
      );
      let compared = 0;
      for (const status of ["pending", "reviewed"] as OrganizationReviewStatus[]) {
        await tx.query(
          `update public.organizations set review_status = $2::public.organization_review_status,
             reviewed_at = case when $2::text = 'reviewed' then now() end where id = $1`,
          [mroId, status],
        );
        const pool = await externalPool(tx, madRequirementId);
        PROFILE_VISIBILITIES.forEach((visibility: ProfileVisibility, i) => {
          expect([status, visibility, pool.has(ids[i]!)]).toEqual([
            status,
            visibility,
            isExternallyMatchable(visibility, status),
          ]);
          compared++;
        });
      }
      expect(compared).toBe(8);
    });
  });

  it("members stay in the internal pool whatever their visibility; the passport RPC accepts the new value", async () => {
    await asUser(db, SEED.alpha, async (tx) => {
      await tx.query(
        `select public.update_professional_profile('Technician Alpha', null, 'national', null,
           'employed', 'verified_orgs', null)`,
      );
      const { rows } = await tx.query<{ visibility: string }>(
        "select visibility from public.technician_profiles where profile_id = $1",
        [SEED.alpha],
      );
      expect(rows[0]!.visibility).toBe("verified_orgs");
      await actAs(tx, SEED.managerMro);
      const pool = await tx.query<{ candidate_ref: string; candidate_pool: string }>(
        "select candidate_ref, candidate_pool from public.get_requirement_candidate_pool($1)",
        [madRequirementId],
      );
      expect(pool.rows).toContainEqual({ candidate_ref: SEED.alpha, candidate_pool: "internal" });
    });
  });
});

interface Summary {
  technicians: number;
  organizations: number;
  active_requirements: number;
  working_now: number;
  aog_with_vacancies: number;
  demand: { code: string | null; seats: number }[];
}

async function summary(tx: Transaction): Promise<Summary> {
  await actAs(tx, SEED.platformAdmin);
  const { rows } = await tx.query<Summary>("select * from public.get_platform_summary()");
  return rows[0]!;
}

const seats = (s: Summary, code: string | null) =>
  s.demand.find((d) => d.code === code)?.seats ?? 0;

/** Owner-side fixture: an AOG need already started (v1.8 dropped those by accident). */
async function aogNeed(tx: Transaction, headcount: number, licence: boolean) {
  await tx.exec("reset role");
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.work_requirements
       (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
     values ($1, 'Summary fixture', 'Madrid (MAD)', now() - interval '1 day', now() + interval '2 days',
             'day', $2, 'aog', 'open', $3) returning id`,
    [mroId, headcount, SEED.adminMro],
  );
  const id = rows[0]!.id;
  await tx.query(
    `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
     select $1, id, 'hard' from public.qualification_types where code = any($2::text[])`,
    [id, licence ? ["B1.1", "TR-A320"] : ["TR-A320"]],
  );
  return id;
}

/** A confirmed application, written as the owner (the state machine itself is tested in rls V). */
async function confirmedApplication(tx: Transaction, requirementId: string, technician: string) {
  await tx.exec("reset role");
  const app = await tx.query<{ id: string }>(
    "insert into public.applications (requirement_id, technician_profile_id) values ($1, $2) returning id",
    [requirementId, technician],
  );
  const id = app.rows[0]!.id;
  const proposal = await tx.query<{ id: string }>(
    "insert into public.application_proposals (application_id, version, terms) values ($1, 1, '{}') returning id",
    [id],
  );
  await tx.query(
    "update public.applications set status = 'confirmed', current_proposal_id = $2, accepted_proposal_id = $2 where id = $1",
    [id, proposal.rows[0]!.id],
  );
}

describe("platform figures (get_platform_summary, migration 20261023500300)", () => {
  it("counts accounts and organizations, no money and no identities", async () => {
    await asUser(db, SEED.platformAdmin, async (tx) => {
      const s = await summary(tx);
      await tx.exec("reset role");
      const expected = await tx.query<{ t: number; o: number }>(
        `select (select count(*)::int from public.profiles where account_type = 'professional') as t,
                (select count(*)::int from public.organizations) as o`,
      );
      expect(s.technicians).toBe(expected.rows[0]!.t);
      expect(s.organizations).toBe(expected.rows[0]!.o);
      expect(Object.keys(s).sort()).toEqual(
        [
          "active_requirements",
          "aog_with_vacancies",
          "demand",
          "organizations",
          "technicians",
          "working_now",
        ].sort(),
      );
    });
  });

  it("an AOG need already under way still counts; seats = headcount − confirmed per hard licence; paused and ended needs do not", async () => {
    await asUser(db, SEED.platformAdmin, async (tx) => {
      const before = await summary(tx);
      const withLicence = await aogNeed(tx, 3, true);
      await aogNeed(tx, 2, false);
      await confirmedApplication(tx, withLicence, SEED.delta);
      const after = await summary(tx);
      expect(after.active_requirements - before.active_requirements).toBe(2);
      expect(after.aog_with_vacancies - before.aog_with_vacancies).toBe(2);
      expect(seats(after, "B1.1") - seats(before, "B1.1")).toBe(2);
      expect(seats(after, null) - seats(before, null)).toBe(2);
      expect(after.working_now - before.working_now).toBe(1);

      await tx.exec("reset role");
      await tx.query("update public.work_requirements set status = 'paused' where id = $1", [
        withLicence,
      ]);
      const paused = await summary(tx);
      expect(paused.active_requirements - before.active_requirements).toBe(1);
      expect(seats(paused, "B1.1")).toBe(seats(before, "B1.1"));
      // still working: the assignment is confirmed and its period contains now()
      expect(paused.working_now - before.working_now).toBe(1);
    });
  });

  it("is for platform admins only: organization roles and professionals get 42501, anon has no EXECUTE", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      for (const user of [SEED.adminMro, SEED.managerMro, SEED.delta]) {
        await actAs(tx, user);
        expect(await sqlState(tx, "select * from public.get_platform_summary()"), user).toBe(
          "42501",
        );
      }
      await actAs(tx, null);
      expect(await sqlState(tx, "select * from public.get_platform_summary()")).toBe("42501");
    });
  });
});

describe("audit view (ADM-02 #17): the existing read policy", () => {
  it("the platform admin pages through every row, newest first; organization admins see only their own; professionals none", async () => {
    await asUser(db, SEED.platformAdmin, async (tx) => {
      await tx.exec("reset role");
      const total = (
        await tx.query<{ n: number }>("select count(*)::int as n from public.audit_events")
      ).rows[0]!.n;
      await actAs(tx, SEED.platformAdmin);
      const page = await tx.query<{ id: string; created_at: Date }>(
        "select id, created_at from public.audit_events order by created_at desc, id desc limit 50 offset 0",
      );
      const all = await tx.query("select 1 from public.audit_events");
      expect(all.rows).toHaveLength(total);
      expect(page.rows.length).toBe(Math.min(50, total));
      const times = page.rows.map((r) => r.created_at.getTime());
      expect([...times].sort((a, b) => b - a)).toEqual(times);

      await actAs(tx, SEED.adminMro);
      const org = await tx.query<{ organization_id: string | null }>(
        "select organization_id from public.audit_events",
      );
      expect(org.rows.every((r) => r.organization_id === mroId)).toBe(true);
      await actAs(tx, SEED.managerMro);
      expect((await tx.query("select 1 from public.audit_events")).rows).toHaveLength(0);
      await actAs(tx, SEED.delta);
      expect((await tx.query("select 1 from public.audit_events")).rows).toHaveLength(0);
    });
  });
});
