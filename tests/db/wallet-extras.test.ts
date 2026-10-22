// Package wallet-extras: the wallet trash (N-19, migration 20261024200000, T-100/T-101, BUSINESS_RULES
// BR-24) on the existing tombstone/retention machinery, and the server floor for single availability
// windows (N-26, migration 20261024200100, T-104, BR-4.6).
import { createHash } from "node:crypto";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, queryError, SEED } from "./harness";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDatabase();
});

const BUCKET = "professional-documents";
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const pathFor = (uid: string, key: string, hash: string) => `${uid}/${key}-${hash.slice(0, 16)}`;
const create = `select * from public.create_professional_document($1, $2, $3, $4, $5, $6, $7, $8, $9)`;

/** Switches the transaction to `uid` as the `authenticated` API role. */
async function become(tx: Transaction, uid: string) {
  await tx.exec("reset role");
  await tx.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: uid, role: "authenticated" }),
  ]);
  await tx.exec("set local role authenticated");
}

/** Runs `fn` as the database owner (no API role), then returns to `uid`. */
async function asSuper<T>(tx: Transaction, uid: string, fn: () => Promise<T>): Promise<T> {
  await tx.exec("reset role");
  const out = await fn();
  await become(tx, uid);
  return out;
}

/** Storage upload + the idempotent create, as the signed-in owner (what the Edge Function does). */
async function createDoc(tx: Transaction, uid: string, key: string, content: string) {
  const hash = sha(content);
  const path = pathFor(uid, key, hash);
  const size = Buffer.byteLength(content);
  await tx.query(
    "insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, $4)",
    [BUCKET, path, uid, JSON.stringify({ size, mimetype: "application/pdf" })],
  );
  const { rows } = await tx.query<{ id: string }>(create, [
    key,
    "license",
    "B1 licence",
    path,
    "application/pdf",
    size,
    hash,
    null,
    null,
  ]);
  return { id: rows[0]!.id, path };
}

/** Puts a document in the trash `days` ago, bypassing the clock trigger (owner-side fixture). */
async function archivedDaysAgo(tx: Transaction, uid: string, id: string, days: number) {
  await asSuper(tx, uid, async () => {
    await tx.exec(
      "alter table public.professional_documents disable trigger professional_documents_archive_clock",
    );
    await tx.query(
      "update public.professional_documents set archived_at = now() - make_interval(days => $2) where id = $1",
      [id, days],
    );
    await tx.exec(
      "alter table public.professional_documents enable trigger professional_documents_archive_clock",
    );
  });
}

const archivedAt = async (tx: Transaction, id: string) =>
  (
    await tx.query<{ archived_at: Date | null; now: Date }>(
      "select archived_at, now() as now from public.professional_documents where id = $1",
      [id],
    )
  ).rows[0];

