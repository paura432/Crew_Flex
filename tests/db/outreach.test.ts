// Package outreach (migrations 20261024400000…400200): the professional's notice preferences (N-10) and
// «Distribuir aviso Urgente / AOG» (v2-17). Owner-only preferences; the audience of requirement_outreach,
// each rule as a negative case next to a positive control; the notice readable by its recipient only and
// only while the requirement is published; the organization learns the count, never the recipients.
// Every case runs in a rolled-back transaction (harness `asUser`).
import { randomUUID } from "node:crypto";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { AIRCRAFT } from "@/domain/passport";
import { asUser, createTestDatabase, orgIdByName, SEED } from "./harness";

let db: PGlite;
let mroId: string;
let lisbonId: string;

const FOXTROT = "00000000-0000-4000-8000-000000000023";
const GOLF = "00000000-0000-4000-8000-000000000024"; // B1.1 still pending: not eligible
const INDIA = "00000000-0000-4000-8000-000000000026";
const KILO = "00000000-0000-4000-8000-000000000041";

beforeAll(async () => {
  db = await createTestDatabase();
  mroId = await orgIdByName(db, "Demo MRO Madrid");
  lisbonId = await orgIdByName(db, "Demo Aero Services Lisbon");
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
    const e = error as { code?: string; message: string };
    return { code: e.code, message: e.message };
  }
  throw new Error(`expected statement to fail: ${sql}`);
}

interface NeedOptions {
  org?: string;
  createdBy?: string;
  urgency?: "planned" | "urgent" | "aog";
  status?: "draft" | "open" | "paused";
  startsIn?: string;
  codes?: string[];
  conditions?: Record<string, unknown> | null;
}

/**
 * Owner fixture: a need (default: open AOG of Demo MRO Madrid, hard B1.1 + TR-A320, in 60 days — past
 * the seed's windows, so only those a case makes available are eligible).
 */
