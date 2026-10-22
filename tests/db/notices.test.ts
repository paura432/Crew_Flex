// In-app notices (v2-18 / shell #1 / N-11, migration 20261023800000): who is told, in the same
// transaction as the event; what each side reads (rendered at read time, pool rules for applicants);
// owner-only RLS and grants; read marks; retention and role loss. Every case runs in a rolled-back
// transaction (harness `asUser`).
import { randomUUID } from "node:crypto";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, orgIdByName, SEED } from "./harness";

let db: PGlite;
let mroId: string;
let lisbonId: string;

beforeAll(async () => {
  db = await createTestDatabase();
  mroId = await orgIdByName(db, "Demo MRO Madrid");
  lisbonId = await orgIdByName(db, "Demo Aero Services Lisbon");
});

/** Switches the acting user inside one transaction (null = anon). */
async function actAs(tx: Transaction, userId: string | null) {
  await tx.exec("reset role");
  await tx.query("select set_config('request.jwt.claims', $1, true)", [
    userId ? JSON.stringify({ sub: userId, role: "authenticated" }) : "",
  ]);
  await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
}

/** Back to the owner, keeping the JWT claims (so `auth.uid()` still names the last actor). */
const asOwner = (tx: Transaction) => tx.exec("reset role");

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

/** Owner fixture: an open need of `org` with hard B1.1 + TR-A320, starting in 5 days. */
async function createNeed(tx: Transaction, org: string, createdBy: string, title = "Notices need") {
  await asOwner(tx);
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.work_requirements
       (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
     values ($1, $2, 'Madrid (MAD)', now() + interval '5 days', now() + interval '8 days', 'day', 2,
             'planned', 'open', $3)
     returning id`,
    [org, title, createdBy],
  );
  const id = rows[0]!.id;
  await tx.query(
    `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
     select $1, id, 'hard' from public.qualification_types where code in ('B1.1', 'TR-A320')`,
    [id],
  );
  return id;
}

async function makeAvailable(tx: Transaction, profiles: string[]) {
  await asOwner(tx);
  await tx.query(
    `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
     select p, now() - interval '30 days', now() + interval '120 days', 'available' from unnest($1::uuid[]) p`,
    [profiles],
  );
}

async function applyAs(tx: Transaction, technician: string, requirementId: string) {
  await actAs(tx, technician);
  const { rows } = await tx.query<{ id: string }>(
    "select * from public.apply_to_requirement($1, $2, true)",
    [requirementId, randomUUID()],
  );
  return rows[0]!.id;
}

const TRANSITION_SQL = "select * from public.transition_application($1, $2, $3, $4, $5, $6)";

async function transitionArgs(tx: Transaction, applicationId: string, to: string, reason?: string) {
  await asOwner(tx);
  const { rows } = await tx.query<{ updated_at: Date; current_proposal_id: string | null }>(
    "select updated_at, current_proposal_id from public.applications where id = $1",
    [applicationId],
  );
  return [
    applicationId,
    to,
    rows[0]!.updated_at.toISOString(),
    randomUUID(),
    reason ?? null,
    to === "accepted" ? rows[0]!.current_proposal_id : null,
  ];
}

async function step(
  tx: Transaction,
  actor: string,
  applicationId: string,
  to: string,
  reason?: string,
) {
  const args = await transitionArgs(tx, applicationId, to, reason);
  await actAs(tx, actor);
  await tx.query(TRANSITION_SQL, args);
}

interface RawNotice {
  recipient_id: string;
  kind: string;
  application_id: string;
  application_status: string | null;
  requirement_status: string | null;
  read_at: Date | null;
}

/** Owner view of every notice about the given applications. */
async function noticesOf(tx: Transaction, applicationIds: string[]): Promise<RawNotice[]> {
  await asOwner(tx);
  const { rows } = await tx.query<RawNotice>(
    `select recipient_id, kind, application_id, application_status, requirement_status, read_at
     from public.notifications where application_id = any ($1::uuid[])
     order by created_at, recipient_id`,
    [applicationIds],
  );
  return rows;
}

const recipients = (rows: RawNotice[]) => rows.map((r) => r.recipient_id).sort();

interface ListedNotice {
  id: string;
  kind: string;
  audience: string;
  application_id: string;
  application_status: string | null;
  requirement_status: string | null;
  requirement_id: string;
  requirement_title: string;
  organization_name: string | null;
  candidate_name: string | null;
  candidate_ref: string | null;
  read_at: Date | null;
  total: number;
}

async function listAs(tx: Transaction, userId: string, offset = 0, limit = 20) {
  await actAs(tx, userId);
  const { rows } = await tx.query<ListedNotice>(
    "select * from public.get_my_notifications(null, $1, $2)",
    [offset, limit],
  );
  return rows;
}

async function unreadAs(tx: Transaction, userId: string) {
  await actAs(tx, userId);
  const { rows } = await tx.query<{ n: number }>(
    "select public.count_my_unread_notifications() as n",
  );
  return rows[0]!.n;
}

/** Owner: every notice read, so the next event writes a new row instead of updating an unread one (T-73). */
async function readAll(tx: Transaction) {
  await asOwner(tx);
  await tx.query("update public.notifications set read_at = now() where read_at is null");
}

/** Received → shortlisted → proposed (v1) by the organization side. */
async function toProposed(tx: Transaction, manager: string, applicationId: string) {
  await step(tx, manager, applicationId, "shortlisted");
  await step(tx, manager, applicationId, "proposed");
}

describe("notices: grants, RLS and function hygiene (migration 20261023800000)", () => {
  it("anon has no access to the table nor the functions", async () => {
    await asUser(db, null, async (tx) => {
      for (const sql of [
        "select * from public.notifications",
        "select * from public.get_my_notifications()",
        "select public.count_my_unread_notifications()",
        "select public.mark_notifications_read()",
      ]) {
        expect((await sqlError(tx, sql)).message, sql).toMatch(/permission denied/);
      }
    });
  });

  it("a signed-in user has no direct access to the table: reads and marks go through the RPCs", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await makeAvailable(tx, [SEED.delta]);
      const app = await applyAs(tx, SEED.delta, need);
      await asOwner(tx);
      const { rows } = await tx.query<{ id: string }>(
        "select id from public.notifications where recipient_id = $1",
        [SEED.adminMro],
      );
      const id = rows[0]!.id;

      // Security review LOW-1: a direct SELECT skipped the read-time access and retention checks.
      for (const user of [SEED.adminMro, SEED.delta]) {
        await actAs(tx, user);
        for (const [sql, params] of [
          ["select * from public.notifications", []],
          ["update public.notifications set read_at = now() where id = $1", [id]],
          ["delete from public.notifications where id = $1", [id]],
          [
            `insert into public.notifications (recipient_id, kind, application_id, application_status)
             values ($1, 'application', $2, 'received')`,
            [user, app],
          ],
        ] as const) {
          expect((await sqlError(tx, sql, [...params])).message, `${user}: ${sql}`).toMatch(
            /permission denied/,
          );
        }
      }
      // The recipient reads and marks their own through the RPCs.
      await actAs(tx, SEED.adminMro);
      expect(
        (await tx.query("select * from public.get_my_notifications($1)", [id])).rows,
      ).toHaveLength(1);
      expect(
        (await tx.query<{ n: number }>("select public.mark_notifications_read($1) as n", [id]))
          .rows[0]!.n,
      ).toBe(1);
    });
  });

  it("other users and other organizations get the same answer as for a random id", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await makeAvailable(tx, [SEED.delta]);
      await applyAs(tx, SEED.delta, need);
      await asOwner(tx);
      const { rows } = await tx.query<{ id: string }>(
        "select id from public.notifications where recipient_id = $1",
        [SEED.adminMro],
      );
      const id = rows[0]!.id;

      // Even a platform admin: notices are the recipient's only (no support read path).
      for (const stranger of [
        SEED.adminOther,
        SEED.echo,
        SEED.charlieMember,
        SEED.delta,
        SEED.platformAdmin,
      ]) {
        await actAs(tx, stranger);
        for (const probe of [id, randomUUID()]) {
          const rpc = await tx.query("select * from public.get_my_notifications($1)", [probe]);
          expect(rpc.rows, stranger).toEqual([]);
          const marked = await tx.query<{ n: number }>(
            "select public.mark_notifications_read($1) as n",
            [probe],
          );
          expect(marked.rows[0]!.n, stranger).toBe(0);
        }
      }
      await asOwner(tx);
      const still = await tx.query<{ read_at: Date | null }>(
        "select read_at from public.notifications where id = $1",
        [id],
      );
      expect(still.rows[0]!.read_at).toBeNull();
    });
  });

  it("an organization-side notice is shown only while the reader is admin/manager there (read-time check)", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await makeAvailable(tx, [SEED.delta]);
      const app = await applyAs(tx, SEED.delta, need);
      // Owner fixture: rows left as a lost race would leave them (security review LOW-2): addressed to a
      // plain member of the organization and to another organization's admin.
      await asOwner(tx);
      await tx.query(
        `insert into public.notifications (recipient_id, kind, application_id, application_status)
         select r, 'application', $1, 'received' from unnest($2::uuid[]) r`,
        [app, [SEED.charlieMember, SEED.adminOther]],
      );
      for (const reader of [SEED.charlieMember, SEED.adminOther]) {
        expect(await listAs(tx, reader), reader).toEqual([]);
        expect(await unreadAs(tx, reader), reader).toBe(0);
      }
    });
  });

  it("every DEFINER function of the migration pins search_path and is not executable by anon", async () => {
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
       where (s.nspname = 'public' and p.proname in ('notify_application_event', 'notify_requirement_status',
               'drop_notifications_on_role_loss', 'get_my_notifications', 'count_my_unread_notifications',
               'mark_notifications_read'))
          or (s.nspname = 'app_private' and p.proname in ('notification_retention', 'candidate_pseudonym',
               'prune_notifications', 'visible_notifications'))`,
    );
    expect(rows).toHaveLength(10);
    for (const row of rows) {
      expect(row.config, row.name).toEqual(['search_path=""']);
      expect(row.anon, row.name).toBe(false);
    }
    const callable = rows.filter((r) => r.authenticated).map((r) => r.name.split("(")[0]);
    expect(callable.sort()).toEqual([
      "count_my_unread_notifications",
      "get_my_notifications",
      "mark_notifications_read",
    ]);
    // The API's three RPCs and the triggers run as the owner; the private helpers only inside them.
    expect(
      rows
        .filter((r) => r.definer)
        .map((r) => r.name.split("(")[0])
        .sort(),
    ).toEqual([
      "count_my_unread_notifications",
      "drop_notifications_on_role_loss",
      "get_my_notifications",
      "mark_notifications_read",
      "notify_application_event",
      "notify_requirement_status",
    ]);
  });
});

