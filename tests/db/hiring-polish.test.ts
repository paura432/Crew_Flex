// Package hiring-polish (v2 diff area 30: v2-05, v2-08, v2-20, v2-26, v2-27). Migrations
// 20261024100000 (list_opportunities, apply_to_requirement) and 20261024100100 (organization-wide
// applications and per-requirement counts). Every case runs in a rolled-back transaction.
import { createHash, randomUUID } from "node:crypto";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, orgIdByName, SEED } from "./harness";
import { APPLICATION_CONFLICTS } from "../../src/domain/applications";
import { confirmedCoverage, seatsTaken, type StatusCounts } from "../../src/domain/coverage";

let db: PGlite;
let mroId: string;
let otherOrgId: string;
let airlineId: string;

beforeAll(async () => {
  db = await createTestDatabase();
  mroId = await orgIdByName(db, "Demo MRO Madrid");
  otherOrgId = await orgIdByName(db, "Demo Aero Services Lisbon");
  airlineId = await orgIdByName(db, "Demo Airline Ops Barcelona");
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
  opts: {
    org: string;
    createdBy: string;
    title?: string;
    headcount?: number;
    status?: string;
    startsIn?: string;
    endsIn?: string;
  },
): Promise<string> {
  await tx.exec("reset role");
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.work_requirements
       (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
     values ($1, $2, 'Madrid (MAD)', now() + $3::interval, now() + $4::interval, 'day', $5, 'planned', $6, $7)
     returning id`,
    [
      opts.org,
      opts.title ?? "Hiring polish fixture",
      opts.startsIn ?? "5 days",
      opts.endsIn ?? "8 days",
      opts.headcount ?? 1,
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

/** Owner-side shortcut: an application already in `status` (proposal v1 when the state needs one). */
async function seedApplication(tx: Transaction, need: string, technician: string, status: string) {
  await tx.exec("reset role");
  const id = randomUUID();
  const proposal = ["proposed", "accepted", "confirmed", "finished", "cancelled"].includes(status)
    ? randomUUID()
    : null;
  const accepted = ["accepted", "confirmed", "finished", "cancelled"].includes(status)
    ? proposal
    : null;
  await tx.query(
    `insert into public.applications
       (id, requirement_id, technician_profile_id, status, current_proposal_id, accepted_proposal_id, reason)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      need,
      technician,
      status,
      proposal,
      accepted,
      ["rejected", "cancelled"].includes(status) ? "Fixture" : null,
    ],
  );
  if (proposal)
    await tx.query(
      "insert into public.application_proposals (id, application_id, version, terms) values ($1, $2, 1, '{}')",
      [proposal, id],
    );
  return id;
}

const APPLY = "select * from public.apply_to_requirement($1, $2, true)";

async function applyAs(tx: Transaction, technician: string, need: string, key = randomUUID()) {
  await actAs(tx, technician);
  return (await tx.query<{ id: string; replayed: boolean }>(APPLY, [need, key])).rows[0]!;
}

async function listedIds(
  tx: Transaction,
  user: string,
  sql = "select id from public.list_opportunities()",
) {
  await actAs(tx, user);
  return (await tx.query<{ id: string }>(sql)).rows.map((r) => r.id);
}