async function createNeed(tx: Transaction, options: NeedOptions = {}) {
  const {
    org = mroId,
    createdBy = SEED.adminMro,
    urgency = "aog",
    status = "open",
    startsIn = "60 days",
    codes = ["B1.1", "TR-A320"],
    conditions = null,
  } = options;
  await asOwner(tx);
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.work_requirements
       (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by,
        conditions)
     values ($1, 'Outreach need', 'Madrid (MAD)', now() + $2::interval, now() + $2::interval + interval '3 days',
             'day', 2, $3, $4, $5, $6)
     returning id`,
    [
      org,
      startsIn,
      urgency,
      status,
      createdBy,
      conditions === null ? null : JSON.stringify(conditions),
    ],
  );
  const id = rows[0]!.id;
  await tx.query(
    `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
     select $1, id, 'hard' from public.qualification_types where code = any ($2::text[])`,
    [id, codes],
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

interface Preferences {
  urgent?: boolean;
  aog?: boolean;
  mobilization?: number | null;
  zone?: string;
  quietStart?: string | null;
  quietEnd?: string | null;
}

/** The professional saves their own preferences through the RPC (default: AOG + urgent, 12 h, no quiet). */
async function savePreferences(tx: Transaction, profile: string, p: Preferences = {}) {
  await actAs(tx, profile);
  const { rows } = await tx.query<{ time_zone: string }>(
    "select * from public.save_notice_preferences($1, $2, $3, $4, $5, $6)",
    [
      p.urgent ?? true,
      p.aog ?? true,
      p.mobilization === undefined ? 12 : p.mobilization,
      p.zone ?? "Europe/Madrid",
      p.quietStart ?? null,
      p.quietEnd ?? null,
    ],
  );
  return rows[0]!;
}

/** Both technicians qualify on their own (available, opted in, mobilization declared). */
async function qualifying(tx: Transaction, profiles: string[]) {
  await makeAvailable(tx, profiles);
  for (const profile of profiles) await savePreferences(tx, profile);
}

async function distribute(tx: Transaction, actor: string, requirementId: string) {
  await actAs(tx, actor);
  const { rows } = await tx.query<{ notified: number; distributed_at: Date; urgency: string }>(
    "select * from public.requirement_outreach($1, $2)",
    [requirementId, randomUUID()],
  );
  return rows[0]!;
}

/** Owner view: who got an outreach notice for the requirement. */
async function recipientsOf(tx: Transaction, requirementId: string) {
  await asOwner(tx);
  const { rows } = await tx.query<{ recipient_id: string }>(
    "select recipient_id from public.notifications where kind = 'outreach' and requirement_id = $1 order by 1",
    [requirementId],
  );
  return rows.map((r) => r.recipient_id);
}

/**
 * One distribution, in its own rolled-back transaction, with Delta (the subject) and Foxtrot (the positive
 * control) set up to qualify, then `tweak` applied. Returns who the distribution notified.
 */
async function audienceAfter(
  tweak: (tx: Transaction, requirementId: string) => Promise<void>,
  need: NeedOptions = {},
) {
  return asUser(db, SEED.adminMro, async (tx) => {
    const requirementId = await createNeed(tx, need);
    await qualifying(tx, [SEED.delta, FOXTROT]);
    await tweak(tx, requirementId);
    const before = await recipientsOf(tx, requirementId);
    const result = await distribute(tx, SEED.adminMro, requirementId);
    const added = (await recipientsOf(tx, requirementId)).filter((r) => !before.includes(r));
    // T-128: Delta and Foxtrot (plus whoever a case adds) are fewer than 5 eligible: not reported.
    expect(result.notified === null || result.notified === added.length).toBe(true);
    expect(added, "the positive control is always notified").toContain(FOXTROT);
    return added;
  });
}

const noTweak = async () => {};

async function listAs(tx: Transaction, userId: string) {
  await actAs(tx, userId);
  const { rows } = await tx.query<{
    id: string;
    kind: string;
    audience: string;
    application_id: string | null;
    requirement_id: string;
    organization_name: string | null;
    candidate_name: string | null;
    candidate_ref: string | null;
    outreach_urgency: string | null;
  }>("select * from public.get_my_notifications(null, 0, 50)");
  return rows;
}

async function unreadAs(tx: Transaction, userId: string) {
  await actAs(tx, userId);
  const { rows } = await tx.query<{ n: number }>(
    "select public.count_my_unread_notifications() as n",
  );
  return rows[0]!.n;
}

describe("outreach: notice preferences are owner-only (migration 20261024400100)", () => {
  it("anon has no access to the table nor the save", async () => {
    await asUser(db, null, async (tx) => {
      for (const sql of [
        "select * from public.technician_notice_preferences",
        "select * from public.save_notice_preferences(true, true, 24, 'Europe/Madrid', null, null)",
      ]) {
        expect((await sqlError(tx, sql)).message, sql).toMatch(/permission denied/);
      }
    });
  });

  it("the owner saves and reads their row; nobody else reads it (organization, colleague, platform admin)", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const saved = await savePreferences(tx, SEED.delta, {
        quietStart: "22:00",
        quietEnd: "07:00",
      });
      expect(saved.time_zone).toBe("Europe/Madrid");
      await actAs(tx, SEED.delta);
      const own = await tx.query("select * from public.technician_notice_preferences");
      expect(own.rows).toHaveLength(1);
      for (const other of [SEED.echo, SEED.adminMro, SEED.managerMro, SEED.platformAdmin]) {
        await actAs(tx, other);
        const { rows } = await tx.query(
          "select * from public.technician_notice_preferences where profile_id = $1",
          [SEED.delta],
        );
        expect(rows, other).toHaveLength(0);
      }
    });
  });

  it("identity comes from the JWT: nobody writes another person's row, directly or through the RPC", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      await savePreferences(tx, SEED.delta, { aog: false, urgent: false });
      await actAs(tx, SEED.echo);
      const insert = await sqlError(
        tx,
        `insert into public.technician_notice_preferences (profile_id, aog_opt_in) values ($1, true)`,
        [SEED.delta],
      );
      expect(insert.message).toMatch(/row-level security|duplicate key/);
      const update = await tx.query(
        "update public.technician_notice_preferences set aog_opt_in = true where profile_id = $1",
        [SEED.delta],
      );
      expect(update.affectedRows).toBe(0);
      // The profile id column is not updatable at all (no column grant).
      expect(
        (
          await sqlError(
            tx,
            "update public.technician_notice_preferences set profile_id = $1 where profile_id = $1",
            [SEED.echo],
          )
        ).message,
      ).toMatch(/permission denied/);
      await asOwner(tx);
      const { rows } = await tx.query<{ aog_opt_in: boolean }>(
        "select aog_opt_in from public.technician_notice_preferences where profile_id = $1",
        [SEED.delta],
      );
      expect(rows[0]!.aog_opt_in).toBe(false);
    });
  });

  it("an organization account has no preferences to save (no technician profile)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const error = await sqlError(
        tx,
        "select * from public.save_notice_preferences(true, true, 24, 'Europe/Madrid', null, null)",
      );
      expect(error.code).toBe("23503");
    });
  });

  it("v1.8 «Zona horaria no válida.»: only zones the database knows, stored with its spelling", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      expect((await savePreferences(tx, SEED.delta, { zone: "europe/lisbon" })).time_zone).toBe(
        "Europe/Lisbon",
      );
      for (const zone of ["Mars/Olympus", "UTC+3", "+01:00", "", "Europe/Madrid; drop"]) {
        await actAs(tx, SEED.delta);
        const error = await sqlError(
          tx,
          "select * from public.save_notice_preferences(true, true, 24, $1, null, null)",
          [zone],
        );
        expect(["22023", "23514"], zone).toContain(error.code);
      }
    });
  });

  it("v1.8 «Horas de silencio no válidas.» and 0–720 hours are enforced by the database too", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      for (const [hours, start, end] of [
        [24, "22:00", null],
        [24, null, "07:00"],
        [24, "22:00", "22:00"],
        [24, "22:00:30", "07:00"],
        [24, "24:00", "07:00"],
        [24, "22:00", "24:00"],
        [721, null, null],
        [-1, null, null],
      ] as const) {
        await actAs(tx, SEED.delta);
        const error = await sqlError(
          tx,
          "select * from public.save_notice_preferences(true, true, $1, 'Europe/Madrid', $2, $3)",
          [hours, start, end],
        );
        expect(error.code, `${hours} ${start}-${end}`).toBe("23514");
      }
      // Both bounds of the range, an overnight span and «not declared» are fine.
      for (const hours of [0, 720, null])
        await savePreferences(tx, SEED.delta, { mobilization: hours });
      await savePreferences(tx, SEED.delta, { quietStart: "23:30", quietEnd: "06:15" });
    });
  });

  it("the row leaves with the account (cascade through the technician profile)", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      await savePreferences(tx, SEED.delta);
      await asOwner(tx);
      await tx.query("delete from public.technician_profiles where profile_id = $1", [SEED.delta]);
      const { rows } = await tx.query(
        "select 1 from public.technician_notice_preferences where profile_id = $1",
        [SEED.delta],
      );
      expect(rows).toHaveLength(0);
    });
  });
});

describe("outreach: who may distribute (migration 20261024400200)", () => {
  it("anon cannot call it; a professional, a plain member, another organization and a random id get 42501", async () => {
    await asUser(db, null, async (tx) => {
      const need = await createNeed(tx);
      await actAs(tx, null);
      expect(
        (await sqlError(tx, "select * from public.requirement_outreach($1)", [need])).message,
      ).toMatch(/permission denied/);
      for (const [actor, id] of [
        [SEED.delta, need],
        [SEED.charlieMember, need],
        [SEED.adminOther, need],
        [SEED.platformAdmin, need],
        [SEED.adminMro, randomUUID()],
      ] as const) {
        await actAs(tx, actor);
        const error = await sqlError(tx, "select * from public.requirement_outreach($1)", [id]);
        expect(error.code, actor).toBe("42501");
      }
      // Nothing was written by the refused calls.
      await asOwner(tx);
      const { rows } = await tx.query(
        "select 1 from public.outreach_distributions where requirement_id = $1",
        [need],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it("a manager distributes once; the second click, planned, paused, draft and started needs are refused", async () => {
    await asUser(db, SEED.managerMro, async (tx) => {
      const need = await createNeed(tx);
      const result = await distribute(tx, SEED.managerMro, need);
      expect(result.urgency).toBe("aog");
      await actAs(tx, SEED.adminMro);
      expect(
        (await sqlError(tx, "select * from public.requirement_outreach($1)", [need])).code,
      ).toBe("CFO03");
      for (const [options, code] of [
        [{ urgency: "planned" }, "CFO02"],
        [{ status: "paused" }, "CFO01"],
        [{ status: "draft" }, "CFO01"],
        [{ startsIn: "-1 hour" }, "CFO04"],
      ] as const) {
        const id = await createNeed(tx, options);
        await actAs(tx, SEED.adminMro);
        const error = await sqlError(tx, "select * from public.requirement_outreach($1)", [id]);
        expect(error.code, JSON.stringify(options)).toBe(code);
      }
    });
  });

  it("the distribution row is read-only and only for the requirement's admins/managers", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const need = await createNeed(tx);
      await distribute(tx, SEED.adminMro, need);
      for (const [actor, visible] of [
        [SEED.adminMro, 1],
        [SEED.managerMro, 1],
        [SEED.charlieMember, 0],
        [SEED.adminOther, 0],
        [SEED.delta, 0],
      ] as const) {
        await actAs(tx, actor);
        const { rows } = await tx.query(
          "select * from public.outreach_distributions where requirement_id = $1",
          [need],
        );
        expect(rows, actor).toHaveLength(visible);
      }
      await actAs(tx, SEED.adminMro);
      for (const sql of [
        "insert into public.outreach_distributions (requirement_id, urgency, notified_count) values ($1, 'aog', 99)",
        "update public.outreach_distributions set notified_count = 99 where requirement_id = $1",
        "delete from public.outreach_distributions where requirement_id = $1",
      ]) {
        expect((await sqlError(tx, sql, [need])).message, sql).toMatch(/permission denied/);
      }
    });
  });
});

describe("outreach: the audience (BR-26), one rule per case, Foxtrot as the positive control", () => {
  it("baseline: a visible, eligible, available professional who opted in is notified", async () => {
    expect(await audienceAfter(noTweak)).toEqual([SEED.delta, FOXTROT].sort());
  });

  it("private: a `private` profile (and `verified_orgs` for an unreviewed organization) gets nothing", async () => {
    for (const visibility of ["private", "verified_orgs"]) {
      const recipients = await audienceAfter(async (tx) => {
        await asOwner(tx);
        await tx.query(
          "update public.technician_profiles set visibility = $2 where profile_id = $1",
          [SEED.delta, visibility],
        );
      });
      expect(recipients, visibility).not.toContain(SEED.delta);
    }
    // Hotel is private in the seed: eligible, available and opted in, still nothing (ORG-06 #4).
    const hotel = await audienceAfter(async (tx) => {
      await qualifying(tx, [SEED.hotelPrivate]);
    });
    expect(hotel).not.toContain(SEED.hotelPrivate);
  });

  it("restriction: a general restriction, or a restricted rating the need asks for, excludes; another rating does not", async () => {
    const general = await audienceAfter(async (tx) => {
      await asOwner(tx);
      await tx.query(
        "update public.technician_profiles set general_restrictions = 'No night shifts (synthetic)' where profile_id = $1",
        [SEED.delta],
      );
    });
    expect(general).not.toContain(SEED.delta);

    const rating = (aircraft: string, category: string) => async (tx: Transaction) => {
      await asOwner(tx);
      await tx.query(
        `insert into public.technician_type_ratings (technician_profile_id, aircraft, category, restrictions)
         values ($1, $2, $3, 'Limited (synthetic)')
         on conflict (technician_profile_id, aircraft, category) do update set restrictions = excluded.restrictions`,
        [SEED.delta, aircraft, category],
      );
    };
    expect(await audienceAfter(rating("A320 Family", "B1.1"))).not.toContain(SEED.delta);
    // B737 NG is not what this need asks for (TR-A320), nor is a B2 endorsement (B1.1 asked).
    expect(await audienceAfter(rating("B737 NG", "B1.1"))).toContain(SEED.delta);
    expect(await audienceAfter(rating("A320 Family", "B2"))).toContain(SEED.delta);

    // Echo's seeded A320 Family B1.1 rating carries a restriction.
    const echo = await audienceAfter(async (tx) => {
      await qualifying(tx, [SEED.echo]);
    });
    expect(echo).not.toContain(SEED.echo);
  });

  it("block: a professional who blocked the organization gets nothing from it", async () => {
    const recipients = await audienceAfter(async (tx) => {
      await asOwner(tx);
      await tx.query(
        "insert into public.technician_organization_blocks (technician_profile_id, organization_id) values ($1, $2)",
        [SEED.delta, mroId],
      );
    });
    expect(recipients).not.toContain(SEED.delta);
  });

  it("no opt-in: urgent and AOG consents are separate; no preferences row = no consent", async () => {
    const consent = (urgent: boolean, aog: boolean) => async (tx: Transaction) => {
      await savePreferences(tx, SEED.delta, { urgent, aog });
    };
    expect(await audienceAfter(consent(true, false))).not.toContain(SEED.delta);
    expect(await audienceAfter(consent(true, false), { urgency: "urgent" })).toContain(SEED.delta);
    expect(await audienceAfter(consent(false, true), { urgency: "urgent" })).not.toContain(
      SEED.delta,
    );
    const noRow = async (tx: Transaction) => {
      await asOwner(tx);
      await tx.query("delete from public.technician_notice_preferences where profile_id = $1", [
        SEED.delta,
      ]);
    };
    expect(await audienceAfter(noRow)).not.toContain(SEED.delta);
  });

  it("quiet hours: in their time zone now → nothing (AOG too); outside them, or another zone's night → notified", async () => {
    // A quiet window from `fromHours` to `toHours` around now, on the wall clock of `around`.
    const quiet =
      (zone: string, around: string, fromHours: number, toHours: number) =>
      async (tx: Transaction) => {
        await asOwner(tx);
        const { rows } = await tx.query<{ s: string; e: string }>(
          `select to_char(now() at time zone $1 + make_interval(hours => $2), 'HH24:MI') as s,
                  to_char(now() at time zone $1 + make_interval(hours => $3), 'HH24:MI') as e`,
          [around, fromHours, toHours],
        );
        await savePreferences(tx, SEED.delta, {
          zone,
          quietStart: rows[0]!.s,
          quietEnd: rows[0]!.e,
        });
      };
    expect(await audienceAfter(quiet("Europe/Madrid", "Europe/Madrid", -1, 1))).not.toContain(
      SEED.delta,
    );
    expect(await audienceAfter(quiet("Asia/Tokyo", "Asia/Tokyo", -1, 1))).not.toContain(SEED.delta);
    // The same wall-clock window read in another zone (Tokyo's night is not Madrid's) does not silence.
    expect(await audienceAfter(quiet("Europe/Madrid", "Asia/Tokyo", -1, 1))).toContain(SEED.delta);
    expect(await audienceAfter(quiet("Europe/Madrid", "Europe/Madrid", 2, 3))).toContain(
      SEED.delta,
    );
  });

  it("no mobilization: undeclared, more hours than the start leaves, or beyond the need's maximum → nothing", async () => {
    const hours = (mobilization: number | null) => async (tx: Transaction) => {
      await savePreferences(tx, SEED.delta, { mobilization });
    };
    expect(await audienceAfter(hours(null))).not.toContain(SEED.delta);
    // A need that starts in 5 days = 120 hours.
    const soon = { startsIn: "5 days" };
    expect(await audienceAfter(hours(130), soon)).not.toContain(SEED.delta);
    expect(await audienceAfter(hours(0), soon)).toContain(SEED.delta);
    // ORG-02 #29: the need's maximum mobilization (requirement-builder conditions; Foxtrot declares 12).
    const capped = { conditions: { maxMobilizationHours: 12 } };
    expect(await audienceAfter(hours(24), capped)).not.toContain(SEED.delta);
    expect(await audienceAfter(hours(12), capped)).toContain(SEED.delta);
  });

  it("ineligible: a pending hard qualification or availability that does not cover the period → nothing", async () => {
    const golf = await audienceAfter(async (tx) => {
      await qualifying(tx, [GOLF]);
    });
    expect(golf).not.toContain(GOLF);

    const unavailable = await audienceAfter(async (tx, id) => {
      await asOwner(tx);
      await tx.query(
        `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
         select $1, wr.starts_at, wr.ends_at, 'unavailable' from public.work_requirements wr where wr.id = $2`,
        [SEED.delta, id],
      );
    });
    expect(unavailable).not.toContain(SEED.delta);
  });

  it("member: the organization's own people are not reached by its outreach (any role)", async () => {
    const recipients = await audienceAfter(async (tx) => {
      await qualifying(tx, [SEED.alpha, SEED.managerMro]);
    });
    expect(recipients).not.toContain(SEED.alpha);
    expect(recipients).not.toContain(SEED.managerMro);
  });

  it("a booking with ANOTHER organization is not a filter (the count would reveal it; CFA05 guards the confirmation)", async () => {
    const recipients = await audienceAfter(async (tx, id) => {
      // Delta is confirmed on a Lisbon need over the same period.
      await asOwner(tx);
      const { rows } = await tx.query<{ starts_at: Date; ends_at: Date }>(
        "select starts_at, ends_at from public.work_requirements where id = $1",
        [id],
      );
      const lisbon = await tx.query<{ id: string }>(
        `insert into public.work_requirements
           (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
         values ($1, 'Lisbon booking', 'Lisboa (LIS)', $2, $3, 'day', 1, 'planned', 'open', $4) returning id`,
        [lisbonId, rows[0]!.starts_at, rows[0]!.ends_at, SEED.adminOther],
      );
      const other = lisbon.rows[0]!.id;
      await tx.query(
        `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
         select $1, id, 'hard' from public.qualification_types where code = 'B1.1'`,
        [other],
      );
      await actAs(tx, SEED.delta);
      const applied = await tx.query<{ id: string }>(
        "select * from public.apply_to_requirement($1, $2, true)",
        [other, randomUUID()],
      );
      const app = applied.rows[0]!.id;
      const move = async (actor: string, to: string) => {
        await asOwner(tx);
        const state = await tx.query<{ updated_at: Date; current_proposal_id: string | null }>(
          "select updated_at, current_proposal_id from public.applications where id = $1",
          [app],
        );
        await actAs(tx, actor);
        await tx.query("select * from public.transition_application($1, $2, $3, $4, null, $5)", [
          app,
          to,
          state.rows[0]!.updated_at.toISOString(),
          randomUUID(),
          to === "accepted" ? state.rows[0]!.current_proposal_id : null,
        ]);
      };
      await move(SEED.adminOther, "shortlisted");
      await move(SEED.adminOther, "proposed");
      await move(SEED.delta, "accepted");
      await move(SEED.adminOther, "confirmed");
      await asOwner(tx);
      const status = await tx.query<{ status: string }>(
        "select status from public.applications where id = $1",
        [app],
      );
      expect(status.rows[0]!.status).toBe("confirmed");
    });
    expect(recipients).toContain(SEED.delta);
  });

  it("already notified or already applied: no second notice", async () => {
    const notified = await audienceAfter(async (tx, id) => {
      await asOwner(tx);
      await tx.query(
        "insert into public.notifications (recipient_id, kind, requirement_id) values ($1, 'outreach', $2)",
        [SEED.delta, id],
      );
    });
    expect(notified).not.toContain(SEED.delta);

    const applied = await audienceAfter(async (tx, id) => {
      await actAs(tx, SEED.delta);
      await tx.query("select * from public.apply_to_requirement($1, $2, true)", [id, randomUUID()]);
    });
    expect(applied).not.toContain(SEED.delta);
  });

  it("flood bound: at most 3 outreach notices from one organization to one professional per 24 h", async () => {
    const recipients = await audienceAfter(async (tx) => {
      // Three earlier distributions of the same organization reached Delta in the last day…
      for (let i = 0; i < 3; i++) {
        const earlier = await createNeed(tx);
        await asOwner(tx);
        await tx.query(
          "insert into public.notifications (recipient_id, kind, requirement_id) values ($1, 'outreach', $2)",
          [SEED.delta, earlier],
        );
      }
    });
    expect(recipients).not.toContain(SEED.delta);
    // …while two of them, or three older than a day, still let the next one through.
    const two = await audienceAfter(async (tx) => {
      for (let i = 0; i < 2; i++) {
        const earlier = await createNeed(tx);
        await asOwner(tx);
        await tx.query(
          "insert into public.notifications (recipient_id, kind, requirement_id) values ($1, 'outreach', $2)",
          [SEED.delta, earlier],
        );
      }
    });
    expect(two).toContain(SEED.delta);
    const old = await audienceAfter(async (tx) => {
      for (let i = 0; i < 3; i++) {
        const earlier = await createNeed(tx);
        await asOwner(tx);
        await tx.query(
          `insert into public.notifications (recipient_id, kind, requirement_id, created_at)
           values ($1, 'outreach', $2, now() - interval '25 hours')`,
          [SEED.delta, earlier],
        );
      }
    });
    expect(old).toContain(SEED.delta);
  });

  it("another organization's outreach is judged on its own terms (Lima is Lisbon's member)", async () => {
    await asUser(db, SEED.adminOther, async (tx) => {
      const need = await createNeed(tx, {
        org: lisbonId,
        createdBy: SEED.adminOther,
        codes: ["B2", "TR-A330"],
      });
      await qualifying(tx, [SEED.lima]);
      await distribute(tx, SEED.adminOther, need);
      expect(await recipientsOf(tx, need)).not.toContain(SEED.lima);
    });
  });
});

describe("outreach: the notice and what the organization learns", () => {
  it("only the recipient reads it, as their own (technician side), with the urgency it was sent for", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const need = await createNeed(tx);
      await qualifying(tx, [SEED.delta]);
      await distribute(tx, SEED.adminMro, need);
      const mine = (await listAs(tx, SEED.delta)).filter((n) => n.kind === "outreach");
      expect(mine).toHaveLength(1);
      expect(mine[0]).toMatchObject({
        audience: "technician",
        application_id: null,
        requirement_id: need,
        organization_name: "Demo MRO Madrid",
        candidate_name: null,
        candidate_ref: null,
        outreach_urgency: "aog",
      });
      expect(await unreadAs(tx, SEED.delta)).toBeGreaterThanOrEqual(1);
      const id = mine[0]!.id;
      for (const other of [SEED.echo, SEED.adminMro, SEED.managerMro, SEED.platformAdmin]) {
        expect(
          (await listAs(tx, other)).some((n) => n.id === id),
          other,
        ).toBe(false);
        await actAs(tx, other);
        const { rows } = await tx.query<{ n: number }>(
          "select public.mark_notifications_read($1) as n",
          [id],
        );
        expect(rows[0]!.n, other).toBe(0);
        expect((await sqlError(tx, "select * from public.notifications")).message).toMatch(
          /permission denied/,
        );
      }
    });
  });

  it("it is listed only while the requirement is published and current", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const need = await createNeed(tx);
      await qualifying(tx, [SEED.delta]);
      await distribute(tx, SEED.adminMro, need);
      const listed = async () =>
        (await listAs(tx, SEED.delta)).some((n) => n.requirement_id === need);
      const before = await unreadAs(tx, SEED.delta);
      expect(await listed()).toBe(true);
      await actAs(tx, SEED.adminMro);
      await tx.query("update public.work_requirements set status = 'paused' where id = $1", [need]);
      expect(await listed()).toBe(false);
      expect(await unreadAs(tx, SEED.delta)).toBe(before - 1);
      await actAs(tx, SEED.adminMro);
      await tx.query("update public.work_requirements set status = 'open' where id = $1", [need]);
      expect(await listed()).toBe(true);
      await actAs(tx, SEED.adminMro);
      await tx.query("update public.work_requirements set status = 'closed' where id = $1", [need]);
      expect(await listed()).toBe(false);
    });
  });

  it("the organization gets a count — never who: not in the answer, the row or the audit trail", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const need = await createNeed(tx);
      // Five eligible in the pool (Echo too, excluded by her restricted rating): the count is reported.
      await qualifying(tx, [SEED.delta, FOXTROT, INDIA, KILO]);
      await makeAvailable(tx, [SEED.echo]);
      const result = await distribute(tx, SEED.adminMro, need);
      expect(Object.keys(result).sort()).toEqual(["distributed_at", "notified", "urgency"]);
      expect(result.notified).toBe(4);
      expect(await recipientsOf(tx, need)).toEqual([SEED.delta, FOXTROT, INDIA, KILO].sort());
      await asOwner(tx);
      const { rows } = await tx.query<{
        actor_profile_id: string;
        organization_id: string;
        metadata: object;
      }>(
        "select actor_profile_id, organization_id, metadata from public.audit_events where action = 'requirement.outreach_distributed' and entity_id = $1",
        [need],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]!.actor_profile_id).toBe(SEED.adminMro);
      expect(rows[0]!.organization_id).toBe(mroId);
      expect(rows[0]!.metadata).toMatchObject({ notified: 4, withheld: false, urgency: "aog" });
      expect(Object.keys(rows[0]!.metadata).sort()).toEqual([
        "notified",
        "request_id",
        "urgency",
        "withheld",
      ]);
      const trail = JSON.stringify(rows);
      for (const person of [SEED.delta, FOXTROT, INDIA, KILO]) expect(trail).not.toContain(person);
      const row = await tx.query(
        "select * from public.outreach_distributions where requirement_id = $1",
        [need],
      );
      expect(Object.keys(row.rows[0] as object).sort()).toEqual([
        "created_at",
        "notified_count",
        "requirement_id",
        "urgency",
      ]);
    });
  });

  it("below 5 eligible professionals the count is withheld everywhere — the notices are still created", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const need = await createNeed(tx);
      await qualifying(tx, [SEED.delta, FOXTROT, INDIA, KILO]);
      const result = await distribute(tx, SEED.adminMro, need);
      expect(result.notified).toBeNull();
      expect(await recipientsOf(tx, need)).toHaveLength(4);
      await actAs(tx, SEED.adminMro);
      const stored = await tx.query<{ notified_count: number | null }>(
        "select notified_count from public.outreach_distributions where requirement_id = $1",
        [need],
      );
      expect(stored.rows[0]!.notified_count).toBeNull();
      const audit = await tx.query<{ metadata: { notified: number | null; withheld: boolean } }>(
        "select metadata from public.audit_events where action = 'requirement.outreach_distributed' and entity_id = $1",
        [need],
      );
      expect(audit.rows[0]!.metadata).toMatchObject({ notified: null, withheld: true });
    });
  });

  it("applicants the organization already sees do not count towards the anonymity of the rest (LOW-A v1)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const need = await createNeed(tx);
      // Five eligible (Echo too, excluded by her restricted rating), as the reported case…
      await qualifying(tx, [SEED.delta, FOXTROT, INDIA, KILO]);
      await makeAvailable(tx, [SEED.echo]);
      // …but four of them applied: the organization knows them, Echo would stand alone.
      for (const who of [SEED.delta, FOXTROT, INDIA, KILO]) {
        await actAs(tx, who);
        await tx.query("select * from public.apply_to_requirement($1, $2, true)", [
          need,
          randomUUID(),
        ]);
      }
      const result = await distribute(tx, SEED.adminMro, need);
      expect(result.notified).toBeNull();
      expect(await recipientsOf(tx, need)).toEqual([]);
    });
  });

  it("the flood bound trims the delivery, never the reported count (LOW-A v2)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      // Four known base members already got 3 notices from this organization today.
      for (let i = 0; i < 3; i++) {
        const earlier = await createNeed(tx);
        await asOwner(tx);
        await tx.query(
          `insert into public.notifications (recipient_id, kind, requirement_id)
           select p, 'outreach', $1 from unnest($2::uuid[]) p`,
          [earlier, [SEED.delta, FOXTROT, INDIA, KILO]],
        );
      }
      const need = await createNeed(tx);
      await qualifying(tx, [SEED.delta, FOXTROT, INDIA, KILO]);
      await makeAvailable(tx, [SEED.echo]);
      const result = await distribute(tx, SEED.adminMro, need);
      // The count reads 4 (who the rules reach), although nobody is sent a 4th notice today.
      expect(result.notified).toBe(4);
      expect(await recipientsOf(tx, need)).toEqual([]);
    });
  });

  it("an organization distributes at most 10 needs in 24 h (CFO05), closed ones included", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      for (let i = 0; i < 10; i++) {
        const need = await createNeed(tx);
        await distribute(tx, SEED.adminMro, need);
        if (i === 0) {
          await actAs(tx, SEED.adminMro);
          await tx.query("update public.work_requirements set status = 'closed' where id = $1", [
            need,
          ]);
        }
      }
      const eleventh = await createNeed(tx);
      await actAs(tx, SEED.managerMro);
      expect(
        (await sqlError(tx, "select * from public.requirement_outreach($1)", [eleventh])).code,
      ).toBe("CFO05");
      // Another organization is not affected.
      const lisbon = await createNeed(tx, { org: lisbonId, createdBy: SEED.adminOther });
      expect((await distribute(tx, SEED.adminOther, lisbon)).urgency).toBe("aog");
      // A day later the slot is free again.
      await asOwner(tx);
      await tx.query(
        `update public.outreach_distributions d set created_at = d.created_at - interval '25 hours'
         from public.work_requirements wr where wr.id = d.requirement_id and wr.organization_id = $1`,
        [mroId],
      );
      expect((await distribute(tx, SEED.adminMro, eleventh)).urgency).toBe("aog");
    });
  });

  it("an application notice of a closed account is neither listed nor counted (bell = list)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const need = await createNeed(tx, { urgency: "planned" });
      await makeAvailable(tx, [SEED.delta]);
      await actAs(tx, SEED.delta);
      await tx.query("select * from public.apply_to_requirement($1, $2, true)", [
        need,
        randomUUID(),
      ]);
      const listedFor = async () =>
        (await listAs(tx, SEED.adminMro)).filter((n) => n.requirement_id === need).length;
      expect(await listedFor()).toBe(1);
      const unread = await unreadAs(tx, SEED.adminMro);
      // Account closure withdraws the application and leaves it without its technician (20261023400100).
      await asOwner(tx);
      await tx.query("delete from public.profiles where id = $1", [SEED.delta]);
      expect(await listedFor()).toBe(0);
      expect(await unreadAs(tx, SEED.adminMro)).toBe(unread - 1);
    });
  });
});

describe("outreach: private helpers", () => {
  it("quiet hours follow v1.8 `quietNow`: [start, end), overnight spans, none declared = never quiet", async () => {
    await asUser(db, null, async (tx) => {
      await asOwner(tx);
      for (const [start, end, local, quiet] of [
        ["22:00", "07:00", "23:00", true],
        ["22:00", "07:00", "06:59", true],
        ["22:00", "07:00", "07:00", false],
        ["22:00", "07:00", "21:59", false],
        ["09:00", "17:00", "09:00", true],
        ["09:00", "17:00", "17:00", false],
        ["09:00", "17:00", "08:59", false],
        [null, null, "03:00", false],
      ] as const) {
        const { rows } = await tx.query<{ q: boolean }>(
          "select app_private.in_quiet_hours($1::time, $2::time, $3::time) as q",
          [start, end, local],
        );
        expect(rows[0]!.q, `${start}-${end} at ${local}`).toBe(quiet);
      }
    });
  });

  it("the TR-* → aircraft map names passport aircraft and catalog codes only", async () => {
    await asUser(db, null, async (tx) => {
      await asOwner(tx);
      const need = await createNeed(tx, { codes: ["B1.1", "B2", "TR-A320", "TR-B737", "EWIS"] });
      const { rows } = await tx.query<{ aircraft: string[]; licences: string[] }>(
        "select * from app_private.outreach_required_ratings($1)",
        [need],
      );
      expect([...rows[0]!.aircraft].sort()).toEqual(["A320 Family", "B737 MAX", "B737 NG"]);
      expect([...rows[0]!.licences].sort()).toEqual(["B1.1", "B2"]);
      const all = await createNeed(tx, {
        codes: ["TR-A320", "TR-A330", "TR-A350", "TR-B737", "TR-B787", "TR-ATR72"],
      });
      const mapped = await tx.query<{ aircraft: string[] }>(
        "select aircraft from app_private.outreach_required_ratings($1)",
        [all],
      );
      for (const aircraft of mapped.rows[0]!.aircraft) {
        expect(AIRCRAFT as readonly string[], aircraft).toContain(aircraft);
      }
      expect(mapped.rows[0]!.aircraft).toHaveLength(7);
    });
  });

  it("no API role may run the helpers", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      for (const sql of [
        "select app_private.in_quiet_hours('22:00', '07:00', '23:00')",
        `select * from app_private.outreach_required_ratings('${randomUUID()}')`,
      ]) {
        expect((await sqlError(tx, sql)).message, sql).toMatch(/permission denied/);
      }
    });
  });
});