describe("notices: who is told, in the same transaction as the event", () => {
  it("a new application tells the organization's admins and managers only (v1.8 ✗ HIRE-07 #7)", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await makeAvailable(tx, [SEED.delta]);
      const app = await applyAs(tx, SEED.delta, need);
      const rows = await noticesOf(tx, [app]);
      // adminMro (admin) and managerMro (manager); never the plain members, another organization or
      // the applicant.
      expect(recipients(rows)).toEqual([SEED.adminMro, SEED.managerMro].sort());
      expect(
        rows.every((r) => r.kind === "application" && r.application_status === "received"),
      ).toBe(true);
    });
  });

  it("each transition tells the other party of the actor, never the actor or their colleagues", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await makeAvailable(tx, [SEED.delta]);
      // Each step is read before the next one, so every event writes its own rows (T-73 merges unread).
      const app = await applyAs(tx, SEED.delta, need);
      await readAll(tx);
      await step(tx, SEED.managerMro, app, "shortlisted");
      let rows = await noticesOf(tx, [app]);
      expect(
        rows.filter((r) => r.application_status === "shortlisted").map((r) => r.recipient_id),
      ).toEqual([SEED.delta]);

      await readAll(tx);
      await step(tx, SEED.adminMro, app, "proposed");
      await readAll(tx);
      await step(tx, SEED.delta, app, "accepted");
      rows = await noticesOf(tx, [app]);
      expect(
        rows.filter((r) => r.application_status === "proposed").map((r) => r.recipient_id),
      ).toEqual([SEED.delta]);
      expect(recipients(rows.filter((r) => r.application_status === "accepted"))).toEqual(
        [SEED.adminMro, SEED.managerMro].sort(),
      );

      await readAll(tx);
      await step(tx, SEED.delta, app, "withdrawn");
      rows = await noticesOf(tx, [app]);
      expect(recipients(rows.filter((r) => r.application_status === "withdrawn"))).toEqual(
        [SEED.adminMro, SEED.managerMro].sort(),
      );
      // One event per notice batch: 5 events (received, shortlisted, proposed, accepted, withdrawn)
      // → 2 + 1 + 1 + 2 + 2 notices.
      expect(rows).toHaveLength(8);
    });
  });

  it("a refused transition writes no notice (same transaction)", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await makeAvailable(tx, [SEED.delta]);
      const app = await applyAs(tx, SEED.delta, need);
      const before = (await noticesOf(tx, [app])).length;
      const args = await transitionArgs(tx, app, "confirmed"); // received → confirmed: 55000
      await actAs(tx, SEED.managerMro);
      expect((await sqlError(tx, TRANSITION_SQL, args)).code).toBe("55000");
      expect(await noticesOf(tx, [app])).toHaveLength(before);
    });
  });

  it("a manager who applies to their own organization is never told about their own act", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      // Owner fixture with the manager's JWT: the application and its first event as the RPC writes them.
      await actAs(tx, SEED.managerMro);
      await asOwner(tx);
      const app = randomUUID();
      await tx.query(
        "insert into public.applications (id, requirement_id, technician_profile_id) values ($1, $2, $3)",
        [app, need, SEED.managerMro],
      );
      await tx.query(
        `insert into public.application_events (application_id, seq, from_status, to_status, actor)
         values ($1, 1, null, 'received', 'technician')`,
        [app],
      );
      expect(recipients(await noticesOf(tx, [app]))).toEqual([SEED.adminMro]);
      // The admin acts on it: the manager is told as the applicant (technician side).
      await step(tx, SEED.adminMro, app, "shortlisted");
      const listed = await listAs(tx, SEED.managerMro);
      const mine = listed.find((n) => n.application_status === "shortlisted")!;
      expect([mine.audience, mine.candidate_ref, mine.candidate_name]).toEqual([
        "technician",
        null,
        null,
      ]);
    });
  });

  it("pausing, resuming and closing tell the active applicants only, never the actor", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await makeAvailable(tx, [SEED.delta, SEED.echo, SEED.hotelPrivate]);
      const delta = await applyAs(tx, SEED.delta, need);
      const echo = await applyAs(tx, SEED.echo, need);
      const hotel = await applyAs(tx, SEED.hotelPrivate, need);
      await step(tx, SEED.hotelPrivate, hotel, "withdrawn");
      await toProposed(tx, SEED.managerMro, echo);

      const status = async (to: string) => {
        await actAs(tx, SEED.adminMro);
        await tx.query("update public.work_requirements set status = $2 where id = $1", [need, to]);
      };
      const requirementNotices = async () =>
        (await noticesOf(tx, [delta, echo, hotel])).filter((r) => r.kind === "requirement");

      const summary = async () =>
        (await requirementNotices())
          .map((r) => `${r.requirement_status}:${r.recipient_id}:${r.read_at ? "read" : "unread"}`)
          .sort();

      await status("paused");
      expect(await summary()).toEqual(
        [`paused:${SEED.delta}:unread`, `paused:${SEED.echo}:unread`].sort(),
      );
      // T-73: while unread, a resume (or any later change) updates the same notice — toggling the
      // status as often as one likes never piles notices up (security review MEDIUM-1).
      for (let i = 0; i < 5; i += 1) {
        await status("open");
        await status("paused");
      }
      await status("open");
      expect(await summary()).toEqual(
        [`open:${SEED.delta}:unread`, `open:${SEED.echo}:unread`].sort(),
      );
      // Once read, the next change is a new notice.
      await actAs(tx, SEED.delta);
      await tx.query("select public.mark_notifications_read()");
      await status("closed");
      expect(await summary()).toEqual(
        [
          `open:${SEED.delta}:read`,
          `closed:${SEED.delta}:unread`,
          `closed:${SEED.echo}:unread`,
        ].sort(),
      );
      const rows = await requirementNotices();
      // Each notice names the recipient's own application; the withdrawn one is not told.
      expect(
        rows.every((r) => (r.recipient_id === SEED.delta ? delta : echo) === r.application_id),
      ).toBe(true);
      expect(rows.some((r) => r.application_id === hotel)).toBe(false);
    });
  });

  it("covered ↔ open (seats) is not a requirement notice: the confirmation already told the parties", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await asOwner(tx);
      await tx.query("update public.work_requirements set headcount = 1 where id = $1", [need]);
      await makeAvailable(tx, [SEED.delta]);
      const app = await applyAs(tx, SEED.delta, need);
      await toProposed(tx, SEED.managerMro, app);
      await step(tx, SEED.delta, app, "accepted");
      await step(tx, SEED.managerMro, app, "confirmed");
      await step(tx, SEED.delta, app, "cancelled", "Notices fixture: cannot travel");
      const rows = await noticesOf(tx, [app]);
      expect(rows.some((r) => r.kind === "requirement")).toBe(false);
      expect(
        rows.filter((r) => r.application_status === "confirmed").map((r) => r.recipient_id),
      ).toEqual([SEED.delta]);
      expect(recipients(rows.filter((r) => r.application_status === "cancelled"))).toEqual(
        [SEED.adminMro, SEED.managerMro].sort(),
      );
    });
  });
});

