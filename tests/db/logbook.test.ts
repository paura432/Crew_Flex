// Personal logbook (M14, N-12, migration 20261023200000, BUSINESS_RULES BR-17): owner-only RLS,
// idempotent create, «no future date» in the database, audit with ids/flags only, account deletion.
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, queryError, SEED } from "./harness";
import { LOGBOOK_CATEGORIES, LOGBOOK_ENVIRONMENTS } from "../../src/domain/logbook";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDatabase();
});

const KEY = "5b0e7c1a-2f3d-4e8a-9b1c-6d7e8f9a0b1c";
const OTHER_KEY = "5b0e7c1a-2f3d-4e8a-9b1c-6d7e8f9a0b1d";
const create =
  "select * from public.create_logbook_entry($1, $2::date, $3, $4, $5, $6, $7, $8, $9)";
const MADRID_TODAY = "(now() at time zone 'Europe/Madrid')::date";

type EntryArgs = {
  date?: string | null; // null → today in Madrid
  aircraft?: string;
  ata?: string | null;
  hours?: number;
  description?: string;
  cvRelevant?: boolean;
};

async function madridToday(tx: Transaction | PGlite): Promise<string> {
  const { rows } = await tx.query<{ d: string }>(`select ${MADRID_TODAY}::text as d`);
  return rows[0]!.d;
}

async function createEntry(tx: Transaction, key = KEY, args: EntryArgs = {}) {
  const date = args.date ?? (await madridToday(tx));
  const { rows } = await tx.query<{ id: string; replayed: boolean }>(create, [
    key,
    date,
    args.aircraft ?? "A320 EC-QAA",
    args.ata === undefined ? "32" : args.ata,
    args.hours ?? 3.5,
    "component_replacement",
    "line_maintenance",
    args.description ?? "Main wheel replaced and tyre pressure checked (synthetic).",
    args.cvRelevant ?? false,
  ]);
  return rows[0]!;
}

async function count(tx: Transaction | PGlite, sql: string, params: unknown[] = []) {
  const { rows } = await tx.query<{ n: number }>(
    `select count(*)::int as n from (${sql}) s`,
    params,
  );
  return rows[0]!.n;
}

