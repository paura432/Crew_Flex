// Package recruiter (v2 diff area 30: v2-24 «Espacio recruiter con clientes»; area 10 task 17; D-12 provisional
// model, docs/product/RECRUITER_MODEL.md; BUSINESS_RULES BR-27, T-130…T-136). Migrations 20261024500000
// (represented_clients, RPCs) and 20261024500100 (requirements on behalf of a client, list_opportunities).
// Every case runs in a rolled-back transaction; the BR-1.4 commit-time check is fired with `commitCheck`.
import { randomUUID } from "node:crypto";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, orgIdByName, SEED } from "./harness";

let db: PGlite;
let mroId: string;
let agencyId: string; // Demo Aero Services Lisbon, turned into a staffing agency per test
let otherAgencyId: string; // Demo Airline Ops Barcelona, the «other agency» when a test needs one

beforeAll(async () => {
  db = await createTestDatabase();
  mroId = await orgIdByName(db, "Demo MRO Madrid");
  agencyId = await orgIdByName(db, "Demo Aero Services Lisbon");
  otherAgencyId = await orgIdByName(db, "Demo Airline Ops Barcelona");
});

afterAll(async () => {
  await db.close();
});

/** The agency's plain member (Lima, seed workforce of Lisbon) and a manager added per test (Kilo, seed account). */
const AGENCY_MEMBER = SEED.lima;
const AGENCY_MANAGER = "00000000-0000-4000-8000-000000000041";

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
    const e = error as { code?: string; message: string };
    return { code: e.code, message: e.message };
  }
  await tx.exec("release savepoint expected_error");
  throw new Error(`expected statement to fail: ${sql}`);
}

/**
 * Fires the existing commit-time checks (BR-1.4) now, as COMMIT would, then defers them again: `set constraints all
 * immediate` lasts for the rest of the transaction and would fire them inside the next RPC, between its statements.
 */
async function commitCheck(tx: Transaction) {
  await tx.exec("set constraints all immediate");
  await tx.exec("set constraints all deferred");
}

/** Owner-side: Lisbon becomes an agency and gets a manager; optionally Barcelona becomes one too. */
async function setUpAgency(tx: Transaction, { second = false } = {}) {
  await tx.exec("reset role");
  // Owner-side writes without a JWT subject (the harness keeps the test user's claim; the triggers' role checks
  // would otherwise judge the seed updates as that user).
  await tx.query("select set_config('request.jwt.claims', '', true)");
  const orgs = second ? [agencyId, otherAgencyId] : [agencyId];
  // The seed organizations publish without a client: paused first (MEDIUM-1 guard), as the smoke does.
  await tx.query(
    "update public.work_requirements set status = 'paused' where organization_id = any($1) and status = 'open'",
    [orgs],
  );
  await tx.query("update public.organizations set type = 'staffing_agency' where id = any($1)", [
    orgs,
  ]);
  await tx.query(
    "insert into public.organization_members (organization_id, profile_id, role) values ($1, $2, 'manager')",
    [agencyId, AGENCY_MANAGER],
  );
}

const ADD = "select * from public.add_represented_client($1, $2, $3)";

async function addClient(tx: Transaction, user: string, org: string, name: string, email?: string) {
  await actAs(tx, user);
  return (await tx.query<{ id: string; status: string }>(ADD, [org, name, email ?? null])).rows[0]!;
}

async function activate(tx: Transaction, clientId: string, note = "Framework contract ref. FX-1") {
  await actAs(tx, SEED.platformAdmin);
  return (
    await tx.query<{ status: string }>("select * from public.activate_represented_client($1, $2)", [
      clientId,
      note,
    ])
  ).rows[0]!;
}

/** An active client of the agency (added by its admin, activated by the platform admin). */
async function activeClient(tx: Transaction, name = "Operador cliente 1", org = agencyId) {
  const admin = org === agencyId ? SEED.adminOther : SEED.adminAirline;
  const { id } = await addClient(tx, admin, org, name, "ops@client.test");
  await activate(tx, id);
  return id;
}

const QUALS = async (tx: Transaction) =>
  JSON.stringify(
    (
      await tx.query<{ id: string; code: string }>(
        "select id, code from public.qualification_types where code in ('B1.1', 'TR-A320')",
      )
    ).rows.map((q) => ({ qualification_type_id: q.id, requirement_level: "hard" })),
  );

const CREATE = `select * from public.create_work_requirement_idempotent(
  $1, $2, 'Recruiter fixture', 'Madrid (MAD)', now() + interval '5 days', now() + interval '8 days', 'day', 1,
  'planned', $3::jsonb, $4::public.requirement_status, 'ES', 'Europe/Madrid', null, null, null, $5)`;