describe("notices: what each side reads (rendered at read time)", () => {
  it("the technician reads the requirement title, the organization name and the status reached", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro, "Notices · read side");
      await makeAvailable(tx, [SEED.delta]);
      const app = await applyAs(tx, SEED.delta, need);
      await step(tx, SEED.managerMro, app, "shortlisted");
      const [notice, ...rest] = await listAs(tx, SEED.delta);
      expect(rest).toEqual([]);
      expect(notice).toMatchObject({
        kind: "application",
        audience: "technician",
        application_id: app,
        application_status: "shortlisted",
        requirement_status: null,
        requirement_id: need,
        requirement_title: "Notices · read side",
        organization_name: "Demo MRO Madrid",
        candidate_name: null,
        candidate_ref: null,
        read_at: null,
        total: 1,
      });
    });
  });

  it("the organization reads the applicant exactly as get_requirement_applications shows them (T-04)", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await makeAvailable(tx, [SEED.delta, SEED.echo, SEED.hotelPrivate]);
      const ids = {
        [SEED.delta]: await applyAs(tx, SEED.delta, need), // anonymous
        [SEED.echo]: await applyAs(tx, SEED.echo, need), // open
        [SEED.hotelPrivate]: await applyAs(tx, SEED.hotelPrivate, need), // private
      };
      const listed = await listAs(tx, SEED.managerMro);
      await actAs(tx, SEED.managerMro);
      const pool = await tx.query<{
        application_id: string;
        candidate_ref: string;
        candidate_display_name: string | null;
      }>(
        "select application_id, candidate_ref, candidate_display_name from public.get_requirement_applications($1)",
        [need],
      );
      expect(listed).toHaveLength(3);
      for (const notice of listed) {
        const row = pool.rows.find((r) => r.application_id === notice.application_id)!;
        expect(notice.audience).toBe("organization");
        expect(notice.organization_name).toBeNull();
        expect(notice.candidate_name).toBe(row.candidate_display_name);
        expect(notice.candidate_ref).toBe(row.candidate_display_name ? null : row.candidate_ref);
        expect(notice.candidate_ref ?? "CF-").toMatch(/^CF-/);
        // No person id reaches the organization through a notice.
        expect(JSON.stringify(notice)).not.toMatch(
          new RegExp(`${SEED.delta}|${SEED.echo}|${SEED.hotelPrivate}`),
        );
      }
      const byApp = (id: string) => listed.find((n) => n.application_id === id)!;
      expect(byApp(ids[SEED.echo]!).candidate_name).toBe("Technician Echo");
      expect(byApp(ids[SEED.delta]!).candidate_name).toBeNull();
      expect(byApp(ids[SEED.hotelPrivate]!).candidate_name).toBeNull();

      // The visibility of today decides, not the one of the day of the notice.
      await asOwner(tx);
      await tx.query(
        "update public.technician_profiles set visibility = 'anonymous' where profile_id = $1",
        [SEED.echo],
      );
      const after = (await listAs(tx, SEED.managerMro)).find(
        (n) => n.application_id === ids[SEED.echo],
      )!;
      expect(after.candidate_name).toBeNull();
      expect(after.candidate_ref).toMatch(/^CF-[0-9A-F]{10}$/);
    });
  });

  it("an internal member is shown by name (pool rule), with no pseudonym", async () => {
    await asUser(db, SEED.alpha, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await makeAvailable(tx, [SEED.alpha]);
      const app = await applyAs(tx, SEED.alpha, need);
      const notice = (await listAs(tx, SEED.adminMro)).find((n) => n.application_id === app)!;
      expect([notice.candidate_name, notice.candidate_ref]).toEqual(["Technician Alpha", null]);
    });
  });

  it("pages newest first with the total, one notice by id, and refuses a bad page", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await makeAvailable(tx, [SEED.delta]);
      const app = await applyAs(tx, SEED.delta, need);
      await step(tx, SEED.managerMro, app, "shortlisted");
      await readAll(tx);
      await step(tx, SEED.managerMro, app, "proposed");
      await readAll(tx);
      await step(tx, SEED.managerMro, app, "rejected", "Notices fixture: another profile fits");
      // One transaction = one now(): spread the creation times as separate transactions would.
      await asOwner(tx);
      await tx.query(
        `update public.notifications set created_at = created_at - case application_status
           when 'shortlisted' then interval '2 minutes' when 'proposed' then interval '1 minute'
           else interval '0' end
         where application_id = $1`,
        [app],
      );
      const all = await listAs(tx, SEED.delta);
      expect(all.map((n) => n.application_status)).toEqual(["rejected", "proposed", "shortlisted"]);
      const page2 = await listAs(tx, SEED.delta, 1, 1);
      expect([page2.length, page2[0]!.application_status, page2[0]!.total]).toEqual([
        1,
        "proposed",
        3,
      ]);
      await actAs(tx, SEED.delta);
      const one = await tx.query<ListedNotice>(
        "select * from public.get_my_notifications($1, 0, 1)",
        [all[2]!.id],
      );
      expect(one.rows.map((n) => n.application_status)).toEqual(["shortlisted"]);
      for (const [offset, limit] of [
        [-1, 20],
        [0, 0],
        [0, 51],
      ]) {
        expect(
          (
            await sqlError(tx, "select * from public.get_my_notifications(null, $1, $2)", [
              offset,
              limit,
            ])
          ).code,
        ).toBe("22023");
      }
      // The reason (free text) is never part of a notice.
      expect(JSON.stringify(all)).not.toMatch(/another profile fits/);
    });
  });
});