describe("logbook: schema and grants", () => {
  it("RLS is on, anon has no privilege, the enums are v1.8's lists", async () => {
    const { rows } = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where oid = 'public.logbook_entries'::regclass",
    );
    expect(rows[0]!.relrowsecurity).toBe(true);
    const anon = await db.query<{ p: boolean }>(
      `select has_table_privilege('anon', 'public.logbook_entries', 'select')
           or has_table_privilege('anon', 'public.logbook_entries', 'insert')
           or has_table_privilege('anon', 'public.logbook_entries', 'update')
           or has_table_privilege('anon', 'public.logbook_entries', 'delete') as p`,
    );
    expect(anon.rows[0]!.p).toBe(false);
    const enums = await db.query<{ c: string[]; e: string[] }>(
      `select enum_range(null::public.logbook_category)::text[] as c,
              enum_range(null::public.logbook_environment)::text[] as e`,
    );
    expect(enums.rows[0]!.c).toEqual([...LOGBOOK_CATEGORIES]);
    expect(enums.rows[0]!.e).toEqual([...LOGBOOK_ENVIRONMENTS]);
  });

  it("the idempotency CHECK keeps every earlier operation and adds logbook_entry.create", async () => {
    const { rows } = await db.query<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
       where conrelid = 'app_private.idempotency_keys'::regclass
         and conname = 'idempotency_keys_operation_check'`,
    );
    for (const op of [
      "work_requirement.create",
      "availability_window.create",
      "qualification.declare",
      "availability_days.replace",
      "document.create",
      "application.create",
      "application.transition",
      "logbook_entry.create",
    ]) {
      expect(rows[0]!.def, op).toContain(`'${op}'`);
    }
  });

  it("anon cannot run the create RPC; nobody can call the trigger functions", async () => {
    const { rows } = await db.query<{
      anon: boolean;
      auth: boolean;
      audit: boolean;
      date: boolean;
    }>(
      `select
         has_function_privilege('anon', 'public.create_logbook_entry(uuid, date, text, text, numeric, public.logbook_category, public.logbook_environment, text, boolean)', 'execute') as anon,
         has_function_privilege('authenticated', 'public.create_logbook_entry(uuid, date, text, text, numeric, public.logbook_category, public.logbook_environment, text, boolean)', 'execute') as auth,
         has_function_privilege('authenticated', 'public.audit_logbook_entry()', 'execute') as audit,
         has_function_privilege('authenticated', 'public.enforce_logbook_entry_date()', 'execute') as date`,
    );
    expect(rows[0]).toEqual({ anon: false, auth: true, audit: false, date: false });
  });
});

describe("logbook: owner CRUD", () => {
  it("create via RPC (defaults: active, not selectable), read, edit, archive, restore, delete", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const created = await createEntry(tx);
      expect(created.replayed).toBe(false);
      const { rows } = await tx.query(
        `select technician_profile_id, aircraft, ata, hours::text as hours, category, environment,
                cv_relevant, archived
         from public.logbook_entries where id = $1`,
        [created.id],
      );
      expect(rows).toEqual([
        {
          technician_profile_id: SEED.delta,
          aircraft: "A320 EC-QAA",
          ata: "32",
          hours: "3.5",
          category: "component_replacement",
          environment: "line_maintenance",
          cv_relevant: false,
          archived: false,
        },
      ]);

      const edited = await tx.query(
        `update public.logbook_entries
         set aircraft = 'A321 EC-QAB', ata = null, hours = 2, cv_relevant = true where id = $1`,
        [created.id],
      );
      expect(edited.affectedRows).toBe(1);
      expect(
        (
          await tx.query("update public.logbook_entries set archived = true where id = $1", [
            created.id,
          ])
        ).affectedRows,
      ).toBe(1);
      expect(
        (
          await tx.query("update public.logbook_entries set archived = false where id = $1", [
            created.id,
          ])
        ).affectedRows,
      ).toBe(1);
      expect(
        (await tx.query("delete from public.logbook_entries where id = $1", [created.id]))
          .affectedRows,
      ).toBe(1);
    });
  });

  it("same Idempotency-Key + same request → replay; another request → CF409", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const first = await createEntry(tx);
      const replay = await createEntry(tx);
      expect(replay).toEqual({ id: first.id, replayed: true });
      expect(
        await count(tx, "select 1 from public.logbook_entries where technician_profile_id = $1", [
          SEED.delta,
        ]),
      ).toBe(1);
      const error = await queryError(tx, create, [
        KEY,
        await madridToday(tx),
        "B737 NG EC-QAC",
        null,
        1.5,
        "inspection",
        "base_maintenance",
        "Different request under the same key.",
        false,
      ]);
      expect(error).toMatch(/idempotency key reused/);
      const other = await createEntry(tx, OTHER_KEY);
      expect(other.replayed).toBe(false);
      expect(other.id).not.toBe(first.id);
    });
  });

  it("every change is audited with ids, flags and field names only — never the text", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const { id } = await createEntry(tx, KEY, {
        aircraft: "SECRET-AIRCRAFT",
        description: "SECRET-DESCRIPTION",
      });
      await tx.query(
        "update public.logbook_entries set description = 'SECRET-EDIT', archived = true where id = $1",
        [id],
      );
      await tx.query("update public.logbook_entries set archived = archived where id = $1", [id]); // no-op
      await tx.query("delete from public.logbook_entries where id = $1", [id]);
      await tx.exec("reset role");
      const { rows } = await tx.query<{
        action: string;
        actor: string;
        org: string | null;
        metadata: unknown;
      }>(
        `select action, actor_profile_id as actor, organization_id as org, metadata
         from public.audit_events where entity_id = $1 order by created_at, action`,
        [id],
      );
      expect(rows.map((r) => r.action).sort()).toEqual([
        "logbook.created",
        "logbook.deleted",
        "logbook.updated",
      ]);
      for (const r of rows) {
        expect(r.actor).toBe(SEED.delta);
        expect(r.org).toBeNull(); // an organization's audit trail never sees it
        expect(JSON.stringify(r.metadata)).not.toMatch(/SECRET|EC-Q|wheel/);
      }
      expect(rows.find((r) => r.action === "logbook.updated")!.metadata).toEqual({
        technician_profile_id: SEED.delta,
        changed: ["description", "archived"],
        archived: true,
        cv_relevant: false,
      });
    });
  });
});

describe("logbook: database backstops (BR-17)", () => {
  it("refuses a date after today in Madrid, whatever the session time zone", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      for (const zone of ["UTC", "Pacific/Kiritimati", "America/Los_Angeles"]) {
        await tx.query(`set local timezone = '${zone}'`);
        const today = await madridToday(tx);
        const tomorrow = (await tx.query<{ d: string }>(`select (${MADRID_TODAY} + 1)::text as d`))
          .rows[0]!.d;
        expect(
          await queryError(tx, create, [
            crypto.randomUUID(),
            tomorrow,
            "A320",
            null,
            1,
            "inspection",
            "workshop",
            "Future.",
            false,
          ]),
          zone,
        ).toMatch(/not future/);
        const ok = await createEntry(tx, crypto.randomUUID(), { date: today });
        // …and an existing entry cannot be moved into the future either.
        expect(
          await queryError(
            tx,
            "update public.logbook_entries set entry_date = $2::date where id = $1",
            [ok.id, tomorrow],
          ),
        ).toMatch(/not future/);
      }
    });
  });

  it("CHECKs: aircraft 1–100, ATA ≤ 10, hours 0–24, description 1–3000 (non-blank)", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const bad: EntryArgs[] = [
        { aircraft: "   " },
        { aircraft: "A".repeat(101) },
        { ata: "12345678901" },
        { ata: "  " },
        { hours: 24.1 },
        { hours: -0.1 },
        { description: " " },
        { description: "x".repeat(3001) },
      ];
      for (const args of bad) {
        const date = await madridToday(tx);
        const message = await queryError(tx, create, [
          crypto.randomUUID(),
          date,
          args.aircraft ?? "A320",
          args.ata === undefined ? null : args.ata,
          args.hours ?? 1,
          "inspection",
          "workshop",
          args.description ?? "ok",
          false,
        ]);
        expect(message, JSON.stringify(args).slice(0, 60)).toMatch(/check constraint/);
      }
      expect((await createEntry(tx, crypto.randomUUID(), { hours: 0 })).replayed).toBe(false);
      expect((await createEntry(tx, crypto.randomUUID(), { hours: 24 })).replayed).toBe(false);
    });
  });

  it("the owner cannot move an entry to another profile nor insert it archived", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const { id } = await createEntry(tx);
      expect(
        await queryError(
          tx,
          "update public.logbook_entries set technician_profile_id = $2 where id = $1",
          [id, SEED.echo],
        ),
      ).toMatch(/permission denied/);
      expect(
        await queryError(
          tx,
          `insert into public.logbook_entries (technician_profile_id, entry_date, aircraft, hours, description, archived)
           values ($1, ${MADRID_TODAY}, 'A320', 1, 'x', true)`,
          [SEED.delta],
        ),
      ).toMatch(/permission denied/);
    });
  });
});

describe("logbook: private to its owner", () => {
  async function seedAlphaEntry(): Promise<string> {
    // Alpha belongs to Demo MRO Madrid, whose admin and manager read Alpha's passport (OD-4).
    let id = "";
    await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: SEED.alpha, role: "authenticated" }),
      ]);
      await tx.exec("set local role authenticated");
      id = (await createEntry(tx, crypto.randomUUID())).id;
    });
    return id;
  }

  it("nobody else reads, edits or deletes it: other technician, own org admin/manager, platform admin, anon", async () => {
    const id = await seedAlphaEntry();
    for (const other of [SEED.delta, SEED.adminMro, SEED.managerMro, SEED.platformAdmin, null]) {
      await asUser(db, other, async (tx) => {
        if (other === null) {
          expect(await queryError(tx, "select * from public.logbook_entries")).toMatch(
            /permission denied/,
          );
          return;
        }
        expect(
          await count(tx, "select 1 from public.logbook_entries where id = $1", [id]),
          other,
        ).toBe(0);
        expect(
          (await tx.query("update public.logbook_entries set archived = true where id = $1", [id]))
            .affectedRows,
        ).toBe(0);
        expect(
          (await tx.query("delete from public.logbook_entries where id = $1", [id])).affectedRows,
        ).toBe(0);
      });
    }
    // The owner still sees it, unchanged.
    await asUser(db, SEED.alpha, async (tx) => {
      const { rows } = await tx.query("select archived from public.logbook_entries where id = $1", [
        id,
      ]);
      expect(rows).toEqual([{ archived: false }]);
    });
  });

  it("nobody can write an entry for someone else (RLS), and an organization account has no logbook", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      expect(
        await queryError(
          tx,
          `insert into public.logbook_entries (technician_profile_id, entry_date, aircraft, hours, description)
           values ($1, ${MADRID_TODAY}, 'A320', 1, 'forged')`,
          [SEED.echo],
        ),
      ).toMatch(/row-level security/);
    });
    await asUser(db, SEED.adminMro, async (tx) => {
      expect(
        await queryError(tx, create, [
          crypto.randomUUID(),
          await madridToday(tx),
          "A320",
          null,
          1,
          "inspection",
          "workshop",
          "x",
          false,
        ]),
      ).toMatch(/foreign key/);
    });
  });
});

describe("logbook: account deletion cascades", () => {
  // A fresh professional with only logbook data, so the test isolates this table's triggers.
  const TMP = "00000000-0000-4000-8000-0000000000aa";

  it("deleting the user removes the entries and keys, without a logbook.deleted audit row", async () => {
    // Auth admin deletion (no JWT) and a deletion run under the owner's own JWT (a future
    // self-service path: the audit trigger must not insert a row for a profile being deleted).
    for (const claims of ["", JSON.stringify({ sub: TMP, role: "authenticated" })]) {
      let checked = false;
      await db.transaction(async (tx) => {
        await tx.query(
          `insert into auth.users (id, email, raw_user_meta_data)
           values ($1, 'logbook.tmp@crewflex.test', '{"account_type":"professional","display_name":"Logbook Tmp"}')`,
          [TMP],
        );
        await tx.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: TMP, role: "authenticated" }),
        ]);
        await tx.exec("set local role authenticated");
        const { id } = await createEntry(tx, crypto.randomUUID());
        await tx.exec("reset role");
        const keys = "select 1 from app_private.idempotency_keys where actor_id = $1";
        expect(await count(tx, keys, [TMP])).toBe(1);
        await tx.query("select set_config('request.jwt.claims', $1, true)", [claims]);
        await tx.query("delete from auth.users where id = $1", [TMP]);
        expect(await count(tx, "select 1 from public.logbook_entries where id = $1", [id])).toBe(0);
        expect(await count(tx, keys, [TMP])).toBe(0);
        expect(
          await count(
            tx,
            "select 1 from public.audit_events where entity_id = $1 and action = 'logbook.deleted'",
            [id],
          ),
        ).toBe(0);
        checked = true;
        await tx.rollback();
      });
      expect(checked).toBe(true);
    }
  });
});
