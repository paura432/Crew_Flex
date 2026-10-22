// PKG calendar — N-04: the days of a confirmed assignment are protected (migration 20261023300000,
// BR-4.9, T-15/T-16). PGlite, every test in a transaction that is rolled back (harness `asUser`).
import { randomUUID } from "node:crypto";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, orgIdByName, SEED } from "./harness";
import { AVAILABILITY_CONFLICTS } from "../../src/domain/availability";

let db: PGlite;
let mroId: string;

beforeAll(async () => {
  db = await createTestDatabase();
  mroId = await orgIdByName(db, "Demo MRO Madrid");
});

const DAY = 86_400_000;
const midnight = (() => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
})();
/** `n` UTC days from today at 00:00, as ISO. */
const at = (n: number) => new Date(midnight + n * DAY).toISOString();
const date = (n: number) => at(n).slice(0, 10);

type Status = "available" | "unavailable" | "aog_only";

async function actAs(tx: Transaction, userId: string) {
  await tx.exec("reset role");
  await tx.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
  await tx.exec("set local role authenticated");
}

/** SQLSTATE of a statement expected to fail (a savepoint keeps the transaction usable). */
async function sqlState(tx: Transaction, sql: string, params: unknown[] = []) {
  await tx.exec("savepoint expected_error");
  try {
    await tx.query(sql, params);
  } catch (error) {
    await tx.exec("rollback to savepoint expected_error");
    return (error as { code?: string }).code;
  }
  await tx.exec("release savepoint expected_error");
  return null;
}

/**
 * Owner-side fixture: `technician` holds an application in `status` to a requirement over days
 * [from, to) and exactly the windows given (their seed windows are removed first).
 */
async function assignment(
  tx: Transaction,
  opts: {
    technician?: string;
    status?: string;
    urgency?: "planned" | "urgent" | "aog";
    from?: number;
    to?: number;
    windows?: [from: number, to: number, status: Status][];
  } = {},
) {
  const technician = opts.technician ?? SEED.delta;
  const status = opts.status ?? "confirmed";
  await tx.exec("reset role");
  await tx.query("delete from public.availability_windows where technician_profile_id = $1", [
    technician,
  ]);
  const windows: string[] = [];
  for (const [from, to, s] of opts.windows ?? [[5, 20, "available"]]) {
    const { rows } = await tx.query<{ id: string }>(
      `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
       values ($1, $2, $3, $4) returning id`,
      [technician, at(from), at(to), s],
    );
    windows.push(rows[0]!.id);
  }
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.work_requirements
       (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
     values ($1, 'Calendar fixture', 'Madrid (MAD)', $2, $3, 'day', 2, $4, 'open', $5) returning id`,
    [mroId, at(opts.from ?? 10), at(opts.to ?? 12), opts.urgency ?? "planned", SEED.adminMro],
  );
  const requirement = rows[0]!.id;
  await tx.query(
    `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
     select $1, id, 'hard' from public.qualification_types where code = 'B1.1'`,
    [requirement],
  );
  const application = randomUUID();
  const proposal = ["proposed", "accepted", "confirmed", "finished", "cancelled"].includes(status)
    ? randomUUID()
    : null;
  await tx.query(
    `insert into public.applications
       (id, requirement_id, technician_profile_id, status, current_proposal_id, accepted_proposal_id, reason)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      application,
      requirement,
      technician,
      status,
      proposal,
      ["accepted", "confirmed", "finished", "cancelled"].includes(status) ? proposal : null,
      ["rejected", "cancelled"].includes(status) ? "Fixture" : null,
    ],
  );
  if (proposal)
    await tx.query(
      "insert into public.application_proposals (id, application_id, version, terms) values ($1, $2, 1, '{}')",
      [proposal, application],
    );
  return { requirement, application, windows };
}

const PUT = "select * from public.replace_availability_days($1, $2::jsonb)";
const put = (days: { date: string; status: Status | null }[]) => [
  randomUUID(),
  JSON.stringify(days),
];
const POST = "select * from public.create_availability_window($1, $2, $3, $4)";
const post = (from: number, to: number, status: Status) => [randomUUID(), at(from), at(to), status];

const CONFLICT = "CFV01";