/** Create through the client overload (17 arguments), as the Edge Function does. */
async function createAs(
  tx: Transaction,
  user: string,
  org: string,
  { status = "open", client = null as string | null } = {},
) {
  await tx.exec("reset role");
  const quals = await QUALS(tx);
  await actAs(tx, user);
  return (await tx.query<{ id: string }>(CREATE, [randomUUID(), org, quals, status, client]))
    .rows[0]!.id;
}

const UPDATE = `select * from public.update_work_requirement(
  $1, $2, 'Recruiter fixture', 'Madrid (MAD)', $3, $4, 'day', 1, 'planned', $5::jsonb,
  $6::public.requirement_status, 'ES', 'Europe/Madrid', null, null, null, $7)`;

async function updateAs(
  tx: Transaction,
  user: string,
  id: string,
  {
    client,
    status = null as string | null,
    expected,
  }: { client: string | null; status?: string | null; expected?: string },
) {
  await tx.exec("reset role");
  const row = (
    await tx.query<{ updated_at: string; starts_at: string; ends_at: string }>(
      "select updated_at, starts_at, ends_at from public.work_requirements where id = $1",
      [id],
    )
  ).rows[0]!;
  const quals = await QUALS(tx);
  await actAs(tx, user);
  return [
    UPDATE,
    [id, expected ?? row.updated_at, row.starts_at, row.ends_at, quals, status, client],
  ] as const;
}

async function makeAvailable(tx: Transaction, profiles: string[]) {
  await tx.exec("reset role");
  await tx.query(
    `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
     select p, now() - interval '30 days', now() + interval '120 days', 'available' from unnest($1::uuid[]) p`,
    [profiles],
  );
}

const APPLY = "select * from public.apply_to_requirement($1, $2, true)";

async function transition(
  tx: Transaction,
  user: string,
  applicationId: string,
  to: string,
  reason: string | null = null,
) {
  await tx.exec("reset role");
  const { updated_at, current_proposal_id } = (
    await tx.query<{ updated_at: string; current_proposal_id: string | null }>(
      "select updated_at, current_proposal_id from public.applications where id = $1",
      [applicationId],
    )
  ).rows[0]!;
  await actAs(tx, user);
  return [
    "select * from public.transition_application($1, $2, $3, $4, $5, $6)",
    [
      applicationId,
      to,
      updated_at,
      randomUUID(),
      reason,
      to === "accepted" ? current_proposal_id : null,
    ],
  ] as const;
}

const audit = async (tx: Transaction, action: string, entity: string) => {
  await tx.exec("reset role");
  return (
    await tx.query<{
      organization_id: string | null;
      actor_profile_id: string | null;
      metadata: Record<string, unknown>;
    }>(
      "select organization_id, actor_profile_id, metadata from public.audit_events where action = $1 and entity_id = $2",
      [action, entity],
    )
  ).rows;
};

