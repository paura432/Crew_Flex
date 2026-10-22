// Requirement builder (v2 diff area 30: v2-09 shifts, v2-10 country, v2-12 conditions, v2-13 live count, v2-14
// drafts / archive), migrations 20261023600000 / 20261023600100. Every case runs inside a rolled-back
// transaction (harness `asUser`), switching the acting user with `actAs`.
import { randomUUID } from "node:crypto";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, orgIdByName, SEED } from "./harness";
import {
  EU_COUNTRIES,
  REQUIREMENT_TIME_ZONES,
  shiftEnvelope,
  shiftIssues,
  type RequirementShift,
} from "../../src/domain/work-requirement";
import {
  requirementConditionsInput,
  requirementConditionsRow,
} from "../../src/lib/validation/work-requirement";

let db: PGlite;
let mroId: string;
let otherOrgId: string;
let b11: string;
let a320: string;
let sms: string;

beforeAll(async () => {
  db = await createTestDatabase();
  mroId = await orgIdByName(db, "Demo MRO Madrid");
  otherOrgId = await orgIdByName(db, "Demo Aero Services Lisbon");
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
    const e = error as { code?: string; message: string };
    return { code: e.code, message: e.message };
  }
  throw new Error(`expected statement to fail: ${sql}`);
}

const DAY = 86_400_000;
/** An instant `days` from today (UTC midnight) at `hour`:00Z, ISO with milliseconds (the canonical form). */
const at = (days: number, hour: number) =>
  new Date(Math.floor(Date.now() / DAY) * DAY + days * DAY + hour * 3_600_000).toISOString();
/** `day` January 2027 at `hour`:00Z (winter time in every EU zone). */
const winter = (day: number, hour: number) =>
  new Date(Date.UTC(2027, 0, day) + hour * 3_600_000).toISOString();

/** The acceptance example of v2-09: three days 08–16 UTC, 8 base hours each, starting 20 days from now. */
const threeDays = (): RequirementShift[] =>
  [20, 21, 22].map((d) => ({ startsAt: at(d, 8), endsAt: at(d, 16), baseHours: 8 }));

/** v1.8 demo defaults (Company2.jsx:114-125): 50 €/h, 60 €/h extra, 30 €/day, Contractor, ✔✔✔☐☐, 48 h. */
const V18_CONDITIONS = {
  hourlyRate: 50,
  overtimeRate: 60,
  perDiem: 30,
  shiftHours: 8,
  contractType: "contractor",
  budgetMandatory: false,
  maxMobilizationHours: 48,
  arrival: "Antes del inicio del turno",
  flights: true,
  accommodation: true,
  localTransport: true,
  meals: false,
  ownTools: false,
};

const CREATE =
  "select * from public.create_work_requirement_idempotent($1, $2, $3, 'Madrid (MAD)', $4, $5, 'day', 1, $6, $7::jsonb, $8, $9, $10, $11, $12::jsonb, $13::jsonb)";

interface CreateOpts {
  org?: string;
  key?: string;
  title?: string;
  startsAt?: string;
  endsAt?: string;
  urgency?: string;
  qualifications?: { qualification_type_id: string; requirement_level: string }[];
  status?: string;
  country?: string | null;
  timeZone?: string | null;
  description?: string | null;
  shifts?: RequirementShift[] | null;
  conditions?: Record<string, unknown> | null;
}

function createArgs(o: CreateOpts = {}) {
  const shifts = o.shifts === undefined ? threeDays() : o.shifts;
  const envelope = shifts?.length ? shiftEnvelope(shifts) : null;
  return [
    o.key ?? randomUUID(),
    o.org ?? mroId,
    o.title ?? "Builder fixture",
    o.startsAt ?? envelope?.startsAt ?? at(20, 8),
    o.endsAt ?? envelope?.endsAt ?? at(22, 16),
    o.urgency ?? "planned",
    JSON.stringify(
      o.qualifications ?? [
        { qualification_type_id: b11, requirement_level: "hard" },
        { qualification_type_id: sms, requirement_level: "soft" },
      ],
    ),
    o.status ?? "open",
    o.country === undefined ? "ES" : o.country,
    o.timeZone === undefined ? "Europe/Madrid" : o.timeZone,
    o.description === undefined ? null : o.description,
    shifts === null ? null : JSON.stringify(shifts),
    o.conditions === undefined
      ? JSON.stringify(V18_CONDITIONS)
      : o.conditions === null
        ? null
        : JSON.stringify(o.conditions),
  ];
}

async function create(tx: Transaction, actor: string, o: CreateOpts = {}) {
  await actAs(tx, actor);
  return (await tx.query<{ id: string; replayed: boolean }>(CREATE, createArgs(o))).rows[0]!;
}