describe("N-19 wallet trash (migration 20261024200000)", () => {
  beforeAll(async () => {
    await db.query(
      "insert into app_private.feature_flags (name, enabled) values ('document_wallet', true) on conflict (name) do update set enabled = true",
    );
  });
  afterAll(async () => {
    await db.query("delete from app_private.feature_flags where name = 'document_wallet'");
  });

  it("archive and restore: owner only, the database clock decides the date, both audited (ids and flags only)", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const doc = await createDoc(tx, SEED.delta, "a1b2c3d4-0000-4000-8000-000000000001", "%PDF-a");
      // A client value is ignored: the row gets now(), not a backdated date.
      await tx.query(
        "update public.professional_documents set archived_at = '2000-01-01' where id = $1",
        [doc.id],
      );
      const first = await archivedAt(tx, doc.id);
      expect(first!.archived_at?.getTime()).toBe(first!.now.getTime());
      // Archiving again keeps the first date (a post-dated value does not extend the retention).
      await archivedDaysAgo(tx, SEED.delta, doc.id, 3);
      await tx.query(
        "update public.professional_documents set archived_at = '2999-01-01' where id = $1",
        [doc.id],
      );
      const kept = await archivedAt(tx, doc.id);
      expect(kept!.now.getTime() - kept!.archived_at!.getTime()).toBe(3 * 86_400_000);
      await tx.query("update public.professional_documents set archived_at = null where id = $1", [
        doc.id,
      ]);
      expect((await archivedAt(tx, doc.id))!.archived_at).toBeNull();

      const audit = await asSuper(tx, SEED.delta, () =>
        tx.query<{ action: string; actor_profile_id: string; metadata: Record<string, unknown> }>(
          `select action, actor_profile_id, metadata from public.audit_events
           where entity_id = $1 and action <> 'document.uploaded' order by created_at, action`,
          [doc.id],
        ),
      );
      // The owner's archive, the fixture's backdating (also a change of `archived_at`), the restore.
      expect(audit.rows.map((r) => r.action).sort()).toEqual([
        "document.archived",
        "document.archived",
        "document.restored",
      ]);
      for (const row of audit.rows) {
        expect(row.actor_profile_id).toBe(SEED.delta);
        expect(row.metadata.changed).toEqual(["archived_at"]);
        expect(JSON.stringify(row.metadata)).not.toMatch(/B1 licence|professional-documents/);
      }
    });
  });

  it("another user cannot archive or restore; a new row cannot be created archived", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const doc = await createDoc(tx, SEED.delta, "a1b2c3d4-0000-4000-8000-000000000002", "%PDF-b");
      await become(tx, SEED.echo);
      const res = await tx.query(
        "update public.professional_documents set archived_at = now() where id = $1",
        [doc.id],
      );
      expect(res.affectedRows).toBe(0);
      await become(tx, SEED.delta);
      expect((await archivedAt(tx, doc.id))!.archived_at).toBeNull();
      expect(
        await queryError(
          tx,
          `insert into public.professional_documents (owner_id, kind, title, storage_path, mime_type, size_bytes, sha256, archived_at)
           values ($1, 'other', 'x', $2, 'application/pdf', 3, $3, now())`,
          [SEED.delta, doc.path, sha("x")],
        ),
      ).toMatch(/permission denied/);
    });
  });

  it("flag off: archive and restore of the owner's own documents keep working (only NEW documents are gated)", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const doc = await createDoc(tx, SEED.delta, "a1b2c3d4-0000-4000-8000-000000000003", "%PDF-c");
      await asSuper(tx, SEED.delta, () =>
        tx.query("delete from app_private.feature_flags where name = 'document_wallet'"),
      );
      await tx.query("update public.professional_documents set archived_at = now() where id = $1", [
        doc.id,
      ]);
      expect((await archivedAt(tx, doc.id))!.archived_at).not.toBeNull();
      await tx.query("update public.professional_documents set archived_at = null where id = $1", [
        doc.id,
      ]);
      expect((await archivedAt(tx, doc.id))!.archived_at).toBeNull();
    });
  });

  it("retention: 30 days by default, read by signed-in users only, changed in SQL by the database owner", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const days = () =>
        tx.query<{ d: number }>("select public.document_trash_retention_days() as d");
      expect((await days()).rows).toEqual([{ d: 30 }]);
      await asSuper(tx, SEED.delta, async () => {
        await tx.query(
          "update app_private.document_retention_settings set archive_retention = interval '45 days'",
        );
        expect(
          await queryError(
            tx,
            "update app_private.document_retention_settings set archive_retention = interval '1 hour'",
          ),
        ).toMatch(/check/);
      });
      expect((await days()).rows).toEqual([{ d: 45 }]);
      expect(
        await queryError(tx, "update app_private.document_retention_settings set id = id"),
      ).toMatch(/permission denied/);
    });
    await asUser(db, null, async (tx) => {
      expect(await queryError(tx, "select public.document_trash_retention_days()")).toMatch(
        /permission denied/,
      );
    });
  });

  it("maintenance: dry-run lists expired trash only; apply deletes it, tombstones `trash_expired` due now, audits, and returns the object for purge", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const expired = await createDoc(
        tx,
        SEED.delta,
        "a1b2c3d4-0000-4000-8000-000000000004",
        "%PDF-expired",
      );
      const recent = await createDoc(
        tx,
        SEED.delta,
        "a1b2c3d4-0000-4000-8000-000000000005",
        "%PDF-recent",
      );
      const active = await createDoc(
        tx,
        SEED.delta,
        "a1b2c3d4-0000-4000-8000-000000000006",
        "%PDF-active",
      );
      await archivedDaysAgo(tx, SEED.delta, expired.id, 31);
      await archivedDaysAgo(tx, SEED.delta, recent.id, 29);

      // The owner cannot run the sweep (S-10).
      expect(
        await queryError(tx, "select * from public.document_maintenance_batch(false, 10)"),
      ).toMatch(/not authorized/);

      await become(tx, SEED.platformAdmin);
      type Row = {
        tombstone_id: string | null;
        storage_path: string;
        reason: string;
        action: string;
      };
      const dry = await tx.query<Row>("select * from public.document_maintenance_batch(false, 50)");
      const would = dry.rows.filter((r) => r.action === "would_expire");
      expect(would).toEqual([
        {
          tombstone_id: null,
          storage_path: expired.path,
          reason: "trash_expired",
          action: "would_expire",
        },
      ]);
      const stillThere = async (id: string) =>
        asSuper(
          tx,
          SEED.platformAdmin,
          async () =>
            (await tx.query("select 1 from public.professional_documents where id = $1", [id])).rows
              .length,
        );
      expect(await stillThere(expired.id)).toBe(1); // dry-run writes nothing

      const applied = await tx.query<Row>(
        "select * from public.document_maintenance_batch(true, 50)",
      );
      const forPath = applied.rows.filter((r) => r.storage_path === expired.path);
      expect(forPath.map((r) => [r.reason, r.action])).toEqual([
        ["trash_expired", "expired"],
        ["trash_expired", "purge"],
      ]);
      const paths = applied.rows.map((r) => r.storage_path);
      expect(paths).not.toContain(recent.path);
      expect(paths).not.toContain(active.path);
      expect(await stillThere(expired.id)).toBe(0);
      expect(await stillThere(recent.id)).toBe(1);
      expect(await stillThere(active.id)).toBe(1);

      const { tomb, audit } = await asSuper(tx, SEED.platformAdmin, async () => ({
        tomb: (
          await tx.query<{ reason: string; due: boolean }>(
            "select reason, purge_after <= now() as due from app_private.document_object_tombstones where storage_path = $1",
            [expired.path],
          )
        ).rows,
        audit: (
          await tx.query<{ action: string; actor_profile_id: string; metadata: object }>(
            "select action, actor_profile_id, metadata from public.audit_events where entity_id = $1 and action not in ('document.uploaded', 'document.archived')",
            [expired.id],
          )
        ).rows,
      }));
      expect(tomb).toEqual([{ reason: "trash_expired", due: true }]);
      expect(audit.map((a) => [a.action, a.actor_profile_id])).toEqual([
        ["document.trash_expired", SEED.platformAdmin],
      ]);
      expect(JSON.stringify(audit[0]!.metadata)).not.toMatch(/B1 licence|professional-documents/);
      // The recorded purge closes the tombstone; the next sweep finds nothing for that path.
      const tombstoneId = forPath.find((r) => r.action === "purge")!.tombstone_id!;
      await tx.query("select public.document_purge_record($1, 'purged', null)", [tombstoneId]);
      const again = await tx.query<Row>(
        "select * from public.document_maintenance_batch(true, 50)",
      );
      expect(again.rows.map((r) => r.storage_path)).not.toContain(expired.path);
    });
  });

  it("the owner's permanent delete from the trash stays an immediate `owner_delete`; an account deletion keeps its grace", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const own = await createDoc(
        tx,
        SEED.delta,
        "a1b2c3d4-0000-4000-8000-000000000007",
        "%PDF-own",
      );
      const casc = await createDoc(
        tx,
        SEED.delta,
        "a1b2c3d4-0000-4000-8000-000000000008",
        "%PDF-casc",
      );
      await archivedDaysAgo(tx, SEED.delta, own.id, 40);
      await archivedDaysAgo(tx, SEED.delta, casc.id, 40);
      await tx.query("delete from public.professional_documents where id = $1", [own.id]);
      const reasons = await asSuper(tx, SEED.delta, async () => {
        await tx.query("select set_config('request.jwt.claims', '', true)");
        await tx.query("delete from public.technician_profiles where profile_id = $1", [
          SEED.delta,
        ]);
        return (
          await tx.query<{ storage_path: string; reason: string; due: boolean }>(
            `select storage_path, reason, purge_after <= now() as due
             from app_private.document_object_tombstones where storage_path = any($1) order by reason`,
            [[own.path, casc.path]],
          )
        ).rows;
      });
      expect(reasons).toEqual([
        { storage_path: casc.path, reason: "account_deleted", due: false },
        { storage_path: own.path, reason: "owner_delete", due: true },
      ]);
    });
  });

  it("the tombstone reason CHECK accepts `trash_expired` and still refuses anything else", async () => {
    await db.transaction(async (tx) => {
      await tx.query(
        `insert into app_private.document_object_tombstones (storage_path, owner_id, reason, purge_after)
         values ($1, $2, 'trash_expired', now())`,
        [pathFor(SEED.delta, "a1b2c3d4-0000-4000-8000-000000000009", sha("t")), SEED.delta],
      );
      expect(
        await queryError(
          tx,
          `insert into app_private.document_object_tombstones (storage_path, owner_id, reason, purge_after)
           values ($1, $2, 'whatever', now())`,
          [pathFor(SEED.delta, "a1b2c3d4-0000-4000-8000-00000000000a", sha("u")), SEED.delta],
        ),
      ).toMatch(/document_object_tombstones_reason_check/);
      await tx.rollback();
    });
  });
});