describe("list_opportunities: own organizations hidden, organization members list the network (20261024100000)", () => {
  it("v2-27 (T-90): professionals who are members never see their own organization's requirements", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const mro = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      const lis = await createNeed(tx, { org: otherOrgId, createdBy: SEED.adminOther });
      const bcn = await createNeed(tx, { org: airlineId, createdBy: SEED.adminAirline });
      // Delta belongs to no organization: everything published.
      expect(await listedIds(tx, SEED.delta)).toEqual(expect.arrayContaining([mro, lis, bcn]));
      // Alpha (member) and the MRO manager (a professional too): not MRO's own need.
      for (const member of [SEED.alpha, SEED.managerMro]) {
        const ids = await listedIds(tx, member);
        expect(ids).not.toContain(mro);
        expect(ids).toEqual(expect.arrayContaining([lis, bcn]));
        await actAs(tx, member);
        expect((await tx.query("select * from public.list_opportunities($1)", [mro])).rows).toEqual(
          [],
        );
      }
    });
  });

  it("v2-20: organization accounts list the network with the professionals' fixed projection, minus their own", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const mro = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      const lis = await createNeed(tx, { org: otherOrgId, createdBy: SEED.adminOther });
      for (const user of [SEED.adminMro, SEED.charlieMember]) {
        const ids = await listedIds(tx, user);
        expect(ids).toContain(lis);
        expect(ids).not.toContain(mro);
      }
      const lisIds = await listedIds(tx, SEED.adminOther);
      expect(lisIds).toContain(mro);
      expect(lisIds).not.toContain(lis);

      await actAs(tx, SEED.adminMro);
      const { rows } = await tx.query<Record<string, unknown>>(
        "select * from public.list_opportunities($1)",
        [lis],
      );
      expect(Object.keys(rows[0]!).sort()).toEqual(
        [
          "client_name", // the represented client's name, null here (20261024500100)
          "conditions",
          "country",
          "created_at",
          "description",
          "ends_at",
          "headcount",
          "id",
          "location",
          "organization_name",
          "qualifications",
          "shift",
          "shifts",
          "starts_at",
          "time_zone",
          "title",
          "total",
          "urgency",
        ].sort(),
      );
      expect(rows[0]!.organization_name).toBe("Demo Aero Services Lisbon");
      const text = JSON.stringify(rows[0]);
      for (const secret of [otherOrgId, SEED.adminOther]) expect(text).not.toContain(secret);
    });
  });

  it("still 42501 for an account with neither a technician profile nor a membership; anon denied", async () => {
    const orphan = "00000000-0000-4000-9400-000000000001";
    await asUser(db, SEED.adminMro, async (tx) => {
      await tx.exec("reset role");
      await tx.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         values ($1, 'orphan@crewflex.test', '{"account_type":"organization","display_name":"Orphan"}')`,
        [orphan],
      );
      await tx.query("delete from public.organization_members where profile_id = $1", [orphan]);
      await actAs(tx, orphan);
      expect((await sqlError(tx, "select * from public.list_opportunities()")).code).toBe("42501");
    });
    await asUser(db, null, async (tx) => {
      expect((await sqlError(tx, "select * from public.list_opportunities()")).message).toMatch(
        /permission denied/,
      );
    });
  });

  it("v2-26 (T-91): the search also matches a required qualification's code or name, literally", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const lis = await createNeed(tx, {
        org: otherOrgId,
        createdBy: SEED.adminOther,
        title: "Line support night shift",
      });
      await tx.exec("reset role");
      const { rows: names } = await tx.query<{ name: string }>(
        "select name from public.qualification_types where code = 'TR-A320'",
      );
      await actAs(tx, SEED.delta);
      const search = async (q: string) =>
        (
          await tx.query<{ id: string }>("select id from public.list_opportunities(p_q => $1)", [q])
        ).rows.map((r) => r.id);
      expect(await search("tr-a320")).toContain(lis); // code, case-insensitive
      expect(await search(names[0]!.name.toUpperCase())).toContain(lis); // name
      expect(await search("line support")).toContain(lis); // title still
      expect(await search("TR-A3_0")).not.toContain(lis); // `_` is literal, never a wildcard
      expect(await search("B9.9 nothing")).toEqual([]);
    });
  });
});

describe("apply_to_requirement: CFA13 OWN_ORGANIZATION (20261024100000)", () => {
  it("CFA13 is the 13th APPLICATION_CONFLICTS entry", () => {
    expect(conflict("OWN_ORGANIZATION")).toBe("CFA13");
  });

  it("a member (any role) cannot apply to its organization's requirement; another organization's is fine", async () => {
    await asUser(db, SEED.alpha, async (tx) => {
      const own = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro, headcount: 2 });
      const other = await createNeed(tx, { org: otherOrgId, createdBy: SEED.adminOther });
      await makeAvailable(tx, [SEED.alpha, SEED.delta]);
      // Delta (eligible) becomes a manager of the Lisbon MRO: refused there, like Alpha (member) here.
      await tx.query(
        "insert into public.organization_members (organization_id, profile_id, role) values ($1, $2, 'manager')",
        [otherOrgId, SEED.delta],
      );
      for (const [member, need] of [
        [SEED.alpha, own],
        [SEED.delta, other],
      ] as const) {
        await actAs(tx, member);
        expect((await sqlError(tx, APPLY, [need, randomUUID()])).code).toBe(
          conflict("OWN_ORGANIZATION"),
        );
      }
      // An ineligible member gets the eligibility reason first (CFA13 is the last check).
      await actAs(tx, SEED.managerMro);
      expect((await sqlError(tx, APPLY, [own, randomUUID()])).code).toBe(
        conflict("QUALIFICATION_INVALID"),
      );
      await tx.exec("reset role");
      expect(
        (
          await tx.query("select 1 from public.applications where requirement_id in ($1, $2)", [
            own,
            other,
          ])
        ).rows,
      ).toHaveLength(0);
      expect((await applyAs(tx, SEED.alpha, other)).replayed).toBe(false);
    });
  });

  it("the existing reasons keep their precedence; a replay still returns its own earlier result", async () => {
    await asUser(db, SEED.alpha, async (tx) => {
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
      await makeAvailable(tx, [SEED.alpha]);
      await actAs(tx, SEED.alpha);
      expect((await sqlError(tx, APPLY, [paused, randomUUID()])).code).toBe(
        conflict("REQUIREMENT_NOT_OPEN"),
      );
      expect((await sqlError(tx, APPLY, [started, randomUUID()])).code).toBe(
        conflict("REQUIREMENT_STARTED"),
      );
      expect((await sqlError(tx, APPLY, [far, randomUUID()])).code).toBe(
        conflict("AVAILABILITY_INCOMPLETE"),
      );

      // Delta applies, then joins the organization: the same key replays, a new key is refused.
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro, headcount: 2 });
      await makeAvailable(tx, [SEED.delta]);
      const key = randomUUID();
      const first = await applyAs(tx, SEED.delta, need, key);
      await tx.exec("reset role");
      await tx.query(
        "insert into public.organization_members (organization_id, profile_id, role) values ($1, $2, 'member')",
        [mroId, SEED.delta],
      );
      expect(await applyAs(tx, SEED.delta, need, key)).toEqual({ id: first.id, replayed: true });
      await actAs(tx, SEED.delta);
      expect((await sqlError(tx, APPLY, [need, randomUUID()])).code).toBe(
        conflict("ALREADY_APPLIED"),
      );
    });
  });
});

const ORG_APPS = "select * from public.get_organization_applications($1, $2, $3, $4, $5)";

describe("get_organization_applications: one page of the organization's applications (20261024100100)", () => {
  it("admin/manager only, newest first, total, filters; rows are exactly get_requirement_applications'", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      const a = await createNeed(tx, {
        org: mroId,
        createdBy: SEED.adminMro,
        title: "Need A",
        headcount: 3,
      });
      const b = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro, title: "Need B" });
      const lis = await createNeed(tx, {
        org: otherOrgId,
        createdBy: SEED.adminOther,
        title: "Need L",
      });
      await makeAvailable(tx, [SEED.delta, SEED.echo, SEED.hotelPrivate]);
      const d = await applyAs(tx, SEED.delta, a);
      const e = await applyAs(tx, SEED.echo, a);
      const h = await applyAs(tx, SEED.hotelPrivate, b);
      await applyAs(tx, SEED.delta, lis); // another organization's: never listed for MRO
      await tx.exec("reset role");
      // Distinct creation instants (one transaction shares now()): d oldest … h newest.
      await tx.query(
        `update public.applications set created_at = now() - (interval '1 minute' * x.n)
         from (values ($1::uuid, 3), ($2::uuid, 2), ($3::uuid, 1)) as x(id, n) where applications.id = x.id`,
        [d.id, e.id, h.id],
      );

      for (const manager of [SEED.managerMro, SEED.adminMro]) {
        await actAs(tx, manager);
        const all = await tx.query<Record<string, unknown>>(ORG_APPS, [mroId, null, null, 20, 0]);
        const ids = all.rows.map((r) => r.application_id);
        expect(ids.slice(0, 3)).toEqual([h.id, e.id, d.id]); // newest first
        expect(Number(all.rows[0]!.total)).toBe(ids.length);
        expect(all.rows.every((r) => [a, b].includes(r.requirement_id as string))).toBe(true);
      }

      await actAs(tx, SEED.managerMro);
      const page = await tx.query<Record<string, unknown>>(ORG_APPS, [mroId, null, null, 1, 1]);
      expect(page.rows.map((r) => r.application_id)).toEqual([e.id]);
      expect(Number(page.rows[0]!.total)).toBe(3);
      const onlyA = await tx.query<Record<string, unknown>>(ORG_APPS, [mroId, a, null, 20, 0]);
      expect(onlyA.rows.map((r) => r.application_id).sort()).toEqual([d.id, e.id].sort());
      await tx.exec("reset role");
      await tx.query("update public.applications set status = 'shortlisted' where id = $1", [e.id]);
      await actAs(tx, SEED.managerMro);
      const shortlisted = await tx.query<Record<string, unknown>>(ORG_APPS, [
        mroId,
        null,
        "shortlisted",
        20,
        0,
      ]);
      expect(shortlisted.rows.map((r) => r.application_id)).toEqual([e.id]);
      expect(Number(shortlisted.rows[0]!.total)).toBe(1);
      // Another organization's requirement as the filter: nothing, the same as a random id.
      expect((await tx.query(ORG_APPS, [mroId, lis, null, 20, 0])).rows).toEqual([]);
      expect((await tx.query(ORG_APPS, [mroId, randomUUID(), null, 20, 0])).rows).toEqual([]);

      // Every applicant column equals the per-requirement function's row (it is called, not copied).
      const perRequirement = await tx.query<Record<string, unknown>>(
        "select * from public.get_requirement_applications($1)",
        [a],
      );
      const onlyANow = await tx.query<Record<string, unknown>>(ORG_APPS, [mroId, a, null, 20, 0]);
      for (const row of onlyANow.rows) {
        const same = perRequirement.rows.find((r) => r.application_id === row.application_id)!;
        for (const [key, value] of Object.entries(same)) expect(row[key]).toEqual(value);
        const card = row.requirement as Record<string, unknown>;
        expect([card.id, card.title, card.status, card.organizationName]).toEqual([
          a,
          "Need A",
          "open",
          "Demo MRO Madrid",
        ]);
      }
      // Pseudonyms per requirement; the private applicant's id never leaves.
      const hotelRow = (await tx.query<Record<string, unknown>>(ORG_APPS, [mroId, b, null, 20, 0]))
        .rows[0]!;
      expect(hotelRow.candidate_ref).toBe(
        "CF-" +
          createHash("sha256")
            .update(`${b}:${SEED.hotelPrivate}`)
            .digest("hex")
            .slice(0, 10)
            .toUpperCase(),
      );
      expect(JSON.stringify(hotelRow)).not.toContain(SEED.hotelPrivate);
      expect(hotelRow.candidate_display_name).toBeNull();
    });
  });

  it("a technician who closed the account stays listed (status, history, seat) without an applicant", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro, headcount: 2 });
      // Cancelled by the technician with their own words, then the account closes.
      const gone = await seedApplication(tx, need, SEED.echo, "cancelled");
      const live = await seedApplication(tx, need, SEED.delta, "received");
      await tx.exec("reset role");
      // Account closure (20261023400100): the application outlives the profile (technician → NULL).
      await tx.query("delete from auth.identities where user_id = $1", [SEED.echo]);
      await tx.query("delete from auth.users where id = $1", [SEED.echo]);
      expect(
        (
          await tx.query<{ t: string | null }>(
            "select technician_profile_id as t from public.applications where id = $1",
            [gone],
          )
        ).rows[0]!.t,
      ).toBeNull();
      await actAs(tx, SEED.managerMro);
      const { rows } = await tx.query<Record<string, unknown>>(ORG_APPS, [
        mroId,
        need,
        null,
        20,
        0,
      ]);
      expect(rows.map((r) => r.application_id).sort()).toEqual([gone, live].sort());
      const closed = rows.find((r) => r.application_id === gone)!;
      expect(closed.status).toBe("cancelled");
      expect(closed.reason).toBeNull(); // the free text does not outlive the account (review LOW-1)
      for (const column of Object.keys(closed).filter((k) => k.startsWith("candidate_")))
        expect(closed[column], column).toBeNull();
      expect(Number(closed.total)).toBe(2);
      const counts = await tx.query<{ counts: StatusCounts }>(
        "select counts from public.get_requirement_application_counts($1) where requirement_id = $2",
        [mroId, need],
      );
      expect(counts.rows[0]!.counts).toEqual({ cancelled: 1, received: 1 }); // still counted
      expect(seatsTaken(counts.rows[0]!.counts)).toBe(0);
    });
  });

  it("42501 for a plain member, another organization, a professional; anon denied; bounds clamp", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      for (const user of [SEED.charlieMember, SEED.adminOther, SEED.delta, SEED.platformAdmin]) {
        await actAs(tx, user);
        expect((await sqlError(tx, ORG_APPS, [mroId, null, null, 20, 0])).code).toBe("42501");
      }
      const need = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro, headcount: 5 });
      await makeAvailable(tx, [SEED.delta]);
      await applyAs(tx, SEED.delta, need);
      await actAs(tx, SEED.managerMro);
      expect((await tx.query(ORG_APPS, [mroId, need, null, 1000, -5])).rows.length).toBe(1); // limit clamps to 50, offset to 0
    });
    await asUser(db, null, async (tx) => {
      expect((await sqlError(tx, ORG_APPS, [mroId, null, null, 20, 0])).message).toMatch(
        /permission denied/,
      );
    });
  });
});

describe("get_requirement_application_counts: per-requirement counters and confirmed coverage (20261024100100)", () => {
  it("counts per status of each requirement with applications; coverage = confirmed + finished vs headcount", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      const a = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro, headcount: 2 });
      const b = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro, headcount: 1 });
      const empty = await createNeed(tx, { org: mroId, createdBy: SEED.adminMro });
      const lis = await createNeed(tx, { org: otherOrgId, createdBy: SEED.adminOther });
      await seedApplication(tx, a, SEED.delta, "confirmed");
      await seedApplication(tx, a, SEED.echo, "accepted");
      await seedApplication(tx, a, SEED.hotelPrivate, "rejected");
      await seedApplication(tx, b, SEED.delta, "finished");
      await seedApplication(tx, lis, SEED.echo, "confirmed");

      await actAs(tx, SEED.managerMro);
      const { rows } = await tx.query<{
        requirement_id: string;
        headcount: number;
        starts_at: Date;
        ends_at: Date;
        shift_count: number | null;
        counts: StatusCounts;
      }>("select * from public.get_requirement_application_counts($1)", [mroId]);
      const byId = new Map(rows.map((r) => [r.requirement_id, r]));
      expect(byId.has(empty)).toBe(false); // only requirements that received applications
      expect(byId.has(lis)).toBe(false); // never another organization's
      expect(byId.get(a)!.counts).toEqual({ confirmed: 1, accepted: 1, rejected: 1 });
      expect(byId.get(a)!.headcount).toBe(2);
      expect(byId.get(b)!.counts).toEqual({ finished: 1 });
      // v2-08 acceptance: B (here `a`) with 1 of 2 confirmed is 50 %; a full one is 100 %.
      expect(confirmedCoverage(2, seatsTaken(byId.get(a)!.counts)).percent).toBe(50);
      expect(confirmedCoverage(1, seatsTaken(byId.get(b)!.counts)).percent).toBe(100);
      expect(byId.get(a)!.shift_count).toBeNull(); // a continuous period (no shifts)
      expect(Object.keys(rows[0]!).sort()).toEqual(
        ["counts", "ends_at", "headcount", "requirement_id", "shift_count", "starts_at"].sort(),
      );

      for (const user of [SEED.charlieMember, SEED.adminOther, SEED.delta, SEED.platformAdmin]) {
        await actAs(tx, user);
        expect(
          (
            await sqlError(tx, "select * from public.get_requirement_application_counts($1)", [
              mroId,
            ])
          ).code,
        ).toBe("42501");
      }
    });
    await asUser(db, null, async (tx) => {
      expect(
        (await sqlError(tx, "select * from public.get_requirement_application_counts($1)", [mroId]))
          .message,
      ).toMatch(/permission denied/);
    });
  });
});