describe("represented clients: portfolio of an agency (20261024500000)", () => {
  it("an admin or manager of a staffing agency adds a client, pending; audited with the agency", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx);
      const first = await addClient(
        tx,
        SEED.adminOther,
        agencyId,
        "  Operador cliente 1 ",
        "OPS@Client.test ",
      );
      expect(first.status).toBe("pending");
      const second = await addClient(tx, AGENCY_MANAGER, agencyId, "Operador cliente 2");
      await tx.exec("reset role");
      const rows = (
        await tx.query(
          "select name, contact_email, created_by, activated_at from public.represented_clients where id = any($1) order by name",
          [[first.id, second.id]],
        )
      ).rows;
      expect(rows).toEqual([
        {
          name: "Operador cliente 1",
          contact_email: "ops@client.test",
          created_by: SEED.adminOther,
          activated_at: null,
        },
        {
          name: "Operador cliente 2",
          contact_email: null,
          created_by: AGENCY_MANAGER,
          activated_at: null,
        },
      ]);
      const [event] = await audit(tx, "client.added", first.id);
      expect(event).toMatchObject({ organization_id: agencyId, actor_profile_id: SEED.adminOther });
      expect(event!.metadata).toMatchObject({ client_id: first.id, email_provided: true });
      expect(JSON.stringify(event!.metadata)).not.toContain("ops@client.test");
    });
  });

  it("refused: a plain member, a non-agency organization, another organization, a professional, anon", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx, { second: true });
      for (const [user, org] of [
        [AGENCY_MEMBER, agencyId], // plain member of the agency
        [SEED.adminMro, mroId], // admin of an MRO (not an agency)
        [SEED.adminAirline, agencyId], // admin of ANOTHER agency
        [SEED.delta, agencyId], // professional
        [SEED.platformAdmin, agencyId], // platform admins do not add clients for an agency
      ] as const) {
        await actAs(tx, user);
        expect((await sqlError(tx, ADD, [org, "Cliente QA", null])).code, user).toBe("42501");
      }
      await actAs(tx, null);
      expect((await sqlError(tx, ADD, [agencyId, "Cliente QA", null])).message).toMatch(
        /permission denied/,
      );
    });
  });

  it("reads: every member of the agency and platform admins; never another organization, a professional or anon", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx, { second: true });
      const { id } = await addClient(
        tx,
        SEED.adminOther,
        agencyId,
        "Operador cliente 1",
        "ops@client.test",
      );
      const visible = async (user: string) => {
        await actAs(tx, user);
        return (await tx.query("select id from public.represented_clients where id = $1", [id]))
          .rows.length;
      };
      const LIST = "select contact_email from public.list_represented_clients($1)";
      for (const user of [SEED.adminOther, AGENCY_MANAGER, AGENCY_MEMBER, SEED.platformAdmin])
        expect(await visible(user), user).toBe(1);
      // The contact e-mail (security review LOW-4): no column grant; admins/managers and platform admins read
      // it through list_represented_clients, a plain member gets null, anyone else 42501.
      await actAs(tx, AGENCY_MEMBER);
      expect(
        (
          await sqlError(tx, "select contact_email from public.represented_clients where id = $1", [
            id,
          ])
        ).message,
      ).toMatch(/permission denied/);
      expect((await tx.query<{ contact_email: string | null }>(LIST, [agencyId])).rows).toEqual([
        { contact_email: null },
      ]);
      for (const user of [SEED.adminOther, AGENCY_MANAGER, SEED.platformAdmin]) {
        await actAs(tx, user);
        expect(
          (await tx.query<{ contact_email: string | null }>(LIST, [agencyId])).rows,
          user,
        ).toEqual([{ contact_email: "ops@client.test" }]);
      }
      for (const user of [SEED.adminAirline, SEED.delta]) {
        await actAs(tx, user);
        expect((await sqlError(tx, LIST, [agencyId])).code, user).toBe("42501");
        expect(
          (await sqlError(tx, "select * from public.list_representation_reviews()")).code,
          user,
        ).toBe("42501");
      }
      await actAs(tx, SEED.platformAdmin);
      const review = (
        await tx.query<{ agency_name: string; name: string }>(
          "select agency_name, name from public.list_representation_reviews() where id = $1",
          [id],
        )
      ).rows;
      expect(review).toEqual([
        { agency_name: "Demo Aero Services Lisbon", name: "Operador cliente 1" },
      ]);
      for (const user of [
        SEED.adminAirline,
        SEED.adminMro,
        SEED.charlieMember,
        SEED.delta,
        SEED.hotelPrivate,
      ])
        expect(await visible(user), user).toBe(0);
      await actAs(tx, null);
      expect((await sqlError(tx, "select id from public.represented_clients")).message).toMatch(
        /permission denied/,
      );
    });
  });

  it("no direct writes, not even by the agency's admin (RPCs only)", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx);
      const { id } = await addClient(tx, SEED.adminOther, agencyId, "Operador cliente 1");
      await actAs(tx, SEED.adminOther);
      for (const sql of [
        `insert into public.represented_clients (agency_id, name, status, activated_at) values ('${agencyId}', 'Self', 'active', now())`,
        `update public.represented_clients set status = 'active', activated_at = now() where id = '${id}'`,
        `delete from public.represented_clients where id = '${id}'`,
        `insert into public.represented_client_reviews (client_id, note) values ('${id}', 'self')`,
      ])
        expect((await sqlError(tx, sql)).message, sql).toMatch(/permission denied/);
    });
  });

  it("validation: name 2-120, a valid e-mail, one live client per name (revoked ones may come back), caps 50 pending / 200 live", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx);
      await actAs(tx, SEED.adminOther);
      expect((await sqlError(tx, ADD, [agencyId, " x ", null])).code).toBe("22023");
      expect((await sqlError(tx, ADD, [agencyId, "y".repeat(121), null])).code).toBe("22023");
      expect((await sqlError(tx, ADD, [agencyId, "Cliente QA", "not-an-email"])).code).toBe(
        "22023",
      );
      const { id } = await addClient(tx, SEED.adminOther, agencyId, "Cliente QA");
      expect((await sqlError(tx, ADD, [agencyId, "cliente qa", null])).code).toBe("23505");
      await tx.query("select * from public.revoke_represented_client($1)", [id]);
      expect((await addClient(tx, SEED.adminOther, agencyId, "Cliente QA")).status).toBe("pending");

      await tx.exec("reset role");
      await tx.query(
        `insert into public.represented_clients (agency_id, name)
         select $1, 'Bulk ' || g from generate_series(1, 49) g`,
        [agencyId],
      );
      await actAs(tx, SEED.adminOther);
      expect((await sqlError(tx, ADD, [agencyId, "One pending too many", null])).code).toBe(
        "55000",
      );
      await tx.exec("reset role");
      await tx.query(
        "update public.represented_clients set status = 'active', activated_at = now() where agency_id = $1 and status = 'pending'",
        [agencyId],
      );
      await tx.query(
        `insert into public.represented_clients (agency_id, name, status, activated_at)
         select $1, 'Bulk active ' || g, 'active', now() from generate_series(1, 150) g`,
        [agencyId],
      );
      await actAs(tx, SEED.adminOther);
      expect((await sqlError(tx, ADD, [agencyId, "One live too many", null])).code).toBe("55000");
    });
  });

  it("revoke: the agency's admin/manager only, final, idempotent, audited; missing = not allowed", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx, { second: true });
      const id = await activeClient(tx);
      const REVOKE = "select * from public.revoke_represented_client($1)";
      for (const user of [
        AGENCY_MEMBER,
        SEED.adminAirline,
        SEED.adminMro,
        SEED.delta,
        SEED.platformAdmin,
      ]) {
        await actAs(tx, user);
        expect((await sqlError(tx, REVOKE, [id])).code, user).toBe("42501");
      }
      await actAs(tx, SEED.adminOther);
      expect((await sqlError(tx, REVOKE, [randomUUID()])).code).toBe("42501");
      await actAs(tx, AGENCY_MANAGER);
      const revoked = (await tx.query<{ status: string; revoked_at: string }>(REVOKE, [id]))
        .rows[0]!;
      expect(revoked.status).toBe("revoked");
      const again = (await tx.query<{ status: string; revoked_at: string }>(REVOKE, [id])).rows[0]!;
      expect(again).toEqual(revoked);
      const events = await audit(tx, "client.revoked", id);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        organization_id: agencyId,
        actor_profile_id: AGENCY_MANAGER,
      });
      expect(events[0]!.metadata).toMatchObject({ client_id: id, from: "active" });
    });
  });

  it("activate: platform admin with evidence, pending only, never the admin's own agency; evidence apart", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx);
      const { id } = await addClient(tx, SEED.adminOther, agencyId, "Operador cliente 1");
      const ACTIVATE = "select * from public.activate_represented_client($1, $2)";
      for (const user of [SEED.adminOther, AGENCY_MANAGER, SEED.adminMro, SEED.delta]) {
        await actAs(tx, user);
        expect((await sqlError(tx, ACTIVATE, [id, "self"])).code, user).toBe("42501");
      }
      await actAs(tx, SEED.platformAdmin);
      expect((await sqlError(tx, ACTIVATE, [id, "   "])).code).toBe("22023");
      expect((await sqlError(tx, ACTIVATE, [randomUUID(), "x"])).code).toBe("P0002");

      // A platform admin who belongs to the agency does not activate its clients (BR-20 rule).
      await tx.exec("reset role");
      await tx.query(
        "insert into public.organization_members (organization_id, profile_id, role) values ($1, $2, 'member')",
        [agencyId, SEED.platformAdmin],
      );
      await actAs(tx, SEED.platformAdmin);
      expect((await sqlError(tx, ACTIVATE, [id, "evidence"])).code).toBe("42501");
      // … nor after leaving it (the removal is audited, 20261023500400).
      await tx.exec("reset role");
      await tx.query(
        "delete from public.organization_members where organization_id = $1 and profile_id = $2",
        [agencyId, SEED.platformAdmin],
      );
      await actAs(tx, SEED.platformAdmin);
      expect((await sqlError(tx, ACTIVATE, [id, "evidence"])).code).toBe("42501");
    });

    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx);
      const { id } = await addClient(tx, SEED.adminOther, agencyId, "Operador cliente 1");
      expect((await activate(tx, id, " Signed mandate 2026-10-01 ")).status).toBe("active");
      await actAs(tx, SEED.platformAdmin);
      expect(
        (await sqlError(tx, "select * from public.activate_represented_client($1, 'again')", [id]))
          .code,
      ).toBe("55000");
      const reviews = (
        await tx.query(
          "select reviewed_by, note from public.represented_client_reviews where client_id = $1",
          [id],
        )
      ).rows;
      expect(reviews).toEqual([
        { reviewed_by: SEED.platformAdmin, note: "Signed mandate 2026-10-01" },
      ]);
      // The agency never reads the evidence nor finds the platform admin in its own trail (T-52).
      await actAs(tx, SEED.adminOther);
      expect(
        (
          await tx.query("select 1 from public.represented_client_reviews where client_id = $1", [
            id,
          ])
        ).rows,
      ).toEqual([]);
      const [event] = await audit(tx, "client.activated", id);
      expect(event).toMatchObject({ organization_id: null, actor_profile_id: SEED.platformAdmin });
      expect(event!.metadata).toMatchObject({
        client_id: id,
        agency_id: agencyId,
        note_provided: true,
      });
      expect(JSON.stringify(event!.metadata)).not.toContain("mandate");
    });
  });

  it("an agency with a pending client cannot stop being one (the activation's agency check is a backstop)", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx);
      const { id } = await addClient(tx, SEED.adminOther, agencyId, "Operador cliente 1");
      await tx.exec("reset role");
      expect(
        (
          await sqlError(tx, "update public.organizations set type = 'mro' where id = $1", [
            agencyId,
          ])
        ).code,
      ).toBe("55000");
      expect((await activate(tx, id)).status).toBe("active");
    });
  });
});