describe("N-04 · the days of a confirmed assignment are protected (20261023300000)", () => {
  it("CFV01 is ASSIGNMENT_PROTECTED, the first entry of AVAILABILITY_CONFLICTS", () => {
    expect(AVAILABILITY_CONFLICTS[Number(CONFLICT.slice(3)) - 1]).toBe("ASSIGNMENT_PROTECTED");
  });

  it("rule 1: the calendar save refuses every assigned day, whatever the new status", async () => {
    await asUser(db, null, async (tx) => {
      await assignment(tx);
      await actAs(tx, SEED.delta);
      for (const status of ["available", "unavailable", "aog_only", null] as const)
        expect(await sqlState(tx, PUT, put([{ date: date(11), status }]))).toBe(CONFLICT);
      // One assigned day in a batch refuses the whole batch: nothing is written.
      expect(
        await sqlState(
          tx,
          PUT,
          put([
            { date: date(3), status: "available" },
            { date: date(10), status: "available" },
          ]),
        ),
      ).toBe(CONFLICT);
      const { rows } = await tx.query(
        "select 1 from public.availability_windows where technician_profile_id = $1 and starts_at = $2",
        [SEED.delta, at(3)],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it("rule 1: the day after the period is free, and cutting it out of the covering window keeps the assignment covered", async () => {
    await asUser(db, null, async (tx) => {
      const { requirement } = await assignment(tx); // window days 5–20, assignment days 10–12
      await actAs(tx, SEED.delta);
      // Days 8 and 13 sit inside the same window as the assignment: the window is split around them.
      expect(
        await sqlState(
          tx,
          PUT,
          put([
            { date: date(8), status: null },
            { date: date(13), status: "unavailable" },
          ]),
        ),
      ).toBeNull();
      await tx.exec("reset role");
      const { rows } = await tx.query<{ availability_ok: boolean }>(
        "select availability_ok from app_private.hard_eligibility($1, $2)",
        [requirement, SEED.delta],
      );
      expect(rows[0]!.availability_ok).toBe(true);
    });
  });

  it("rule 2: a new window that blocks part of the assignment is refused; one that adds availability is not", async () => {
    await asUser(db, null, async (tx) => {
      await assignment(tx);
      await actAs(tx, SEED.delta);
      expect(await sqlState(tx, POST, post(11, 12, "unavailable"))).toBe(CONFLICT);
      // «AOG only» blocks a planned need (BR-4.8).
      expect(await sqlState(tx, POST, post(10, 11, "aog_only"))).toBe(CONFLICT);
      expect(await sqlState(tx, POST, post(9, 13, "available"))).toBeNull();
      expect(await sqlState(tx, POST, post(14, 15, "unavailable"))).toBeNull();
    });
  });

  it("rule 2: «AOG only» over an AOG assignment is availability, not a block", async () => {
    await asUser(db, null, async (tx) => {
      const { windows } = await assignment(tx, { urgency: "aog" });
      await actAs(tx, SEED.delta);
      expect(await sqlState(tx, POST, post(10, 12, "aog_only"))).toBeNull();
      expect(
        await sqlState(
          tx,
          "update public.availability_windows set status = 'aog_only' where id = $1",
          [windows[0]],
        ),
      ).toBeNull();
    });
  });

  it("rule 2: PATCH (PostgREST) that shrinks, moves or re-labels the covering window is refused; widening it is not", async () => {
    await asUser(db, null, async (tx) => {
      const { windows } = await assignment(tx);
      const id = windows[0];
      await actAs(tx, SEED.delta);
      const patch = (set: string, params: unknown[] = []) =>
        sqlState(tx, `update public.availability_windows set ${set} where id = $1`, [
          id,
          ...params,
        ]);
      expect(await patch("ends_at = $2", [at(11)])).toBe(CONFLICT);
      expect(await patch("starts_at = $2, ends_at = $3", [at(30), at(40)])).toBe(CONFLICT);
      expect(await patch("status = 'unavailable'")).toBe(CONFLICT);
      expect(await patch("status = 'aog_only'")).toBe(CONFLICT);
      expect(await patch("ends_at = $2", [at(25)])).toBeNull();
      expect(await patch("starts_at = $2", [at(10)])).toBeNull(); // still covers days 10–12
    });
  });

  it("rule 2: DELETE (PostgREST) of the covering window is refused; of an unrelated one is not", async () => {
    await asUser(db, null, async (tx) => {
      const { windows } = await assignment(tx, {
        windows: [
          [5, 20, "available"],
          [30, 31, "available"],
        ],
      });
      await actAs(tx, SEED.delta);
      const del = "delete from public.availability_windows where id = $1";
      expect(await sqlState(tx, del, [windows[0]])).toBe(CONFLICT);
      expect(await sqlState(tx, del, [windows[1]])).toBeNull();
      // A second window covering the same days makes the first one redundant: deleting it is fine.
      expect(await sqlState(tx, POST, post(9, 13, "available"))).toBeNull();
      expect(await sqlState(tx, del, [windows[0]])).toBeNull();
    });
  });

  it("T-16: only `confirmed` protects (v1.8 connected) — accepted, finished and cancelled do not", async () => {
    for (const status of ["accepted", "finished", "cancelled"]) {
      await asUser(db, null, async (tx) => {
        const { windows } = await assignment(tx, { status });
        await actAs(tx, SEED.delta);
        expect([status, await sqlState(tx, PUT, put([{ date: date(11), status: null }]))]).toEqual([
          status,
          null,
        ]);
        expect([
          status,
          await sqlState(tx, "delete from public.availability_windows where id = $1", [windows[0]]),
        ]).toEqual([status, null]);
      });
    }
  });

  it("an assignment left uncovered before the migration can be repaired: adding availability is never refused", async () => {
    await asUser(db, null, async (tx) => {
      await assignment(tx, { windows: [[30, 31, "available"]] }); // nothing covers days 10–12
      await actAs(tx, SEED.delta);
      expect(await sqlState(tx, POST, post(10, 11, "available"))).toBeNull(); // still partial
      expect(await sqlState(tx, POST, post(11, 12, "available"))).toBeNull();
    });
  });

  it("another technician's assignment never blocks the caller, and the helper answers only about the caller", async () => {
    await asUser(db, null, async (tx) => {
      await assignment(tx); // delta's
      await assignment(tx, { technician: SEED.echo, status: "received", from: 40, to: 41 });
      await actAs(tx, SEED.echo);
      expect(await sqlState(tx, PUT, put([{ date: date(11), status: "unavailable" }]))).toBeNull();
      const { rows } = await tx.query<{ hit: boolean }>(
        "select app_private.confirmed_assignment_overlaps($1, $2) as hit",
        [at(10), at(12)],
      );
      expect(rows[0]!.hit).toBe(false);
      await actAs(tx, SEED.delta);
      const own = await tx.query<{ hit: boolean }>(
        "select app_private.confirmed_assignment_overlaps($1, $2) as hit",
        [at(11), at(12)],
      );
      expect(own.rows[0]!.hit).toBe(true);
    });
  });

  it("grants: anon cannot call the helper; nobody calls the trigger function", async () => {
    await asUser(db, null, async (tx) => {
      expect(
        await sqlState(tx, "select app_private.confirmed_assignment_overlaps(now(), now())"),
      ).toBe("42501");
    });
    const { rows } = await db.query<{ anon: boolean; auth: boolean; helper: boolean }>(
      `select has_function_privilege('anon', 'public.protect_assignment_availability()', 'execute') as anon,
              has_function_privilege('authenticated', 'public.protect_assignment_availability()', 'execute') as auth,
              has_function_privilege('authenticated',
                'app_private.confirmed_assignment_overlaps(timestamptz, timestamptz)', 'execute') as helper`,
    );
    expect(rows[0]).toEqual({ anon: false, auth: false, helper: true });
  });

  it("end to end with transition_application: free before the confirmation, CFA04 if cut, protected after", async () => {
    await asUser(db, null, async (tx) => {
      const { application, windows } = await assignment(tx, { status: "accepted" });
      const confirm = async () => {
        await tx.exec("reset role");
        const { rows } = await tx.query<{ updated_at: Date }>(
          "select updated_at from public.applications where id = $1",
          [application],
        );
        await actAs(tx, SEED.managerMro);
        return sqlState(
          tx,
          "select * from public.transition_application($1, 'confirmed', $2, $3, null, null)",
          [application, rows[0]!.updated_at.toISOString(), randomUUID()],
        );
      };
      await actAs(tx, SEED.delta);
      // Accepted is not yet an assignment (T-16): the technician may still cut the period…
      expect(await sqlState(tx, PUT, put([{ date: date(11), status: null }]))).toBeNull();
      // …and then the confirmation's own re-check refuses it.
      expect(await confirm()).toBe("CFA04");
      await actAs(tx, SEED.delta);
      expect(await sqlState(tx, POST, post(11, 12, "available"))).toBeNull();
      expect(await confirm()).toBeNull();
      await actAs(tx, SEED.delta);
      expect(await sqlState(tx, PUT, put([{ date: date(10), status: null }]))).toBe(CONFLICT);
      expect(
        await sqlState(tx, "delete from public.availability_windows where id = $1", [windows[0]]),
      ).toBe(CONFLICT);
    });
  });

  it("account deletion still cascades: the profile's windows go without a CFV01", async () => {
    await asUser(db, null, async (tx) => {
      await assignment(tx);
      // Account deletion: windows and applications go with the profile; the trigger does not object.
      await tx.query("delete from auth.identities where user_id = $1", [SEED.delta]);
      await tx.query("delete from auth.users where id = $1", [SEED.delta]);
      const { rows } = await tx.query(
        "select 1 from public.availability_windows where technician_profile_id = $1",
        [SEED.delta],
      );
      expect(rows).toHaveLength(0);
    });
  });
});