/** Owner-side insert that runs only the constraints (no RPC). */
async function insertRaw(tx: Transaction, columns: Record<string, unknown>) {
  await tx.exec("reset role");
  const base = {
    organization_id: mroId,
    title: "Raw fixture",
    location: "Madrid (MAD)",
    starts_at: at(20, 8),
    ends_at: at(22, 16),
    headcount: 1,
    status: "draft",
    created_by: SEED.adminMro,
    ...columns,
  };
  const keys = Object.keys(base);
  return tx.query<{ id: string }>(
    `insert into public.work_requirements (${keys.join(", ")})
     values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
    Object.values(base).map((v) => (v !== null && typeof v === "object" ? JSON.stringify(v) : v)),
  );
}

const rawError = async (tx: Transaction, columns: Record<string, unknown>) => {
  await tx.exec("savepoint raw");
  try {
    await insertRaw(tx, columns);
  } catch (error) {
    await tx.exec("rollback to savepoint raw");
    return (error as { code?: string }).code;
  }
  await tx.exec("rollback to savepoint raw");
  return "ok";
};

const UPDATE =
  "select * from public.update_work_requirement($1, $2, $3, 'Madrid (MAD)', $4, $5, 'day', 1, 'planned', $6::jsonb, $7, 'ES', 'Europe/Madrid', $8, $9::jsonb, $10::jsonb)";

async function updateArgs(
  tx: Transaction,
  id: string,
  o: {
    title?: string;
    qualifications?: unknown[];
    status?: string | null;
    description?: string | null;
    shifts?: RequirementShift[] | null;
    conditions?: Record<string, unknown> | null;
  } = {},
) {
  await tx.exec("reset role");
  const row = (
    await tx.query<{ updated_at: Date; starts_at: Date; ends_at: Date; shifts: unknown }>(
      "select updated_at, starts_at, ends_at, shifts from public.work_requirements where id = $1",
      [id],
    )
  ).rows[0]!;
  const shifts = o.shifts === undefined ? (row.shifts as RequirementShift[] | null) : o.shifts;
  const envelope = shifts?.length ? shiftEnvelope(shifts) : null;
  return [
    id,
    row.updated_at.toISOString(),
    o.title ?? "Builder fixture",
    envelope?.startsAt ?? row.starts_at.toISOString(),
    envelope?.endsAt ?? row.ends_at.toISOString(),
    JSON.stringify(o.qualifications ?? [{ qualification_type_id: b11, requirement_level: "hard" }]),
    o.status === undefined ? null : o.status,
    o.description ?? null,
    shifts ? JSON.stringify(shifts) : null,
    o.conditions === undefined ? JSON.stringify(V18_CONDITIONS) : JSON.stringify(o.conditions),
  ];
}

async function row(tx: Transaction, id: string) {
  await tx.exec("reset role");
  return (
    await tx.query<{
      status: string;
      country: string | null;
      timezone: string | null;
      description: string | null;
      shifts: RequirementShift[] | null;
      conditions: Record<string, unknown> | null;
      archived_at: Date | null;
    }>(
      "select status, country, timezone, description, shifts, conditions, archived_at from public.work_requirements where id = $1",
      [id],
    )
  ).rows[0]!;
}

/** Owner-side: the seed professionals delta and echo (B1.1 + TR-A320 verified) are available around now. */
async function makeAvailable(tx: Transaction, profiles: string[]) {
  await tx.exec("reset role");
  await tx.query(
    `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
     select p, now() - interval '30 days', now() + interval '120 days', 'available' from unnest($1::uuid[]) p`,
    [profiles],
  );
}

describe("requirement terms: columns and CHECK constraints (20261023600000)", () => {
  it("country is one of the 27 EU members, exactly EU_COUNTRIES (v1.8 rules.mjs:1)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      for (const country of EU_COUNTRIES) expect(await rawError(tx, { country })).toBe("ok");
      for (const country of ["GB", "US", "CH", "es", "ESP", ""])
        expect(await rawError(tx, { country }), country).toBe("23514");
      expect(await rawError(tx, { country: null })).toBe("ok"); // not stated (every older row)
    });
  });

  it("the zone is one of REQUIREMENT_TIME_ZONES, and PostgreSQL knows every one of them", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      for (const timezone of REQUIREMENT_TIME_ZONES)
        expect(await rawError(tx, { timezone }), timezone).toBe("ok");
      for (const timezone of ["America/New_York", "Europe/London", "Mars/Olympus", "CET"])
        expect(await rawError(tx, { timezone }), timezone).toBe("23514");
      const known = await tx.query<{ n: number }>(
        "select count(*)::int as n from pg_timezone_names where name = any($1::text[])",
        [[...REQUIREMENT_TIME_ZONES]],
      );
      expect(known.rows[0]!.n).toBe(REQUIREMENT_TIME_ZONES.length);
    });
  });

  it("shifts: SQL and shiftIssues() agree on valid and invalid lists (v1.8 validateJob)", async () => {
    const madrid = "Europe/Madrid";
    // Fixed January dates: Madrid is UTC+1 then, whatever the day the suite runs.
    const day = (d: number, from: number, to: number, hours = to - from): RequirementShift => ({
      startsAt: winter(d, from),
      endsAt: winter(d, to),
      baseHours: hours,
    });
    const cases: [string, RequirementShift[], string | null, boolean][] = [
      ["three days 08–16", [day(11, 8, 16), day(12, 8, 16), day(13, 8, 16)], madrid, true],
      ["one shift", [day(11, 8, 16)], madrid, true],
      // 23:00Z is 00:00 of the next local day in Madrid (UTC+1): two dates, touching, valid.
      ["touching shifts on two local dates", [day(11, 15, 23), day(11, 23, 24.5, 1)], madrid, true],
      ["the same pair is one UTC date", [day(11, 15, 23), day(11, 23, 24.5, 1)], "UTC", false],
      ["overlap", [day(11, 8, 16), day(11, 15, 23)], madrid, false],
      ["two shifts on one local date", [day(11, 6, 10), day(11, 12, 16)], madrid, false],
      ["longer than 24 h", [day(11, 8, 33, 8)], madrid, false],
      ["base hours above the duration", [day(11, 8, 12, 5)], madrid, false],
      ["base hours below 0.25", [day(11, 8, 12, 0.2)], madrid, false],
      ["ends before it starts", [day(11, 12, 8, 1)], madrid, false],
    ];
    await asUser(db, SEED.adminMro, async (tx) => {
      for (const [name, shifts, zone, valid] of cases) {
        expect(shiftIssues(shifts, zone).length === 0, `TS ${name}`).toBe(valid);
        const envelope = shiftEnvelope(shifts)!;
        const sql = await tx.query<{ ok: boolean }>(
          "select app_private.requirement_shifts_valid(app_private.normalize_requirement_shifts($1::jsonb), $2, $3, $4) as ok",
          [JSON.stringify(shifts), zone, envelope.startsAt, envelope.endsAt],
        );
        expect(sql.rows[0]!.ok, `SQL ${name}`).toBe(valid);
      }
    });
  });

  it("the local date follows the zone: 23:30Z is the next day in Madrid, the same day in UTC", async () => {
    const shifts = [
      { startsAt: winter(11, 8), endsAt: winter(11, 10), baseHours: 2 },
      { startsAt: winter(11, 23.5), endsAt: winter(12, 1), baseHours: 1.5 },
    ];
    expect(shiftIssues(shifts, "Europe/Madrid")).toEqual([]);
    expect(shiftIssues(shifts, "UTC")).toEqual([{ index: 1, issue: "sameLocalDay" }]);
    await asUser(db, SEED.adminMro, async (tx) => {
      const envelope = shiftEnvelope(shifts)!;
      const base = {
        shifts: shifts.map((s) => ({ ...s, startsAt: s.startsAt, endsAt: s.endsAt })),
        starts_at: envelope.startsAt,
        ends_at: envelope.endsAt,
      };
      expect(await rawError(tx, { ...base, timezone: "Europe/Madrid" })).toBe("ok");
      expect(await rawError(tx, { ...base, timezone: "UTC" })).toBe("23514");
    });
  });

  it("the period must be the envelope of the shifts, and a list holds at most 366", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const shifts = threeDays();
      expect(
        await rawError(tx, { shifts, starts_at: at(20, 8), ends_at: at(22, 16), timezone: "UTC" }),
      ).toBe("ok");
      expect(
        await rawError(tx, { shifts, starts_at: at(19, 8), ends_at: at(22, 16), timezone: "UTC" }),
      ).toBe("23514");
      expect(
        await rawError(tx, { shifts, starts_at: at(20, 8), ends_at: at(23, 0), timezone: "UTC" }),
      ).toBe("23514");
      expect(await rawError(tx, { shifts: [], timezone: "UTC" })).toBe("23514"); // empty list = use NULL
      const many = Array.from({ length: 367 }, (_, i) => ({
        startsAt: at(i, 8),
        endsAt: at(i, 9),
        baseHours: 1,
      }));
      expect(shiftIssues(many, "UTC")).toContainEqual({ index: -1, issue: "tooMany" });
      expect(
        await rawError(tx, {
          shifts: many,
          starts_at: many[0]!.startsAt,
          ends_at: many.at(-1)!.endsAt,
          timezone: "UTC",
        }),
      ).toBe("23514");
    });
  });

  it("conditions: known keys only, the v1.8 ranges, no commission — SQL and the shared schema agree", async () => {
    const cases: [Record<string, unknown>, boolean][] = [
      [V18_CONDITIONS, true],
      [{ hourlyRate: 0.01 }, true],
      [{ hourlyRate: 2000, overtimeRate: 0, perDiem: 0 }, true],
      [{ hourlyRate: 0 }, false],
      [{ hourlyRate: 2000.01 }, false],
      [{ hourlyRate: 50.555 }, false],
      [{ perDiem: -1 }, false],
      [{ shiftHours: 0.2 }, false],
      [{ shiftHours: 24.5 }, false],
      [{ maxMobilizationHours: 0 }, false],
      [{ maxMobilizationHours: 12.5 }, false],
      [{ maxMobilizationHours: 169 }, false],
      [{ contractType: "freelance" }, false],
      [{ flights: "yes" }, false],
      [{ arrival: "x".repeat(161) }, false],
      [{ commissionRate: 0.023 }, false], // SCOPE OUT
      [{ hourlyRate: "50" }, false],
    ];
    await asUser(db, SEED.adminMro, async (tx) => {
      for (const [conditions, valid] of cases) {
        const label = JSON.stringify(conditions);
        expect(requirementConditionsInput.safeParse(conditions).success, `TS ${label}`).toBe(valid);
        expect(await rawError(tx, { conditions }), `SQL ${label}`).toBe(valid ? "ok" : "23514");
      }
    });
  });

  it("conditions text: the CHECK refuses what JavaScript's trim() changes, and the read schema parses whatever it stores", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      for (const arrival of ["\t", " ", " x", "x\n", "　x", "x﻿", " "]) {
        expect(await rawError(tx, { conditions: { arrival } }), JSON.stringify(arrival)).toBe(
          "23514",
        );
      }
      for (const arrival of ["x y", "Antes del inicio del turno", "a\tb"]) {
        expect(await rawError(tx, { conditions: { arrival } }), arrival).toBe("ok");
        expect(requirementConditionsRow.safeParse({ arrival }).success, arrival).toBe(true);
      }
      // The input schema trims, so what the API sends is always storable.
      const sent = requirementConditionsInput.parse({ arrival: "  x " });
      expect(await rawError(tx, { conditions: sent })).toBe("ok");
    });
  });

  it("description is 1–4000 characters; archived_at only on a closed requirement", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      expect(await rawError(tx, { description: "x".repeat(4000) })).toBe("ok");
      expect(await rawError(tx, { description: "x".repeat(4001) })).toBe("23514");
      expect(await rawError(tx, { description: "" })).toBe("23514");
      expect(await rawError(tx, { archived_at: new Date().toISOString() })).toBe("23514");
    });
  });

  it("API roles cannot UPDATE the new columns directly (RPC only) nor set archived_at at all", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const { id } = await create(tx, SEED.adminMro);
      await actAs(tx, SEED.adminMro);
      for (const set of [
        "conditions = '{}'",
        "shifts = null",
        "country = 'PT'",
        "timezone = 'UTC'",
        "description = 'x'",
        "archived_at = now()",
      ]) {
        const error = await sqlError(
          tx,
          `update public.work_requirements set ${set} where id = $1`,
          [id],
        );
        expect(error.code, set).toBe("42501");
      }
    });
  });
});

describe("create with terms, drafts and the idempotency key (20261023600100)", () => {
  it("stores the v1.8 defaults and the three shifts, normalised and sorted", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const shifts = threeDays().reverse(); // any order in, sorted out
      const { id, replayed } = await create(tx, SEED.managerMro, {
        shifts,
        description: "  Line support, night stop.  ",
      });
      expect(replayed).toBe(false);
      const r = await row(tx, id);
      expect(r).toMatchObject({
        status: "open",
        country: "ES",
        timezone: "Europe/Madrid",
        description: "Line support, night stop.",
        conditions: V18_CONDITIONS,
        archived_at: null,
      });
      expect(r.shifts).toEqual(threeDays());
      expect(r.shifts!.reduce((n, s) => n + s.baseHours, 0)).toBe(24); // «24 horas base en 3 jornadas»
    });
  });

  it("an open requirement needs a hard qualification; a draft may have none (R-D4, T-63)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      await actAs(tx, SEED.adminMro);
      const none = await sqlError(tx, CREATE, createArgs({ qualifications: [] }));
      expect(none.code).toBe("22023");
      const softOnly = await sqlError(
        tx,
        CREATE,
        createArgs({ qualifications: [{ qualification_type_id: sms, requirement_level: "soft" }] }),
      );
      expect(softOnly.code).toBe("22023");
      const draft = await create(tx, SEED.adminMro, {
        status: "draft",
        qualifications: [],
        shifts: null,
        conditions: null,
        country: null,
        timeZone: null,
      });
      expect((await row(tx, draft.id)).status).toBe("draft");
      await actAs(tx, SEED.adminMro);
      expect(
        (await sqlError(tx, CREATE, createArgs({ status: "paused" }))).code, // only draft or open
      ).toBe("22023");
    });
  });

  it("a draft is never published nor listed as an opportunity", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const draft = await create(tx, SEED.adminMro, { status: "draft" });
      await actAs(tx, SEED.delta);
      const listed = await tx.query("select id from public.list_opportunities($1)", [draft.id]);
      expect(listed.rows).toEqual([]);
    });
  });

  it("a plain member and another organization cannot create (RLS), whatever the status", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      await actAs(tx, SEED.charlieMember);
      expect((await sqlError(tx, CREATE, createArgs({ status: "draft" }))).code).toBe("42501");
      await actAs(tx, SEED.adminOther);
      expect((await sqlError(tx, CREATE, createArgs({ org: mroId }))).code).toBe("42501");
    });
  });

  it("the same key replays; the same key with other terms is CF409", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const key = randomUUID();
      const first = await create(tx, SEED.adminMro, { key });
      const again = await create(tx, SEED.adminMro, { key, shifts: threeDays().reverse() });
      expect(again).toEqual({ id: first.id, replayed: true }); // order of the shifts is not identity
      await actAs(tx, SEED.adminMro);
      const other = await sqlError(
        tx,
        CREATE,
        createArgs({ key, conditions: { ...V18_CONDITIONS, hourlyRate: 51 } }),
      );
      expect(other.code).toBe("CF409");
    });
  });

  it("invalid shifts are refused at the database too (22023 unreadable, 23514 against the rules)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      await actAs(tx, SEED.adminMro);
      const unreadable = createArgs({});
      unreadable[11] = JSON.stringify([
        { startsAt: "not-a-date", endsAt: at(20, 9), baseHours: 1 },
      ]);
      expect((await sqlError(tx, CREATE, unreadable)).code).toBe("22023");
      const overlapping = [
        { startsAt: at(20, 8), endsAt: at(20, 16), baseHours: 8 },
        { startsAt: at(20, 15), endsAt: at(20, 23), baseHours: 8 },
      ];
      expect((await sqlError(tx, CREATE, createArgs({ shifts: overlapping }))).code).toBe("23514");
    });
  });
});

describe("edit with terms; save and publish a draft", () => {
  it("saves a draft as a draft, then publishes it with the full rules (draft → open, audited)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const { id } = await create(tx, SEED.adminMro, { status: "draft", qualifications: [] });
      let args = await updateArgs(tx, id, { status: "draft", qualifications: [] });
      await actAs(tx, SEED.managerMro);
      const saved = (await tx.query<{ changed: string[] }>(UPDATE, args)).rows[0]!;
      expect(saved.changed).toEqual([]); // nothing changed: a no-op
      args = await updateArgs(tx, id, {
        status: "draft",
        qualifications: [],
        description: "Draft notes",
      });
      await actAs(tx, SEED.managerMro);
      expect((await tx.query<{ changed: string[] }>(UPDATE, args)).rows[0]!.changed).toEqual([
        "description",
      ]);
      expect((await row(tx, id)).status).toBe("draft");

      // Publishing an incomplete draft is refused (BR-1.4 applies again)…
      args = await updateArgs(tx, id, { status: "open", qualifications: [] });
      await actAs(tx, SEED.managerMro);
      expect((await sqlError(tx, UPDATE, args)).code).toBe("22023");
      // …and a complete one is published in the same transaction.
      args = await updateArgs(tx, id, { status: "open" });
      await actAs(tx, SEED.managerMro);
      const published = (await tx.query<{ changed: string[] }>(UPDATE, args)).rows[0]!;
      expect(published.changed).toContain("qualifications");
      expect((await row(tx, id)).status).toBe("open");
      await tx.exec("reset role");
      const audit = await tx.query<{ action: string; metadata: Record<string, unknown> }>(
        "select action, metadata from public.audit_events where entity_id = $1 order by created_at, action",
        [id],
      );
      expect(audit.rows.map((r) => r.action)).toEqual(
        expect.arrayContaining(["requirement.created", "requirement.status_changed"]),
      );
      expect(
        audit.rows.find((r) => r.action === "requirement.status_changed")?.metadata,
      ).toMatchObject({ from: "draft", to: "open" });
      for (const r of audit.rows.filter((r) => r.action === "requirement.updated"))
        expect(JSON.stringify(r.metadata)).not.toContain("Draft notes"); // names only (S-9)
    });
  });

  it("only a draft is saved as a draft; publishing a paused one is not an edit", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const { id } = await create(tx, SEED.adminMro);
      let args = await updateArgs(tx, id, { status: "draft" });
      await actAs(tx, SEED.adminMro);
      expect((await sqlError(tx, UPDATE, args)).code).toBe("55000");
      await tx.exec("reset role");
      await tx.query("update public.work_requirements set status = 'paused' where id = $1", [id]);
      args = await updateArgs(tx, id, { status: "open" });
      await actAs(tx, SEED.adminMro);
      expect((await sqlError(tx, UPDATE, args)).code).toBe("55000");
    });
  });

  it("reports the new fields by name and keeps the old rules (stale version CF412)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const { id } = await create(tx, SEED.adminMro);
      const shifts = threeDays().slice(0, 2);
      const args = await updateArgs(tx, id, {
        shifts,
        conditions: { ...V18_CONDITIONS, hourlyRate: 55 },
        description: "New notes",
      });
      await actAs(tx, SEED.adminMro);
      const result = (await tx.query<{ changed: string[] }>(UPDATE, args)).rows[0]!;
      expect(result.changed.sort()).toEqual(
        ["conditions", "description", "endsAt", "qualifications", "shifts"].sort(),
      );
      expect((await row(tx, id)).shifts).toEqual(shifts);
      // A change made from an older version is refused (CF412; `now()` is fixed inside this transaction).
      await actAs(tx, SEED.adminMro);
      args[1] = "2000-01-01T00:00:00.000Z";
      args[8] = JSON.stringify(threeDays());
      args[4] = threeDays().at(-1)!.endsAt;
      expect((await sqlError(tx, UPDATE, args)).code).toBe("CF412");
    });
  });

  it("after the first application every term is frozen (CFA12), direct writes included", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const { id } = await create(tx, SEED.adminMro, {
        shifts: null,
        startsAt: at(20, 8),
        endsAt: at(22, 16),
        qualifications: [
          { qualification_type_id: b11, requirement_level: "hard" },
          { qualification_type_id: a320, requirement_level: "hard" },
        ],
      });
      await makeAvailable(tx, [SEED.delta]);
      await actAs(tx, SEED.delta);
      await tx.query("select * from public.apply_to_requirement($1, $2, true)", [id, randomUUID()]);
      const args = await updateArgs(tx, id, {
        shifts: null,
        qualifications: [
          { qualification_type_id: b11, requirement_level: "hard" },
          { qualification_type_id: a320, requirement_level: "hard" },
        ],
        conditions: { ...V18_CONDITIONS, hourlyRate: 99 },
      });
      await actAs(tx, SEED.adminMro);
      expect((await sqlError(tx, UPDATE, args)).code).toBe("CFA12");
      await tx.exec("reset role"); // even the table owner
      const direct = await sqlError(
        tx,
        "update public.work_requirements set conditions = '{\"hourlyRate\": 99}' where id = $1",
        [id],
      );
      expect(direct.code).toBe("CFA12");
    });
  });

  it("a closed requirement keeps its terms, the table owner included (55000)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const { id } = await create(tx, SEED.adminMro);
      await tx.exec("reset role");
      await tx.query("update public.work_requirements set status = 'closed' where id = $1", [id]);
      for (const set of [
        "conditions = null",
        "description = 'x'",
        "country = 'PT'",
        "shifts = null",
      ]) {
        const error = await sqlError(
          tx,
          `update public.work_requirements set ${set} where id = $1`,
          [id],
        );
        expect(error.code, set).toBe("55000"); // the BEFORE trigger answers before any CHECK
      }
    });
  });
});

describe("the new edit overload refuses everyone but the organization's admins/managers (security review MEDIUM-2)", () => {
  it("a member, another organization, a professional, a platform admin, anon and a random id get 42501; the row is unchanged", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const { id } = await create(tx, SEED.adminMro);
      const before = await row(tx, id);
      const args = await updateArgs(tx, id, {
        title: "Hijacked terms",
        conditions: { ...V18_CONDITIONS, hourlyRate: 1 },
      });
      for (const user of [
        SEED.charlieMember,
        SEED.adminOther,
        SEED.delta,
        SEED.platformAdmin,
        null,
      ]) {
        await actAs(tx, user);
        const error = await sqlError(tx, UPDATE, args);
        // anon has no EXECUTE at all (42501 too).
        expect(error.code, String(user)).toBe("42501");
      }
      await actAs(tx, SEED.adminMro);
      const missing = [...args];
      missing[0] = randomUUID();
      expect((await sqlError(tx, UPDATE, missing)).code).toBe("42501");
      expect(await row(tx, id)).toEqual(before);
    });
  });

  it("a closed requirement is refused through the RPC too (55000)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const { id } = await create(tx, SEED.adminMro);
      await tx.exec("reset role");
      await tx.query("update public.work_requirements set status = 'closed' where id = $1", [id]);
      const args = await updateArgs(tx, id, { description: "After closing" });
      await actAs(tx, SEED.managerMro);
      expect((await sqlError(tx, UPDATE, args)).code).toBe("55000");
    });
  });

  it("every SECURITY DEFINER function of public and app_private pins search_path = '' and is not executable by anon", async () => {
    const { rows } = await db.query<{ name: string; config: string[] | null; anon: boolean }>(
      `select n.nspname || '.' || p.proname as name, p.proconfig as config,
              has_function_privilege('anon', p.oid, 'execute') as anon
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where p.prosecdef and n.nspname in ('public', 'app_private')`,
    );
    expect(rows.length).toBeGreaterThan(20);
    // The only anon-callable DEFINER functions: the sign-up page's invitation checks (account
    // package, T-40; documented S-10 exception in memory-bank/04-security-invariants.md).
    const ANON_BY_DESIGN = ["public.invitation_status", "public.invitation_signup_required"];
    for (const fn of rows) {
      expect(fn.config ?? [], fn.name).toContain('search_path=""');
      expect(fn.anon, fn.name).toBe(ANON_BY_DESIGN.includes(fn.name));
    }
  });
});

describe("archive (v1.8 «Archivar», one way; T-64)", () => {
  const ARCHIVE = "select * from public.archive_work_requirement($1)";

  it("archives a closed requirement and closes + archives a draft; open ones must be closed first", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const open = await create(tx, SEED.adminMro);
      await actAs(tx, SEED.adminMro);
      expect((await sqlError(tx, ARCHIVE, [open.id])).code).toBe("55000");

      await tx.exec("reset role");
      await tx.query("update public.work_requirements set status = 'closed' where id = $1", [
        open.id,
      ]);
      await actAs(tx, SEED.managerMro);
      const archived = (await tx.query<{ status: string; archived_at: Date }>(ARCHIVE, [open.id]))
        .rows[0]!;
      expect(archived.status).toBe("closed");
      expect(archived.archived_at).toBeInstanceOf(Date);
      // Twice is a no-op with the same instant.
      await actAs(tx, SEED.managerMro);
      const again = (await tx.query<{ archived_at: Date }>(ARCHIVE, [open.id])).rows[0]!;
      expect(again.archived_at.getTime()).toBe(archived.archived_at.getTime());

      const draft = await create(tx, SEED.adminMro, { status: "draft", qualifications: [] });
      await actAs(tx, SEED.adminMro);
      const closedDraft = (await tx.query<{ status: string }>(ARCHIVE, [draft.id])).rows[0]!;
      expect(closedDraft.status).toBe("closed");

      await tx.exec("reset role");
      const audit = await tx.query<{ action: string; metadata: Record<string, unknown> }>(
        "select action, metadata from public.audit_events where entity_id = $1 and action like 'requirement.%' order by created_at, action",
        [draft.id],
      );
      expect(audit.rows.map((r) => r.action)).toEqual(
        expect.arrayContaining(["requirement.archived", "requirement.status_changed"]),
      );
      expect(audit.rows.find((r) => r.action === "requirement.archived")?.metadata).toEqual({
        from: "draft",
      });
    });
  });

  it("can never be undone, not even by the table owner", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const draft = await create(tx, SEED.adminMro, { status: "draft" });
      await actAs(tx, SEED.adminMro);
      await tx.query(ARCHIVE, [draft.id]);
      await tx.exec("reset role");
      const undo = await sqlError(
        tx,
        "update public.work_requirements set archived_at = null where id = $1",
        [draft.id],
      );
      expect(undo.code).toBe("55000");
    });
  });

  it("a plain member, another organization and a professional get the same 42501 as a missing id", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const draft = await create(tx, SEED.adminMro, { status: "draft" });
      for (const user of [SEED.charlieMember, SEED.adminOther, SEED.delta, SEED.platformAdmin]) {
        await actAs(tx, user);
        expect((await sqlError(tx, ARCHIVE, [draft.id])).code, user).toBe("42501");
      }
      await actAs(tx, SEED.adminMro);
      expect((await sqlError(tx, ARCHIVE, [randomUUID()])).code).toBe("42501");
      expect((await row(tx, draft.id)).archived_at).toBeNull();
    });
  });
});

describe("opportunity projection and proposal terms carry the new terms (D-12 fixed projection, R-08)", () => {
  it("list_opportunities returns the terms and still no ids of people or organizations", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const { id } = await create(tx, SEED.adminMro, { description: "Night stop support" });
      await actAs(tx, SEED.hotelPrivate);
      const { rows } = await tx.query<Record<string, unknown>>(
        "select * from public.list_opportunities($1)",
        [id],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        country: "ES",
        time_zone: "Europe/Madrid",
        description: "Night stop support",
        shifts: threeDays(),
        conditions: V18_CONDITIONS,
      });
      expect(Object.keys(rows[0]!)).not.toContain("archived_at");
      expect(JSON.stringify(rows[0])).not.toContain(SEED.adminMro);
      expect(JSON.stringify(rows[0])).not.toContain(mroId);
    });
  });

  it("a proposal freezes the terms of its version (T-11 widened)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const { id } = await create(tx, SEED.adminMro, {
        qualifications: [
          { qualification_type_id: b11, requirement_level: "hard" },
          { qualification_type_id: a320, requirement_level: "hard" },
        ],
      });
      await makeAvailable(tx, [SEED.echo]);
      await actAs(tx, SEED.echo);
      const app = (
        await tx.query<{ id: string }>("select * from public.apply_to_requirement($1, $2, true)", [
          id,
          randomUUID(),
        ])
      ).rows[0]!;
      for (const to of ["shortlisted", "proposed"]) {
        await tx.exec("reset role");
        const version = (
          await tx.query<{ updated_at: Date }>(
            "select updated_at from public.applications where id = $1",
            [app.id],
          )
        ).rows[0]!.updated_at.toISOString();
        await actAs(tx, SEED.managerMro);
        await tx.query("select * from public.transition_application($1, $2, $3, $4)", [
          app.id,
          to,
          version,
          randomUUID(),
        ]);
      }
      await tx.exec("reset role");
      const terms = (
        await tx.query<{ terms: Record<string, unknown> }>(
          "select terms from public.application_proposals where application_id = $1",
          [app.id],
        )
      ).rows[0]!.terms;
      expect(terms).toMatchObject({
        country: "ES",
        timeZone: "Europe/Madrid",
        shifts: threeDays(),
        conditions: V18_CONDITIONS,
      });
      expect(Object.keys(terms)).not.toContain("archivedAt");
      expect(JSON.stringify(terms)).not.toContain("commission");
    });
  });
});

describe("live count of viable candidates (v2-13, T-66)", () => {
  const COUNT = "select public.count_viable_candidates($1, $2, $3, $4, $5::uuid[]) as n";
  const COUNT_WITH_COUNTRY =
    "select public.count_viable_candidates($1, $2, $3, $4, $5::uuid[], p_country => $6) as n";

  it("counts internal members and visible professionals who pass the hard filters — never private ones", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      await makeAvailable(tx, [SEED.delta, SEED.echo, SEED.hotelPrivate, SEED.alpha]);
      await actAs(tx, SEED.managerMro);
      const n = (
        await tx.query<{ n: number }>(COUNT, [mroId, at(20, 8), at(22, 16), "planned", [b11, a320]])
      ).rows[0]!.n;
      // The truth, computed with the same SQL rule for the profiles that may be counted.
      await tx.exec("reset role");
      const truth = (
        await tx.query<{ profile_id: string; visibility: string; member: boolean }>(
          `select tp.profile_id, tp.visibility::text,
                  exists (select 1 from public.organization_members m
                          where m.organization_id = $1 and m.profile_id = tp.profile_id) as member
           from public.technician_profiles tp
           cross join lateral app_private.hard_eligibility_for($2, $3, 'planned', $4::uuid[], tp.profile_id) e
           where e.qualifications_ok and e.availability_ok`,
          [mroId, at(20, 8), at(22, 16), [b11, a320]],
        )
      ).rows;
      const counted = truth.filter((t) => t.member || t.visibility !== "private");
      expect(n).toBe(counted.length);
      expect(n).toBeGreaterThan(0);
      // Hotel (private, not a member) is eligible here and still not counted; made visible, it is.
      expect(truth.find((t) => t.profile_id === SEED.hotelPrivate)).toMatchObject({
        visibility: "private",
        member: false,
      });
      await tx.query(
        "update public.technician_profiles set visibility = 'anonymous' where profile_id = $1",
        [SEED.hotelPrivate],
      );
      await actAs(tx, SEED.managerMro);
      const visible = (
        await tx.query<{ n: number }>(COUNT, [mroId, at(20, 8), at(22, 16), "planned", [b11, a320]])
      ).rows[0]!.n;
      expect(visible).toBe(n + 1);
    });
  });

  it("counts exactly the pool's candidates: internal + ranked_external_pool, blocks and «verified_orgs» included", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      await makeAvailable(tx, [SEED.delta, SEED.echo, SEED.hotelPrivate, SEED.alpha]);
      const { id } = await create(tx, SEED.adminMro, {
        qualifications: [
          { qualification_type_id: b11, requirement_level: "hard" },
          { qualification_type_id: a320, requirement_level: "hard" },
        ],
      });
      const envelope = shiftEnvelope(threeDays())!;
      const poolTruth = async () => {
        await tx.exec("reset role");
        const { rows } = await tx.query<{ n: number }>(
          `select (select count(*)::int from app_private.ranked_external_pool($1) where hard_eligible)
                + (select count(*)::int from public.organization_members m
                   join public.technician_profiles tp on tp.profile_id = m.profile_id
                   cross join lateral app_private.hard_eligibility($1, tp.profile_id) e
                   where m.organization_id = $2 and e.qualifications_ok and e.availability_ok
                     and e.profile_ok) as n`,
          [id, mroId],
        );
        return rows[0]!.n;
      };
      const count = async () => {
        await actAs(tx, SEED.managerMro);
        return (
          // The form sends the job's country (ES by default): matching-v18 work-permit rule (BR-3.7).
          (
            await tx.query<{ n: number }>(COUNT_WITH_COUNTRY, [
              mroId,
              envelope.startsAt,
              envelope.endsAt,
              "planned",
              [b11, a320],
              "ES",
            ])
          ).rows[0]!.n
        );
      };
      const base = await count();
      expect(base).toBe(await poolTruth());
      // N-08: echo blocks Demo MRO → leaves the pool and the count alike.
      await tx.exec("reset role");
      await tx.query(
        "insert into public.technician_organization_blocks (technician_profile_id, organization_id) values ($1, $2)",
        [SEED.echo, mroId],
      );
      expect(await count()).toBe(base - 1);
      expect(await count()).toBe(await poolTruth());
      // BR-8: hotel as «verified_orgs» counts only once the organization's review is registered. Hotel
      // declares a Spanish work permit: the job's country is ES (matching-v18 work-permit rule, BR-3.7).
      await tx.query(
        "update public.technician_profiles set visibility = 'verified_orgs', work_permits = '{ES}' where profile_id = $1",
        [SEED.hotelPrivate],
      );
      await tx.query(
        "update public.organizations set review_status = 'pending', reviewed_at = null where id = $1",
        [mroId],
      );
      const pending = await count();
      expect(pending).toBe(await poolTruth());
      await tx.query(
        "update public.organizations set review_status = 'reviewed', reviewed_at = now() where id = $1",
        [mroId],
      );
      expect(await count()).toBe(pending + 1);
      expect(await count()).toBe(await poolTruth());
    });
  });

  it("only for a period that has not started (no probing of the past)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      await actAs(tx, SEED.adminMro);
      expect(
        (await sqlError(tx, COUNT, [mroId, at(-5, 8), at(-3, 16), "planned", [b11]])).code,
      ).toBe("22023");
    });
  });

  it("app_private.hard_eligibility still equals the helper on a saved requirement", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const { id } = await create(tx, SEED.adminMro, {
        qualifications: [
          { qualification_type_id: b11, requirement_level: "hard" },
          { qualification_type_id: a320, requirement_level: "hard" },
          { qualification_type_id: sms, requirement_level: "soft" },
        ],
      });
      await makeAvailable(tx, [SEED.delta]);
      await tx.exec("reset role");
      const { rows } = await tx.query<{ same: boolean }>(
        `select bool_and(a.qualifications_ok = b.qualifications_ok and a.availability_ok = b.availability_ok) as same
         from public.technician_profiles tp
         cross join lateral app_private.hard_eligibility($1, tp.profile_id) a
         cross join lateral app_private.hard_eligibility_for($2, $3, 'planned', $4::uuid[], tp.profile_id) b`,
        [id, at(20, 8), at(22, 16), [b11, a320]],
      );
      expect(rows[0]!.same).toBe(true);
    });
  });

  it("is for admins/managers of that organization only, and refuses an empty or endless preview", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      for (const user of [SEED.charlieMember, SEED.adminOther, SEED.delta, SEED.platformAdmin]) {
        await actAs(tx, user);
        expect(
          (await sqlError(tx, COUNT, [mroId, at(20, 8), at(22, 16), "planned", [b11]])).code,
          user,
        ).toBe("42501");
      }
      await actAs(tx, SEED.adminOther);
      expect(
        (
          await tx.query<{ n: number }>(COUNT, [
            otherOrgId,
            at(20, 8),
            at(22, 16),
            "planned",
            [b11],
          ])
        ).rows[0]!.n,
      ).toBeGreaterThanOrEqual(0);
      await actAs(tx, SEED.adminMro);
      expect((await sqlError(tx, COUNT, [mroId, at(20, 8), at(22, 16), "planned", []])).code).toBe(
        "22023",
      );
      expect(
        (await sqlError(tx, COUNT, [mroId, at(22, 8), at(20, 16), "planned", [b11]])).code,
      ).toBe("22023");
      expect(
        (await sqlError(tx, COUNT, [mroId, at(1, 8), at(400, 16), "planned", [b11]])).code,
      ).toBe("22023");
      await actAs(tx, null);
      expect(
        (await sqlError(tx, COUNT, [mroId, at(20, 8), at(22, 16), "planned", [b11]])).code,
      ).toBe("42501");
    });
  });
});