describe("N-26 availability: no single window may start on a past UTC day (migration 20261024200100)", () => {
  const createWindow = "select * from public.create_availability_window($1, $2, $3, $4)";
  const TODAY = "((now() at time zone 'UTC')::date)::timestamp at time zone 'UTC'";

  /** SQLSTATE + hint of a statement expected to fail (savepoint keeps the transaction usable). */
  async function refusal(tx: Transaction, sql: string, params: unknown[] = []) {
    await tx.exec("savepoint expected_error");
    try {
      await tx.query(sql, params);
    } catch (error) {
      await tx.exec("rollback to savepoint expected_error");
      const e = error as { code?: string; hint?: string; message: string };
      return { code: e.code, hint: e.hint, message: e.message };
    }
    await tx.exec("release savepoint expected_error");
    return null;
  }

  const at = async (tx: Transaction, offset: string) =>
    (await tx.query<{ t: string }>(`select (${TODAY} + $1::interval)::text as t`, [offset]))
      .rows[0]!.t;

  it("POST (RPC) and a direct insert with a start before today are refused with 22023 / hint past_start; today is fine", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const yesterday = await at(tx, "-1 day");
      const lastMinute = await at(tx, "-1 minute");
      const midnight = await at(tx, "0");
      const tomorrow = await at(tx, "1 day");
      for (const start of [yesterday, lastMinute]) {
        expect(
          await refusal(tx, createWindow, [
            "b1b2c3d4-0000-4000-8000-000000000001",
            start,
            tomorrow,
            "available",
          ]),
        ).toEqual({
          code: "22023",
          hint: "past_start",
          message: "an availability window cannot start on a past day",
        });
      }
      expect(
        await refusal(
          tx,
          `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
           values ($1, $2, $3, 'unavailable')`,
          [SEED.delta, yesterday, tomorrow],
        ),
      ).toMatchObject({ code: "22023", hint: "past_start" });
      const created = await tx.query<{ id: string; replayed: boolean }>(createWindow, [
        "b1b2c3d4-0000-4000-8000-000000000002",
        midnight,
        tomorrow,
        "available",
      ]);
      expect(created.rows[0]!.replayed).toBe(false);
    });
  });

  it("PATCH: moving a start onto a past day is refused; the window in progress keeps its past start (same minute) when its end or status changes", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const inProgress = await asSuper(
        tx,
        SEED.delta,
        async () =>
          (
            await tx.query<{ id: string }>(
              `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
               values ($1, ${TODAY} - interval '2 days' + interval '30 seconds', ${TODAY} + interval '5 days', 'available')
               returning id`,
              [SEED.delta],
            )
          ).rows[0]!.id,
      );
      const future = (
        await tx.query<{ id: string }>(createWindow, [
          "b1b2c3d4-0000-4000-8000-000000000003",
          await at(tx, "3 days"),
          await at(tx, "4 days"),
          "available",
        ])
      ).rows[0]!.id;

      // The form sends the stored start at minute precision with the new end/status: accepted.
      expect(
        await refusal(
          tx,
          `update public.availability_windows
           set starts_at = date_trunc('minute', starts_at), ends_at = ends_at + interval '1 day', status = 'aog_only'
           where id = $1`,
          [inProgress],
        ),
      ).toBeNull();
      expect(
        await refusal(
          tx,
          "update public.availability_windows set starts_at = starts_at - interval '1 day' where id = $1",
          [inProgress],
        ),
      ).toMatchObject({ code: "22023", hint: "past_start" });
      expect(
        await refusal(
          tx,
          `update public.availability_windows set starts_at = ${TODAY} - interval '1 day' where id = $1`,
          [future],
        ),
      ).toMatchObject({ code: "22023", hint: "past_start" });
      // Moving it within today or later is fine, and DELETE of the window in progress is untouched.
      expect(
        await refusal(
          tx,
          `update public.availability_windows set starts_at = ${TODAY} + interval '2 days' where id = $1`,
          [future],
        ),
      ).toBeNull();
      expect(
        (await tx.query("delete from public.availability_windows where id = $1", [inProgress]))
          .affectedRows,
      ).toBe(1);
    });
  });

  it("the calendar save still cuts today out of a window that started in the past; seeds and operators are not API writes", async () => {
    await asUser(db, SEED.delta, async (tx) => {
      const today = (
        await tx.query<{ d: string }>("select (now() at time zone 'UTC')::date::text d")
      ).rows[0]!.d;
      await asSuper(tx, SEED.delta, async () => {
        await tx.query("delete from public.availability_windows where technician_profile_id = $1", [
          SEED.delta,
        ]);
        // An operator / seed insert of a historic window is not refused.
        await tx.query(
          `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
           values ($1, ${TODAY} - interval '10 days', ${TODAY} + interval '10 days', 'available')`,
          [SEED.delta],
        );
      });
      await tx.query("select * from public.replace_availability_days($1, $2::jsonb, null, null)", [
        "b1b2c3d4-0000-4000-8000-000000000004",
        JSON.stringify([{ date: today, status: "unavailable" }]),
      ]);
      const rows = (
        await tx.query<{ s: string; st: string }>(
          `select (starts_at - ${TODAY})::text s, status::text st from public.availability_windows
           where technician_profile_id = $1 order by starts_at`,
          [SEED.delta],
        )
      ).rows;
      expect(rows).toEqual([
        { s: "-10 days", st: "available" },
        { s: "00:00:00", st: "unavailable" },
        { s: "1 day", st: "available" },
      ]);
    });
  });

  it("the trigger sits next to the calendar package's triggers, which are unchanged", async () => {
    const { rows } = await db.query<{ tgname: string }>(
      "select tgname from pg_trigger where tgrelid = 'public.availability_windows'::regclass and not tgisinternal order by tgname",
    );
    expect(rows.map((r) => r.tgname)).toEqual(
      expect.arrayContaining([
        "availability_windows_lock_owner",
        "availability_windows_protect_assignments",
        "availability_windows_refuse_past_start",
      ]),
    );
  });
});