describe("notices: read marks, retention and role loss", () => {
  it("unread count, mark one (idempotent, first read time kept), mark all", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await makeAvailable(tx, [SEED.delta, SEED.echo]);
      await applyAs(tx, SEED.delta, need);
      await applyAs(tx, SEED.echo, need);
      expect(await unreadAs(tx, SEED.adminMro)).toBe(2);
      const [first] = await listAs(tx, SEED.adminMro);

      await actAs(tx, SEED.adminMro);
      const markOne = () =>
        tx.query<{ n: number }>("select public.mark_notifications_read($1) as n", [first!.id]);
      expect((await markOne()).rows[0]!.n).toBe(1);
      const readAt = (await listAs(tx, SEED.adminMro)).find((n) => n.id === first!.id)!.read_at;
      expect(readAt).not.toBeNull();
      await actAs(tx, SEED.adminMro);
      expect((await markOne()).rows[0]!.n).toBe(1);
      expect((await listAs(tx, SEED.adminMro)).find((n) => n.id === first!.id)!.read_at).toEqual(
        readAt,
      );
      expect(await unreadAs(tx, SEED.adminMro)).toBe(1);

      expect(
        (await tx.query<{ n: number }>("select public.mark_notifications_read() as n")).rows[0]!.n,
      ).toBe(1);
      expect(await unreadAs(tx, SEED.adminMro)).toBe(0);
      // The manager's copies are theirs: still unread.
      expect(await unreadAs(tx, SEED.managerMro)).toBe(2);
      // An unknown id matches nothing.
      await actAs(tx, SEED.adminMro);
      expect(
        (
          await tx.query<{ n: number }>("select public.mark_notifications_read($1) as n", [
            randomUUID(),
          ])
        ).rows[0]!.n,
      ).toBe(0);
    });
  });

  it("notices older than 180 days are hidden, then pruned with the recipient's next notice", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await makeAvailable(tx, [SEED.delta, SEED.echo]);
      const delta = await applyAs(tx, SEED.delta, need);
      await asOwner(tx);
      await tx.query(
        "update public.notifications set created_at = now() - interval '181 days' where application_id = $1",
        [delta],
      );
      expect(await listAs(tx, SEED.adminMro)).toEqual([]);
      expect(await unreadAs(tx, SEED.adminMro)).toBe(0);
      expect(await noticesOf(tx, [delta])).toHaveLength(2); // still stored (unreadable)…
      await applyAs(tx, SEED.echo, need); // …until the next notice for those recipients
      expect(await noticesOf(tx, [delta])).toHaveLength(0);
      expect(await unreadAs(tx, SEED.adminMro)).toBe(1);
    });
  });

  it("marking read also prunes the reader's expired notices", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await makeAvailable(tx, [SEED.delta]);
      const app = await applyAs(tx, SEED.delta, need);
      await asOwner(tx);
      await tx.query(
        "update public.notifications set created_at = now() - interval '181 days' where application_id = $1",
        [app],
      );
      await actAs(tx, SEED.adminMro);
      await tx.query("select public.mark_notifications_read()");
      expect(recipients(await noticesOf(tx, [app]))).toEqual([SEED.managerMro]);
    });
  });

  it("T-73: a recipient keeps at most their newest 200 notices, whatever the other party does", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await makeAvailable(tx, [SEED.delta, SEED.echo]);
      const delta = await applyAs(tx, SEED.delta, need);
      // Owner fixture: 230 older notices for adminMro (a flood written before).
      await asOwner(tx);
      await tx.query(
        `insert into public.notifications (recipient_id, kind, application_id, application_status, created_at)
         select $1, 'application', $2, 'withdrawn', now() - make_interval(mins => g)
         from generate_series(1, 230) g`,
        [SEED.adminMro, delta],
      );
      const echo = await applyAs(tx, SEED.echo, need); // the next notice prunes
      await asOwner(tx);
      const kept = await tx.query<{ n: number; newest: boolean }>(
        `select count(*)::int as n,
                bool_or(application_id = $2) as newest
         from public.notifications where recipient_id = $1`,
        [SEED.adminMro, echo],
      );
      expect(kept.rows[0]).toEqual({ n: 200, newest: true });
      const page = await listAs(tx, SEED.adminMro, 0, 50);
      // The two real notices share one now() (one transaction): either may come first.
      expect(page.slice(0, 2).map((n) => n.application_id)).toContain(echo);
      expect(page[0]!.total).toBe(200);
    });
  });

  it("T-73: an apply/withdraw loop keeps one unread notice per recipient and pushes nothing else out", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await makeAvailable(tx, [SEED.delta, SEED.echo]);
      const echo = await applyAs(tx, SEED.echo, need); // another applicant's notice, unread
      let last = "";
      for (let i = 0; i < 6; i += 1) {
        last = await applyAs(tx, SEED.delta, need);
        await step(tx, SEED.delta, last, "withdrawn");
      }
      for (const manager of [SEED.adminMro, SEED.managerMro]) {
        const listed = await listAs(tx, manager);
        expect(
          listed.map((n) => `${n.application_id}:${n.application_status}`).sort(),
          manager,
        ).toEqual([`${echo}:received`, `${last}:withdrawn`].sort());
        expect(await unreadAs(tx, manager), manager).toBe(2);
      }
      // Once read, the next event of that applicant is a new notice again.
      await actAs(tx, SEED.adminMro);
      await tx.query("select public.mark_notifications_read()");
      const again = await applyAs(tx, SEED.delta, need);
      // (one transaction = one now(): compared as a set, not by position)
      expect(
        (await listAs(tx, SEED.adminMro))
          .map(
            (n) => `${n.application_id}:${n.application_status}:${n.read_at ? "read" : "unread"}`,
          )
          .sort(),
      ).toEqual(
        [`${echo}:received:read`, `${last}:withdrawn:read`, `${again}:received:unread`].sort(),
      );
    });
  });

  it("losing admin/manager deletes that organization's notices at once; the technician side stays", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await makeAvailable(tx, [SEED.delta]);
      const app = await applyAs(tx, SEED.delta, need);
      await step(tx, SEED.managerMro, app, "shortlisted");
      // The manager also has notices as an applicant elsewhere (Lisbon): those are not touched.
      const lisbonNeed = await createNeed(tx, lisbonId, SEED.adminOther);
      await asOwner(tx);
      const own = randomUUID();
      await tx.query(
        "insert into public.applications (id, requirement_id, technician_profile_id, status) values ($1, $2, $3, 'received')",
        [own, lisbonNeed, SEED.managerMro],
      );
      await tx.query(
        "insert into public.notifications (recipient_id, kind, application_id, application_status) values ($1, 'application', $2, 'shortlisted')",
        [SEED.managerMro, own],
      );
      expect(await unreadAs(tx, SEED.managerMro)).toBe(2);

      await actAs(tx, SEED.adminMro);
      const demoted = await tx.query(
        "update public.organization_members set role = 'member' where organization_id = $1 and profile_id = $2",
        [mroId, SEED.managerMro],
      );
      expect(demoted.affectedRows).toBe(1);
      expect(recipients(await noticesOf(tx, [app]))).toEqual([SEED.adminMro, SEED.delta].sort());
      expect((await listAs(tx, SEED.managerMro)).map((n) => n.application_id)).toEqual([own]);

      // Removal does the same for the admin.
      await asOwner(tx);
      await tx.query(
        "delete from public.organization_members where organization_id = $1 and profile_id = $2",
        [mroId, SEED.adminMro],
      );
      expect(recipients(await noticesOf(tx, [app]))).toEqual([SEED.delta]);
    });
  });

  it("deleting the application (account deletion cascade) deletes its notices", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await makeAvailable(tx, [SEED.delta]);
      const app = await applyAs(tx, SEED.delta, need);
      expect(await noticesOf(tx, [app])).toHaveLength(2);
      await asOwner(tx);
      await tx.query("delete from public.applications where id = $1", [app]);
      expect(await noticesOf(tx, [app])).toHaveLength(0);
    });
  });

  it("the pseudonym helper is the pool's expression", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const need = await createNeed(tx, mroId, SEED.adminMro);
      await makeAvailable(tx, [SEED.delta]);
      await applyAs(tx, SEED.delta, need);
      await actAs(tx, SEED.adminMro);
      const pool = await tx.query<{ candidate_ref: string }>(
        "select candidate_ref from public.get_requirement_applications($1)",
        [need],
      );
      await asOwner(tx);
      const helper = await tx.query<{ ref: string }>(
        "select app_private.candidate_pseudonym($1, $2) as ref",
        [need, SEED.delta],
      );
      expect(helper.rows[0]!.ref).toBe(pool.rows[0]!.candidate_ref);
    });
  });
});