describe("requirements on behalf of a client (20261024500100)", () => {
  it("an agency publishes only with an active client of its own; a draft may wait; audited", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx, { second: true });
      const quals = await QUALS(tx);
      await actAs(tx, SEED.adminOther);
      // «Indica el cliente representado.»
      expect((await sqlError(tx, CREATE, [randomUUID(), agencyId, quals, "open", null])).code).toBe(
        "CFR01",
      );
      // A draft may wait for its client (v1.8 asks only when publishing).
      const draft = await createAs(tx, SEED.adminOther, agencyId, { status: "draft" });
      await commitCheck(tx);

      const { id: pending } = await addClient(tx, SEED.adminOther, agencyId, "Pendiente SA");
      await actAs(tx, SEED.adminOther);
      expect(
        (await sqlError(tx, CREATE, [randomUUID(), agencyId, quals, "open", pending])).code,
      ).toBe("CFR02");
      const foreign = await activeClient(tx, "Cliente de otra agencia", otherAgencyId);
      await actAs(tx, SEED.adminOther);
      expect(
        (await sqlError(tx, CREATE, [randomUUID(), agencyId, quals, "open", foreign])).code,
      ).toBe("22023");

      const client = await activeClient(tx);
      const id = await createAs(tx, SEED.adminOther, agencyId, { client });
      await commitCheck(tx); // the commit-time check passes
      await tx.exec("reset role");
      expect(
        (
          await tx.query(
            "select status, on_behalf_of_client_id from public.work_requirements where id = $1",
            [id],
          )
        ).rows[0],
      ).toEqual({ status: "open", on_behalf_of_client_id: client });
      const [event] = await audit(tx, "requirement.client_changed", id);
      expect(event).toMatchObject({ organization_id: agencyId, actor_profile_id: SEED.adminOther });
      expect(event!.metadata).toEqual({ client_id: client, previous_client_id: null });
      expect(draft).toBeTruthy();
    });
  });

  it("the rule binds agencies only: an MRO publishes without a client and cannot borrow one", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      await setUpAgency(tx);
      const id = await createAs(tx, SEED.adminMro, mroId);
      await commitCheck(tx);
      expect(id).toBeTruthy();
      const client = await activeClient(tx);
      const quals = await QUALS(tx);
      await actAs(tx, SEED.adminMro);
      expect((await sqlError(tx, CREATE, [randomUUID(), mroId, quals, "open", client])).code).toBe(
        "22023",
      );
    });
  });

  it("direct PostgREST writes: no grant on the column; an agency's direct or old-overload publish is refused", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx);
      const client = await activeClient(tx);
      const id = await createAs(tx, SEED.adminOther, agencyId, { client });
      await actAs(tx, SEED.adminOther);
      expect(
        (
          await sqlError(
            tx,
            "update public.work_requirements set on_behalf_of_client_id = null where id = $1",
            [id],
          )
        ).message,
      ).toMatch(/permission denied/);
      expect(
        (
          await sqlError(
            tx,
            `insert into public.work_requirements
               (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by,
                on_behalf_of_client_id)
             values ($1, 'Direct', 'MAD', now() + interval '5 days', now() + interval '6 days', 'day', 1, 'planned',
                     'draft', $2, $3)`,
            [agencyId, SEED.adminOther, client],
          )
        ).message,
      ).toMatch(/permission denied/);
    });

    // The old 15-argument overload (functions already deployed) cannot publish for an agency either.
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx);
      const quals = await QUALS(tx);
      await actAs(tx, SEED.adminOther);
      const old = await sqlError(
        tx,
        `select public.create_work_requirement($1, 'Old overload', 'MAD', now() + interval '5 days',
           now() + interval '6 days', 'day', 1, 'planned', $2::jsonb, 'open', 'ES', 'Europe/Madrid', null, null, null)`,
        [agencyId, quals],
      );
      expect(old.code).toBe("CFR01");
      // … and a direct INSERT of an open requirement is refused the same way.
      expect(
        (
          await sqlError(
            tx,
            `insert into public.work_requirements
               (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
             values ($1, 'Direct', 'MAD', now() + interval '5 days', now() + interval '6 days', 'day', 1, 'planned',
                     'open', $2)`,
            [agencyId, SEED.adminOther],
          )
        ).code,
      ).toBe("CFR01");
    });

    // A draft published through the status change (the PATCH path) needs its client too.
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx);
      const draft = await createAs(tx, SEED.adminOther, agencyId, { status: "draft" });
      await commitCheck(tx);
      await actAs(tx, SEED.adminOther);
      expect(
        (
          await sqlError(tx, "update public.work_requirements set status = 'open' where id = $1", [
            draft,
          ])
        ).code,
      ).toBe("CFR01");
    });
  });

  it("a revoked client: publish and resume refused (CFR02); pause, close and archive still work", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx);
      const client = await activeClient(tx);
      const draft = await createAs(tx, SEED.adminOther, agencyId, { status: "draft", client });
      const open = await createAs(tx, SEED.adminOther, agencyId, { client });
      await actAs(tx, SEED.adminOther);
      await tx.query("update public.work_requirements set status = 'paused' where id = $1", [open]);
      await tx.query("select * from public.revoke_represented_client($1)", [client]);

      const STATUS = "update public.work_requirements set status = $2 where id = $1";
      expect((await sqlError(tx, STATUS, [draft, "open"])).code).toBe("CFR02");
      expect((await sqlError(tx, STATUS, [open, "open"])).code).toBe("CFR02");
      const [publish, publishArgs] = await updateAs(tx, SEED.adminOther, draft, {
        client,
        status: "open",
      });
      expect((await sqlError(tx, publish, [...publishArgs])).code).toBe("CFR02");

      await actAs(tx, SEED.adminOther);
      await tx.query(STATUS, [open, "closed"]);
      await tx.query("select * from public.archive_work_requirement($1)", [open]);
      await tx.query("select * from public.archive_work_requirement($1)", [draft]);
      await commitCheck(tx);
    });
  });

  it("edit: the client of a draft changes like any field (CF412, 42501); an agency cannot drop it; frozen once published", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx);
      const first = await activeClient(tx, "Cliente A");
      const second = await activeClient(tx, "Cliente B");
      const id = await createAs(tx, SEED.adminOther, agencyId, { status: "draft", client: first });

      // A draft may drop its client; publishing without one is «Indica el cliente representado.».
      let [sql, args] = await updateAs(tx, SEED.adminOther, id, { client: null, status: "open" });
      expect((await sqlError(tx, sql, [...args])).code).toBe("CFR01");
      [sql, args] = await updateAs(tx, SEED.adminOther, id, {
        client: second,
        expected: "2020-01-01T00:00:00Z",
      });
      expect((await sqlError(tx, sql, [...args])).code).toBe("CF412");
      [sql, args] = await updateAs(tx, AGENCY_MEMBER, id, { client: second });
      expect((await sqlError(tx, sql, [...args])).code).toBe("42501");
      [sql, args] = await updateAs(tx, SEED.adminAirline, id, { client: second });
      expect((await sqlError(tx, sql, [...args])).code).toBe("42501");

      [sql, args] = await updateAs(tx, SEED.adminOther, id, { client: second, status: "draft" });
      const changed = (await tx.query<{ changed: string[] }>(sql, [...args])).rows[0]!.changed;
      expect(changed).toEqual(["onBehalfOfClientId"]);
      [sql, args] = await updateAs(tx, SEED.adminOther, id, { client: second, status: "draft" });
      expect((await tx.query<{ changed: string[] }>(sql, [...args])).rows[0]!.changed).toEqual([]);
      // Published: the client a professional reads is the one who receives the data (LOW-2).
      [sql, args] = await updateAs(tx, SEED.adminOther, id, { client: second, status: "open" });
      await tx.query(sql, [...args]);
      await commitCheck(tx);
      [sql, args] = await updateAs(tx, SEED.adminOther, id, { client: first });
      expect((await sqlError(tx, sql, [...args])).code).toBe("55000");
      await tx.exec("reset role"); // even for the owner
      expect(
        (
          await sqlError(
            tx,
            "update public.work_requirements set on_behalf_of_client_id = $2 where id = $1",
            [id, first],
          )
        ).code,
      ).toBe("55000");
      const events = await audit(tx, "requirement.client_changed", id);
      expect(events.map((e) => e.metadata)).toEqual(
        expect.arrayContaining([{ client_id: second, previous_client_id: first }]),
      );

      // The 16-argument overload (no client argument) keeps the client.
      await tx.exec("reset role");
      const row = (
        await tx.query<{ updated_at: string; starts_at: string; ends_at: string }>(
          "select updated_at, starts_at, ends_at from public.work_requirements where id = $1",
          [id],
        )
      ).rows[0]!;
      const quals = await QUALS(tx);
      await actAs(tx, SEED.adminOther);
      await tx.query(
        `select * from public.update_work_requirement($1, $2, 'Renamed', 'Madrid (MAD)', $3, $4, 'day', 1,
           'planned', $5::jsonb, null, 'ES', 'Europe/Madrid', null, null, null)`,
        [id, row.updated_at, row.starts_at, row.ends_at, quals],
      );
      await tx.exec("reset role");
      expect(
        (
          await tx.query(
            "select on_behalf_of_client_id from public.work_requirements where id = $1",
            [id],
          )
        ).rows[0],
      ).toEqual({ on_behalf_of_client_id: second });

      // Applied to: still frozen (the applicant consented for THIS client) — the RPC answers the M05 reason first.
      await makeAvailable(tx, [SEED.delta]);
      await actAs(tx, SEED.delta);
      await tx.query(APPLY, [id, randomUUID()]);
      [sql, args] = await updateAs(tx, SEED.adminOther, id, { client: first });
      expect((await sqlError(tx, sql, [...args])).code).toBe("CFA12");
    });
  });

  it("no oracle: a stranger's create for an agency gets RLS's 42501, whatever the type or the client", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx);
      const { id: pending } = await addClient(tx, SEED.adminOther, agencyId, "Pendiente SA");
      const active = await activeClient(tx);
      const quals = await QUALS(tx);
      for (const user of [SEED.delta, SEED.adminMro, AGENCY_MEMBER]) {
        await actAs(tx, user);
        for (const client of [null, pending, active, randomUUID()])
          expect(
            (await sqlError(tx, CREATE, [randomUUID(), agencyId, quals, "open", client])).code,
            `${user} ${client}`,
          ).toBe("42501");
      }
    });
  });

  it("the organization type is no way around the rules (security review MEDIUM-1)", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      // Lisbon (an MRO with the seed's open requirement) cannot become an agency while it publishes without a client…
      await actAs(tx, SEED.adminOther);
      const TYPE = "update public.organizations set type = $2 where id = $1";
      expect((await sqlError(tx, TYPE, [agencyId, "staffing_agency"])).code).toBe("55000");
      // …but may once those are paused or closed (resuming re-applies CFR01).
      await tx.query(
        "update public.work_requirements set status = 'paused' where organization_id = $1 and status = 'open'",
        [agencyId],
      );
      await tx.query(TYPE, [agencyId, "staffing_agency"]);
      const client = await activeClient(tx);
      const id = await createAs(tx, SEED.adminOther, agencyId, { client });
      // An agency with live clients, or with a published requirement for one, stays an agency.
      await actAs(tx, SEED.adminOther);
      expect((await sqlError(tx, TYPE, [agencyId, "mro"])).code).toBe("55000");
      await tx.query("select * from public.revoke_represented_client($1)", [client]);
      expect((await sqlError(tx, TYPE, [agencyId, "mro"])).code).toBe("55000");
      await tx.query("update public.work_requirements set status = 'closed' where id = $1", [id]);
      await tx.query(TYPE, [agencyId, "mro"]);
      await commitCheck(tx);
    });
  });

  it("a draft without a client is completed and published in one edit (the client is written first)", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx);
      const client = await activeClient(tx);
      const draft = await createAs(tx, SEED.adminOther, agencyId, { status: "draft" });
      let [sql, args] = await updateAs(tx, SEED.adminOther, draft, {
        client: null,
        status: "open",
      });
      expect((await sqlError(tx, sql, [...args])).code).toBe("CFR01"); // «Indica el cliente representado.»
      [sql, args] = await updateAs(tx, SEED.adminOther, draft, { client, status: "open" });
      expect((await tx.query<{ changed: string[] }>(sql, [...args])).rows[0]!.changed).toEqual([
        "onBehalfOfClientId",
      ]);
      await commitCheck(tx);
      await tx.exec("reset role");
      expect(
        (
          await tx.query(
            "select status, on_behalf_of_client_id from public.work_requirements where id = $1",
            [draft],
          )
        ).rows[0],
      ).toEqual({ status: "open", on_behalf_of_client_id: client });
    });
  });

  it("anon executes none of the RPCs", async () => {
    await asUser(db, null, async (tx) => {
      for (const sql of [
        `select * from public.add_represented_client('${agencyId}', 'X', null)`,
        `select * from public.revoke_represented_client('${randomUUID()}')`,
        `select * from public.activate_represented_client('${randomUUID()}', 'x')`,
        "select * from public.list_opportunities()",
      ])
        expect((await sqlError(tx, sql)).message, sql).toMatch(/permission denied/);
    });
  });

  it("a closed requirement keeps its client", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx);
      const first = await activeClient(tx, "Cliente A");
      const second = await activeClient(tx, "Cliente B");
      const id = await createAs(tx, SEED.adminOther, agencyId, { client: first });
      await actAs(tx, SEED.adminOther);
      await tx.query("update public.work_requirements set status = 'closed' where id = $1", [id]);
      const [sql, args] = await updateAs(tx, SEED.adminOther, id, { client: second });
      expect((await sqlError(tx, sql, [...args])).code).toBe("55000");
      await tx.exec("reset role");
      expect(
        (
          await sqlError(
            tx,
            "update public.work_requirements set on_behalf_of_client_id = $2 where id = $1",
            [id, second],
          )
        ).code,
      ).toBe("55000");
    });
  });
});

describe("what professionals learn, and no action for a revoked client", () => {
  it("list_opportunities names the client (never its e-mail); same projection for professionals and the network", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx);
      const client = await activeClient(tx);
      const id = await createAs(tx, SEED.adminOther, agencyId, { client });
      const plain = await createAs(tx, SEED.adminMro, mroId);
      for (const user of [SEED.delta, SEED.hotelPrivate, SEED.adminMro]) {
        await actAs(tx, user);
        const { rows } = await tx.query<Record<string, unknown>>(
          "select * from public.list_opportunities($1)",
          [id],
        );
        expect(rows, user).toHaveLength(1);
        expect(rows[0]!.client_name).toBe("Operador cliente 1");
        expect(rows[0]!.organization_name).toBe("Demo Aero Services Lisbon");
        const text = JSON.stringify(rows[0]);
        for (const secret of ["ops@client.test", client, agencyId, SEED.adminOther])
          expect(text).not.toContain(secret);
        expect(Object.keys(rows[0]!)).toHaveLength(18);
      }
      await actAs(tx, SEED.delta);
      const other = (
        await tx.query<{ client_name: string | null }>(
          "select * from public.list_opportunities($1)",
          [plain],
        )
      ).rows[0]!;
      expect(other.client_name).toBeNull();
      // The search matches the client's name, which the card shows.
      const found = (
        await tx.query<{ id: string }>(
          "select id from public.list_opportunities(p_q => 'cliente 1')",
        )
      ).rows.map((r) => r.id);
      expect(found).toContain(id);
      expect(found).not.toContain(plain);
    });
  });

  it("revoked: not listed, no application, no forward step; winding down still works", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx);
      const client = await activeClient(tx);
      const id = await createAs(tx, SEED.adminOther, agencyId, { client });
      await makeAvailable(tx, [SEED.delta, SEED.echo]);
      await actAs(tx, SEED.delta);
      const delta = (await tx.query<{ id: string }>(APPLY, [id, randomUUID()])).rows[0]!.id;
      await actAs(tx, SEED.echo);
      const echo = (await tx.query<{ id: string }>(APPLY, [id, randomUUID()])).rows[0]!.id;
      // Echo reaches «accepted» while the representation is active.
      for (const [user, to] of [
        [SEED.adminOther, "shortlisted"],
        [SEED.adminOther, "proposed"],
        [SEED.echo, "accepted"],
      ] as const) {
        const [sql, args] = await transition(tx, user, echo, to);
        await tx.query(sql, [...args]);
      }

      await actAs(tx, SEED.adminOther);
      await tx.query("select * from public.revoke_represented_client($1)", [client]);

      for (const user of [SEED.alpha, SEED.delta, SEED.adminMro]) {
        await actAs(tx, user);
        expect((await tx.query("select id from public.list_opportunities($1)", [id])).rows).toEqual(
          [],
        );
      }
      await makeAvailable(tx, [SEED.alpha]);
      await actAs(tx, SEED.alpha);
      // The professional learns only that it takes no application (CFA01, as a paused one; LOW-3).
      expect((await sqlError(tx, APPLY, [id, randomUUID()])).code).toBe("CFA01");

      let [sql, args] = await transition(tx, SEED.adminOther, delta, "shortlisted");
      expect((await sqlError(tx, sql, [...args])).code).toBe("CFR02");
      [sql, args] = await transition(tx, SEED.adminOther, echo, "confirmed");
      expect((await sqlError(tx, sql, [...args])).code).toBe("CFR02");
      // Winding down: the technician withdraws, the agency cancels the accepted one, then closes.
      [sql, args] = await transition(tx, SEED.delta, delta, "withdrawn");
      await tx.query(sql, [...args]);
      [sql, args] = await transition(
        tx,
        SEED.adminOther,
        echo,
        "cancelled",
        "Representation ended",
      );
      await tx.query(sql, [...args]);
      await actAs(tx, SEED.adminOther);
      await tx.query("update public.work_requirements set status = 'closed' where id = $1", [id]);
      await commitCheck(tx);
    });
  });

  it("revocation waits for an action holding the representation, and the next action sees it", async () => {
    // Single-connection PGlite cannot run two sessions: the lock itself is checked by
    // scripts/local/db-race-check.sh recruiter. Here: the check reads the latest committed state.
    await asUser(db, SEED.adminOther, async (tx) => {
      await setUpAgency(tx);
      const client = await activeClient(tx);
      const id = await createAs(tx, SEED.adminOther, agencyId, { status: "draft", client });
      await actAs(tx, SEED.adminOther);
      await tx.query("select * from public.revoke_represented_client($1)", [client]);
      const [sql, args] = await updateAs(tx, SEED.adminOther, id, { client, status: "open" });
      expect((await sqlError(tx, sql, [...args])).code).toBe("CFR02");
    });
  });
});
