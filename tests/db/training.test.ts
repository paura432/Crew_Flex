// Training «Formación» (ADR-003, batch V19-01; migrations 20261029100000…100400). Two independent
// provider organizations (Demo MRO Madrid = A, Demo Aero Services Lisbon = B), two professionals (Delta,
// Echo), a platform admin. Every case runs in a rolled-back transaction (harness `asUser`), under the
// `authenticated` role with `auth.uid()` set, so RLS, grants and the DEFINER checks are what is tested.
import { randomUUID } from "node:crypto";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { TRAINING_TRANSITIONS } from "../../src/domain/training";
import { asUser, createTestDatabase, orgIdByName, SEED } from "./harness";

let db: PGlite;
let orgA: string;
let orgB: string;
let demoTraining: string;
const ADMIN_A = SEED.adminMro;
const MANAGER_A = SEED.managerMro;
const ADMIN_B = SEED.adminOther;
const MEMBER_A = SEED.alpha; // member of org A (no admin/manager role), also a professional
const DELTA = SEED.delta;
const ECHO = SEED.echo;
const PLATFORM_ADMIN = SEED.platformAdmin;
const TRAINING_ADMIN = "00000000-0000-4000-8000-000000000051";

beforeAll(async () => {
  db = await createTestDatabase();
  orgA = await orgIdByName(db, "Demo MRO Madrid");
  orgB = await orgIdByName(db, "Demo Aero Services Lisbon");
  demoTraining = await orgIdByName(db, "Demo Formación Aeronáutica");
  await db.query(
    "insert into app_private.feature_flags (name, enabled) values ('training', true) on conflict (name) do update set enabled = true",
  );
});

async function actAs(tx: Transaction, userId: string | null) {
  await tx.exec("reset role");
  await tx.query("select set_config('request.jwt.claims', $1, true)", [
    userId ? JSON.stringify({ sub: userId, role: "authenticated" }) : "",
  ]);
  await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
}
const asOwner = (tx: Transaction) => tx.exec("reset role");

async function sqlstate(tx: Transaction, sql: string, params: unknown[] = []) {
  await tx.exec("savepoint expected_error");
  try {
    await tx.query(sql, params);
  } catch (error) {
    await tx.exec("rollback to savepoint expected_error");
    return (error as { code?: string }).code;
  }
  throw new Error(`expected statement to fail: ${sql}`);
}

const iso = (d: Date | string) => new Date(d).toISOString();
const inDays = (days: number, hours = 0) =>
  new Date(Date.now() + days * 86_400_000 + hours * 3_600_000).toISOString();

type Saved = { id: string; status: string; updated_at: Date };

async function saveProvider(tx: Transaction, actor: string, org: string, expected?: Date) {
  await actAs(tx, actor);
  const { rows } = await tx.query<{ organization_id: string; status: string; updated_at: Date }>(
    "select * from public.save_training_provider($1, $2, $3, $4, $5)",
    [
      org,
      "Escuela de prueba",
      "Solo datos ficticios",
      "https://example.test",
      expected ? iso(expected) : null,
    ],
  );
  return rows[0]!;
}

async function review(
  tx: Transaction,
  actor: string,
  kind: string,
  id: string,
  decision: string,
  note?: string,
) {
  await asOwner(tx);
  const table =
    kind === "provider"
      ? "training_providers"
      : kind === "course"
        ? "training_courses"
        : "training_editions";
  const key = kind === "provider" ? "organization_id" : "id";
  const { rows } = await tx.query<{ updated_at: Date }>(
    `select updated_at from public.${table} where ${key} = $1`,
    [id],
  );
  await actAs(tx, actor);
  const r = await tx.query<Saved>("select * from public.review_training($1, $2, $3, $4, $5)", [
    kind,
    id,
    decision,
    iso(rows[0]!.updated_at),
    note ?? null,
  ]);
  return r.rows[0]!;
}

async function saveCourse(tx: Transaction, actor: string, org: string, title = "Prueba Ñandú HF") {
  await actAs(tx, actor);
  const { rows } = await tx.query<Saved>(
    `select * from public.save_training_course($1, null, null, $2, 'safety', 'Formación de factores humanos',
       'Español', 'Documento emitido y entregado por el proveedor', 'Proveedor sintético')`,
    [org, title],
  );
  return rows[0]!;
}

async function submit(tx: Transaction, actor: string, kind: "course" | "edition", id: string) {
  await asOwner(tx);
  const table = kind === "course" ? "training_courses" : "training_editions";
  const { rows } = await tx.query<{ updated_at: Date }>(
    `select updated_at from public.${table} where id = $1`,
    [id],
  );
  await actAs(tx, actor);
  const r = await tx.query<Saved>(`select * from public.submit_training_${kind}($1, $2)`, [
    id,
    iso(rows[0]!.updated_at),
  ]);
  return r.rows[0]!;
}

const SESSIONS = JSON.stringify([
  { startsAt: inDays(30, 8), endsAt: inDays(30, 16), location: "Madrid", element: "theory" },
  { startsAt: inDays(31, 8), endsAt: inDays(31, 12), element: "assessment" },
]);

async function saveEdition(
  tx: Transaction,
  actor: string,
  courseId: string,
  over: {
    id?: string;
    capacity?: number;
    sessions?: string;
    mode?: string;
    provisional?: boolean;
    priceUnit?: string;
    priceCents?: number | null;
    deadline?: string | null;
    timeZone?: string;
  } = {},
) {
  let expected: string | null = null;
  if (over.id) {
    await asOwner(tx);
    const { rows } = await tx.query<{ updated_at: Date }>(
      "select updated_at from public.training_editions where id = $1",
      [over.id],
    );
    expected = iso(rows[0]!.updated_at);
  }
  await actAs(tx, actor);
  const { rows } = await tx.query<Saved & { session_count: number }>(
    `select * from public.save_training_edition($1, $2, $3, $4, $5, $6, $7, $8, 'EUR',
       '200 EUR, IVA incluido', 'Cancelación sin coste hasta siete días antes', $9, $10::jsonb, $11, 'Madrid', 'ES')`,
    [
      courseId,
      over.id ?? null,
      expected,
      over.mode ?? "onsite",
      over.provisional ?? false,
      over.capacity ?? 1,
      over.priceUnit ?? "person",
      over.priceCents === undefined ? 20000 : over.priceCents,
      over.timeZone ?? "Europe/Madrid",
      over.sessions ?? SESSIONS,
      over.deadline ?? null,
    ],
  );
  return rows[0]!;
}

/** Provider A reviewed, one published course with one published edition (capacity 1 by default). */
async function published(
  tx: Transaction,
  over: Parameters<typeof saveEdition>[3] = {},
  org = orgA,
  admin = ADMIN_A,
) {
  await saveProvider(tx, admin, org);
  await review(tx, PLATFORM_ADMIN, "provider", org, "reviewed");
  const course = await saveCourse(tx, admin, org);
  await submit(tx, admin, "course", course.id);
  await review(tx, PLATFORM_ADMIN, "course", course.id, "published");
  const edition = await saveEdition(tx, admin, course.id, over);
  await submit(tx, admin, "edition", edition.id);
  await review(tx, PLATFORM_ADMIN, "edition", edition.id, "published");
  return { courseId: course.id, editionId: edition.id };
}

async function request(
  tx: Transaction,
  actor: string,
  courseId: string,
  editionId: string | null,
  kind = "seat",
  key = randomUUID(),
) {
  await actAs(tx, actor);
  const { rows } = await tx.query<{ id: string; replayed: boolean }>(
    "select * from public.create_training_request($1, $2, $3, $4, $5, $6, 1)",
    [key, courseId, editionId, kind, `Alumno ficticio ${actor.slice(-2)}`, "Consulta privada"],
  );
  return rows[0]!;
}

async function requestRow(tx: Transaction, id: string) {
  await asOwner(tx);
  const { rows } = await tx.query<{
    status: string;
    updated_at: Date;
    current_offer_id: string | null;
  }>("select status, updated_at, current_offer_id from public.training_requests where id = $1", [
    id,
  ]);
  return rows[0]!;
}

const TRANSITION =
  "select * from public.transition_training_request($1, $2, $3, $4, $5, $6, $7, $8, $9)";

async function step(
  tx: Transaction,
  actor: string,
  id: string,
  to: string,
  extra: {
    reason?: string;
    offerId?: string | null;
    acceptTerms?: boolean;
    outcome?: string;
    quote?: number;
    key?: string;
    expected?: string;
  } = {},
) {
  const row = await requestRow(tx, id);
  await actAs(tx, actor);
  const { rows } = await tx.query<{
    request_id: string;
    status: string;
    offer_id: string | null;
    replayed: boolean;
  }>(TRANSITION, [
    id,
    to,
    extra.expected ?? iso(row.updated_at),
    extra.key ?? randomUUID(),
    extra.reason ?? null,
    extra.offerId === undefined ? (to === "accepted" ? row.current_offer_id : null) : extra.offerId,
    extra.acceptTerms ?? (to === "accepted" ? true : null),
    extra.outcome ?? null,
    extra.quote ?? null,
  ]);
  return rows[0]!;
}

async function stepError(
  tx: Transaction,
  actor: string,
  id: string,
  to: string,
  extra: Parameters<typeof step>[4] = {},
) {
  const row = await requestRow(tx, id);
  await actAs(tx, actor);
  return sqlstate(tx, TRANSITION, [
    id,
    to,
    extra.expected ?? iso(row.updated_at),
    extra.key ?? randomUUID(),
    extra.reason ?? null,
    extra.offerId === undefined ? (to === "accepted" ? row.current_offer_id : null) : extra.offerId,
    extra.acceptTerms ?? (to === "accepted" ? true : null),
    extra.outcome ?? null,
    extra.quote ?? null,
  ]);
}

/** received → offered → accepted (Delta by default). */
async function accepted(
  tx: Transaction,
  professional: string,
  courseId: string,
  editionId: string,
  provider = ADMIN_A,
) {
  const { id } = await request(tx, professional, courseId, editionId);
  await step(tx, provider, id, "offered");
  await step(tx, professional, id, "accepted");
  return id;
}

async function notices(tx: Transaction, recipient: string) {
  await asOwner(tx);
  const { rows } = await tx.query<{
    training_status: string;
    training_request_id: string | null;
    training_course_id: string | null;
  }>(
    "select training_status, training_request_id, training_course_id from public.notifications where recipient_id = $1 and kind = 'training' order by created_at",
    [recipient],
  );
  return rows;
}

describe("training: transition table and flag", () => {
  it("app_private.training_transitions equals TRAINING_TRANSITIONS", async () => {
    const { rows } = await db.query<{
      from_status: string;
      to_status: string;
      actor: string;
      reason_required: boolean;
    }>(
      "select from_status, to_status, actor, reason_required from app_private.training_transitions order by 1, 2, 3",
    );
    const key = (t: { from_status: string; to_status: string; actor: string }) =>
      `${t.from_status}|${t.to_status}|${t.actor}`;
    const expected = TRAINING_TRANSITIONS.map((t) => ({
      from_status: t.from,
      to_status: t.to,
      actor: t.actor,
      reason_required: t.reason === true,
    }));
    expect([...rows].sort((a, b) => key(a).localeCompare(key(b)))).toEqual(
      expected.sort((a, b) => key(a).localeCompare(key(b))),
    );
  });

  it("flag off → every RPC refuses with 0A000 and nothing is written", async () => {
    await asUser(db, ADMIN_A, async (tx) => {
      await asOwner(tx);
      await tx.query(
        "update app_private.feature_flags set enabled = false where name = 'training'",
      );
      await actAs(tx, ADMIN_A);
      expect(
        await sqlstate(tx, "select * from public.save_training_provider($1, 'x', 'y')", [orgA]),
      ).toBe("0A000");
      expect(await sqlstate(tx, "select * from public.list_training_catalog()")).toBe("0A000");
      expect(await sqlstate(tx, "select * from public.get_training_workspace($1)", [orgA])).toBe(
        "0A000",
      );
      await actAs(tx, DELTA);
      expect(await sqlstate(tx, "select public.toggle_training_favorite($1)", [randomUUID()])).toBe(
        "0A000",
      );
      await asOwner(tx);
      const { rows } = await tx.query(
        "select 1 from public.training_providers where organization_id = $1",
        [orgA],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it("nobody writes the tables directly (API roles have SELECT only); offers and events are immutable", async () => {
    await asUser(db, ADMIN_A, async (tx) => {
      expect(
        await sqlstate(
          tx,
          "insert into public.training_providers (organization_id, name, description) values ($1, 'x', 'y')",
          [orgA],
        ),
      ).toBe("42501");
      expect(await sqlstate(tx, "update public.training_courses set title = 'x'")).toBe("42501");
      expect(await sqlstate(tx, "delete from public.training_requests")).toBe("42501");
      expect(await sqlstate(tx, "select review_note from public.training_providers")).toBe("42501"); // column grant
      await asOwner(tx);
      const { courseId, editionId } = await published(tx);
      const id = await accepted(tx, DELTA, courseId, editionId);
      await asOwner(tx);
      expect(
        await sqlstate(tx, "update public.training_offers set terms = '{}' where request_id = $1", [
          id,
        ]),
      ).toBe("55000");
      expect(
        await sqlstate(
          tx,
          "update public.training_request_events set seq = 99 where request_id = $1",
          [id],
        ),
      ).toBe("55000");
    });
  });
});

describe("training: provider, courses, editions, review (V19-008…017)", () => {
  it("admin/manager save the provider (→ pending); a member, another organization and anon cannot", async () => {
    await asUser(db, ADMIN_A, async (tx) => {
      const saved = await saveProvider(tx, MANAGER_A, orgA);
      expect(saved.status).toBe("pending");
      await actAs(tx, MEMBER_A);
      expect(
        await sqlstate(tx, "select * from public.save_training_provider($1, 'x', 'y')", [orgA]),
      ).toBe("42501");
      await actAs(tx, ADMIN_B);
      expect(
        await sqlstate(tx, "select * from public.save_training_provider($1, 'x', 'y')", [orgA]),
      ).toBe("42501");
      expect(
        await sqlstate(
          tx,
          "select * from public.save_training_provider($1, 'x', 'y', 'http://insecure')",
          [orgB],
        ),
      ).toBe("22023");
      await actAs(tx, null);
      expect(
        await sqlstate(tx, "select * from public.save_training_provider($1, 'x', 'y')", [orgA]),
      ).toBe("42501");
      // Stale version refused; the right one resubmits.
      await actAs(tx, ADMIN_A);
      expect(
        await sqlstate(tx, "select * from public.save_training_provider($1, 'x', 'y', null, $2)", [
          orgA,
          "2020-01-01T00:00:00Z",
        ]),
      ).toBe("CF412");
      expect(
        await sqlstate(tx, "select * from public.save_training_provider($1, 'x', 'y')", [orgA]),
      ).toBe("22023");
      expect((await saveProvider(tx, ADMIN_A, orgA, saved.updated_at)).status).toBe("pending");
    });
  });

  it("review: platform admins only, never their own organization, a reason except to approve; audited and notified", async () => {
    await asUser(db, ADMIN_A, async (tx) => {
      await saveProvider(tx, ADMIN_A, orgA);
      await asOwner(tx);
      const { rows } = await tx.query<{ updated_at: Date }>(
        "select updated_at from public.training_providers where organization_id = $1",
        [orgA],
      );
      const at = iso(rows[0]!.updated_at);
      // The provider cannot review itself (not a platform admin).
      await actAs(tx, ADMIN_A);
      expect(
        await sqlstate(tx, "select * from public.review_training('provider', $1, 'reviewed', $2)", [
          orgA,
          at,
        ]),
      ).toBe("42501");
      await actAs(tx, PLATFORM_ADMIN);
      expect(
        await sqlstate(tx, "select * from public.review_training('provider', $1, 'rejected', $2)", [
          orgA,
          at,
        ]),
      ).toBe("22023"); // reason required
      expect(
        await sqlstate(tx, "select * from public.review_training('provider', $1, 'reviewed', $2)", [
          orgA,
          "2020-01-01T00:00:00Z",
        ]),
      ).toBe("CF412");
      expect(
        await sqlstate(tx, "select * from public.review_training('provider', $1, 'reviewed', $2)", [
          randomUUID(),
          at,
        ]),
      ).toBe("P0002");
      expect((await review(tx, PLATFORM_ADMIN, "provider", orgA, "reviewed")).status).toBe(
        "reviewed",
      );
      // The platform admin administers «CrewFlex Operaciones»: they cannot review it (S-16).
      await asOwner(tx);
      const own = (
        await tx.query<{ id: string }>("select id from public.organizations where name = $1", [
          "CrewFlex Operaciones",
        ])
      ).rows[0]!.id;
      await saveProvider(tx, PLATFORM_ADMIN, own);
      await asOwner(tx);
      const r2 = await tx.query<{ updated_at: Date }>(
        "select updated_at from public.training_providers where organization_id = $1",
        [own],
      );
      await actAs(tx, PLATFORM_ADMIN);
      expect(
        await sqlstate(tx, "select * from public.review_training('provider', $1, 'reviewed', $2)", [
          own,
          iso(r2.rows[0]!.updated_at),
        ]),
      ).toBe("42501");
      // Audit + a notice to the organization's admins/managers (not the reviewer).
      await asOwner(tx);
      const audit = await tx.query(
        "select 1 from public.audit_events where action = 'training.provider_reviewed' and entity_id = $1 and actor_profile_id = $2",
        [orgA, PLATFORM_ADMIN],
      );
      expect(audit.rows).toHaveLength(1);
      expect((await notices(tx, ADMIN_A)).map((n) => n.training_status)).toEqual(["reviewed"]);
      expect((await notices(tx, MANAGER_A)).map((n) => n.training_status)).toEqual(["reviewed"]);
      expect(await notices(tx, MEMBER_A)).toHaveLength(0);
      // The review queue never lists the admin's own organization.
      await actAs(tx, PLATFORM_ADMIN);
      const queue = await tx.query<{ item: { organizationId: string } }>(
        "select item from public.get_training_review_queue()",
      );
      expect(queue.rows.some((r) => r.item.organizationId === own)).toBe(false);
    });
  });

  it("courses: another organization cannot edit or submit; publishing needs a reviewed provider (CFT11)", async () => {
    await asUser(db, ADMIN_A, async (tx) => {
      await actAs(tx, ADMIN_A);
      expect(
        await sqlstate(
          tx,
          "select * from public.save_training_course($1, null, null, 'T', 'safety', 'D', 'es', 'C', 'I')",
          [orgA],
        ),
      ).toBe("55000"); // provider first
      await saveProvider(tx, ADMIN_A, orgA);
      const course = await saveCourse(tx, ADMIN_A, orgA);
      expect(course.status).toBe("draft");
      await actAs(tx, ADMIN_A);
      expect(
        await sqlstate(
          tx,
          "select * from public.save_training_course($1, null, null, 'T', 'safety', 'D', 'es', 'C', 'I', 'part147')",
          [orgA],
        ),
      ).toBe("22023"); // reference
      // Organization B: not found (no oracle), even naming its own organization id.
      await actAs(tx, ADMIN_B);
      expect(
        await sqlstate(
          tx,
          "select * from public.save_training_course($1, $2, $3, 'X', 'safety', 'D', 'es', 'C', 'I')",
          [orgA, course.id, iso(course.updated_at)],
        ),
      ).toBe("42501");
      await saveProvider(tx, ADMIN_B, orgB);
      await actAs(tx, ADMIN_B);
      expect(
        await sqlstate(
          tx,
          "select * from public.save_training_course($1, $2, $3, 'X', 'safety', 'D', 'es', 'C', 'I')",
          [orgB, course.id, iso(course.updated_at)],
        ),
      ).toBe("P0002");
      expect(
        await sqlstate(tx, "select * from public.submit_training_course($1, $2)", [
          course.id,
          iso(course.updated_at),
        ]),
      ).toBe("P0002");
      // RLS: B reads nothing of A's draft; A's manager reads it.
      const seenByB = await tx.query("select id from public.training_courses where id = $1", [
        course.id,
      ]);
      expect(seenByB.rows).toHaveLength(0);
      await actAs(tx, MANAGER_A);
      expect(
        (await tx.query("select id from public.training_courses where id = $1", [course.id])).rows,
      ).toHaveLength(1);
      // Submit, then publish is refused until the provider is reviewed.
      await submit(tx, ADMIN_A, "course", course.id);
      await asOwner(tx);
      const r = await tx.query<{ updated_at: Date }>(
        "select updated_at from public.training_courses where id = $1",
        [course.id],
      );
      await actAs(tx, PLATFORM_ADMIN);
      expect(
        await sqlstate(tx, "select * from public.review_training('course', $1, 'published', $2)", [
          course.id,
          iso(r.rows[0]!.updated_at),
        ]),
      ).toBe("CFT11");
      await review(tx, PLATFORM_ADMIN, "provider", orgA, "reviewed");
      expect((await review(tx, PLATFORM_ADMIN, "course", course.id, "published")).status).toBe(
        "published",
      );
      // Editing a published course sends it back to draft (re-review).
      await actAs(tx, ADMIN_A);
      const r2 = await tx.query<{ updated_at: Date }>(
        "select updated_at from public.training_courses where id = $1",
        [course.id],
      );
      const edited = await tx.query<Saved>(
        "select * from public.save_training_course($1, $2, $3, 'HF v2', 'safety', 'D', 'es', 'C', 'I')",
        [orgA, course.id, iso(r2.rows[0]!.updated_at)],
      );
      expect(edited.rows[0]!.status).toBe("draft");
    });
  });

  it("editions: sessions validated (overlap, 24 h, future, self-paced), IANA zone, money in cents; publish needs a published course", async () => {
    await asUser(db, ADMIN_A, async (tx) => {
      await saveProvider(tx, ADMIN_A, orgA);
      const course = await saveCourse(tx, ADMIN_A, orgA);
      const ok = await saveEdition(tx, ADMIN_A, course.id);
      expect([ok.status, ok.session_count]).toEqual(["draft", 2]);
      const bad = async (over: Parameters<typeof saveEdition>[3]) => {
        await actAs(tx, ADMIN_A);
        await tx.exec("savepoint bad");
        try {
          await saveEdition(tx, ADMIN_A, course.id, over);
        } catch (e) {
          await tx.exec("rollback to savepoint bad");
          return (e as { code?: string }).code;
        }
        throw new Error("expected failure");
      };
      const s = (a: number, b: number, c: number, d: number) =>
        JSON.stringify([{ startsAt: inDays(a, b), endsAt: inDays(c, d) }]);
      expect(
        await bad({
          sessions: JSON.stringify([
            { startsAt: inDays(30, 8), endsAt: inDays(30, 16) },
            { startsAt: inDays(30, 15), endsAt: inDays(30, 18) },
          ]),
        }),
      ).toBe("22023");
      expect(await bad({ sessions: s(30, 8, 31, 9) })).toBe("23514"); // > 24 h (table CHECK)
      expect(await bad({ sessions: s(30, 16, 30, 8) })).toBe("22023"); // empty range (end before start)
      expect(await bad({ sessions: s(-2, 8, -2, 16) })).toBe("22023"); // past
      expect(await bad({ sessions: "[]" })).toBe("22023"); // confirmed dates need a session
      expect(await bad({ mode: "selfpaced" })).toBe("22023"); // self-paced has no sessions
      expect(await bad({ mode: "selfpaced", sessions: "[]" })).toBe("22023"); // and needs a deadline
      expect(await bad({ timeZone: "no/existe" })).toBe("22023");
      expect(await bad({ priceCents: null })).toBe("22023"); // price unless quote
      expect(await bad({ capacity: 0 })).toBe("23514");
      expect(
        (await saveEdition(tx, ADMIN_A, course.id, { sessions: "[]", provisional: true })).status,
      ).toBe("draft");
      expect(
        (
          await saveEdition(tx, ADMIN_A, course.id, {
            mode: "selfpaced",
            sessions: "[]",
            deadline: inDays(90),
          })
        ).status,
      ).toBe("draft");
      expect(
        (await saveEdition(tx, ADMIN_A, course.id, { priceUnit: "quote", priceCents: null }))
          .status,
      ).toBe("draft");
      // Publish needs a live course.
      await submit(tx, ADMIN_A, "edition", ok.id);
      await asOwner(tx);
      const r = await tx.query<{ updated_at: Date }>(
        "select updated_at from public.training_editions where id = $1",
        [ok.id],
      );
      await actAs(tx, PLATFORM_ADMIN);
      expect(
        await sqlstate(tx, "select * from public.review_training('edition', $1, 'published', $2)", [
          ok.id,
          iso(r.rows[0]!.updated_at),
        ]),
      ).toBe("CFT11");
      // Organization B cannot touch A's edition.
      await actAs(tx, ADMIN_B);
      expect(
        await sqlstate(tx, "select * from public.cancel_training_edition($1, $2, 'x')", [
          ok.id,
          iso(r.rows[0]!.updated_at),
        ]),
      ).toBe("P0002");
    });
  });

  it("catalog: published only (course + provider + edition), accent-insensitive search, filters, 12 per page; private columns stay private", async () => {
    await asUser(db, DELTA, async (tx) => {
      const { courseId, editionId } = await published(tx, { capacity: 3 });
      await actAs(tx, DELTA);
      const rows = async (args: string, params: unknown[] = []) =>
        (
          await tx.query<{
            course: { id: string; editions: { id: string; remaining: number }[] };
            total: number;
          }>(`select * from public.list_training_catalog(${args})`, params)
        ).rows;
      const all = await rows("");
      const mine = all.find((r) => r.course.id === courseId)!;
      expect(mine.course.editions.map((e) => e.id)).toEqual([editionId]);
      expect(mine.course.editions[0]!.remaining).toBe(3);
      expect(JSON.stringify(mine)).not.toMatch(/reviewNote|review_note|cancelReason/);
      expect((await rows("'PRUEBA NANDU'")).map((r) => r.course.id)).toEqual([courseId]);
      expect((await rows("'ñandú hf'")).map((r) => r.course.id)).toEqual([courseId]);
      expect(await rows("'inexistente'")).toHaveLength(0);
      expect(
        (await rows("'nandu', 'safety', 'onsite', 'espa', 'es'")).map((r) => r.course.id),
      ).toEqual([courseId]);
      expect(await rows("null, 'engines'")).toHaveLength(0);
      expect(await rows("null, null, 'live'", [])).not.toContainEqual(
        expect.objectContaining({ course: expect.objectContaining({ id: courseId }) }),
      );
      expect(
        (
          await rows("null, null, null, null, null, $1::date, $2::date", [
            inDays(29).slice(0, 10),
            inDays(32).slice(0, 10),
          ])
        ).map((r) => r.course.id),
      ).toContain(courseId);
      expect(
        await rows("null, null, null, null, null, $1::date", [inDays(40).slice(0, 10)]),
      ).not.toContainEqual(
        expect.objectContaining({ course: expect.objectContaining({ id: courseId }) }),
      );
      expect(
        await sqlstate(
          tx,
          "select * from public.list_training_catalog(null, null, null, null, null, null, null, 0, 51)",
        ),
      ).toBe("22023");
      expect((await rows("null, null, null, null, null, null, null, 0, 1")).length).toBe(1);
      // Suspending the provider removes its courses from the catalog at once.
      await review(tx, PLATFORM_ADMIN, "provider", orgA, "suspended", "Suspensión de prueba");
      await actAs(tx, DELTA);
      expect((await rows("")).some((r) => r.course.id === courseId)).toBe(false);
      expect(await sqlstate(tx, "select public.get_training_course($1)", [courseId])).toBe("P0002");
      await actAs(tx, null);
      expect(await sqlstate(tx, "select * from public.list_training_catalog()")).toBe("42501"); // no anonymous catalog (N-4)
    });
  });
});

describe("training: requests, offers, seats (V19-019…026)", () => {
  it("seat: once per edition (CFT03), idempotent, not own organization (CFT04), provisional → inquiries only (CFT02)", async () => {
    await asUser(db, DELTA, async (tx) => {
      const { courseId, editionId } = await published(tx, { capacity: 2 });
      const key = randomUUID();
      const first = await request(tx, DELTA, courseId, editionId, "seat", key);
      expect(first.replayed).toBe(false);
      expect((await request(tx, DELTA, courseId, editionId, "seat", key)).id).toBe(first.id);
      await actAs(tx, DELTA);
      expect(
        await sqlstate(
          tx,
          "select * from public.create_training_request($1, $2, $3, 'seat', 'Alumno', null, 1)",
          [randomUUID(), courseId, editionId],
        ),
      ).toBe("CFT03");
      expect(
        await sqlstate(
          tx,
          "select * from public.create_training_request($1, $2, null, 'seat', 'Alumno', null, 1)",
          [randomUUID(), courseId],
        ),
      ).toBe("22023");
      // Alpha is a member of organization A.
      await actAs(tx, MEMBER_A);
      expect(
        await sqlstate(
          tx,
          "select * from public.create_training_request($1, $2, $3, 'seat', 'Alumno', null, 1)",
          [randomUUID(), courseId, editionId],
        ),
      ).toBe("CFT04");
      // An organization account without a technician profile cannot request.
      await actAs(tx, ADMIN_B);
      expect(
        await sqlstate(
          tx,
          "select * from public.create_training_request($1, $2, $3, 'seat', 'Alumno', null, 1)",
          [randomUUID(), courseId, editionId],
        ),
      ).toBe("42501");
      // Provisional edition: a seat is refused, an inquiry is taken.
      const prov = await saveEdition(tx, ADMIN_A, courseId, {
        sessions: "[]",
        provisional: true,
        mode: "live",
      });
      await submit(tx, ADMIN_A, "edition", prov.id);
      await review(tx, PLATFORM_ADMIN, "edition", prov.id, "published");
      await actAs(tx, ECHO);
      expect(
        await sqlstate(
          tx,
          "select * from public.create_training_request($1, $2, $3, 'seat', 'Alumno', null, 1)",
          [randomUUID(), courseId, prov.id],
        ),
      ).toBe("CFT02");
      const inquiry = await request(tx, ECHO, courseId, prov.id, "inquiry");
      expect((await requestRow(tx, inquiry.id)).status).toBe("received");
      // An inquiry is never offered; it is closed by the provider.
      expect(await stepError(tx, ADMIN_A, inquiry.id, "offered")).toBe("55000");
      expect((await step(tx, ADMIN_A, inquiry.id, "closed")).status).toBe("closed");
      // The provider's admins got one notice per new request; the professional none for their own act.
      expect(
        (await notices(tx, ADMIN_A))
          .filter((n) => n.training_request_id)
          .map((n) => n.training_status),
      ).toEqual(["received", "received"]);
      expect((await notices(tx, ECHO)).map((n) => n.training_status)).toEqual(["closed"]);
    });
  });

  it("privacy: another organization reads nothing; platform admins read requests but no messages; no e-mail anywhere", async () => {
    await asUser(db, DELTA, async (tx) => {
      const { courseId, editionId } = await published(tx);
      const { id } = await request(tx, DELTA, courseId, editionId);
      await actAs(tx, DELTA);
      await tx.query("select * from public.send_training_message($1, $2, 'Mensaje privado')", [
        id,
        randomUUID(),
      ]);
      await actAs(tx, ADMIN_A);
      await tx.query("select * from public.send_training_message($1, $2, 'Respuesta')", [
        id,
        randomUUID(),
      ]);
      // Organization B: nothing, through RLS or the RPCs.
      await actAs(tx, ADMIN_B);
      expect((await tx.query("select id from public.training_requests")).rows).toHaveLength(0);
      expect((await tx.query("select id from public.training_messages")).rows).toHaveLength(0);
      expect(await sqlstate(tx, "select * from public.get_training_inbox($1)", [orgA])).toBe(
        "42501",
      );
      expect(await sqlstate(tx, "select * from public.get_training_messages($1)", [id])).toBe(
        "P0002",
      );
      expect(await stepError(tx, ADMIN_B, id, "offered")).toBe("P0002");
      expect(
        await sqlstate(tx, "select * from public.send_training_message($1, $2, 'x')", [
          id,
          randomUUID(),
        ]),
      ).toBe("P0002");
      // Echo (another professional): not a party.
      await actAs(tx, ECHO);
      expect(await sqlstate(tx, "select * from public.get_training_messages($1)", [id])).toBe(
        "P0002",
      );
      expect((await tx.query("select id from public.training_messages")).rows).toHaveLength(0);
      // Platform admin: the request row (support), never the messages (N-6).
      await actAs(tx, PLATFORM_ADMIN);
      expect(
        (await tx.query("select id from public.training_requests where id = $1", [id])).rows,
      ).toHaveLength(1);
      expect(
        (await tx.query("select id from public.training_messages where request_id = $1", [id]))
          .rows,
      ).toHaveLength(0);
      expect(await sqlstate(tx, "select * from public.get_training_messages($1)", [id])).toBe(
        "P0002",
      );
      // The participants read both messages; the provider's inbox carries the typed name, not the e-mail.
      await actAs(tx, MANAGER_A);
      const msgs = await tx.query<{ sender_side: string; mine: boolean }>(
        "select sender_side, mine from public.get_training_messages($1)",
        [id],
      );
      // Same transaction = same created_at (PGlite): compare as a set.
      expect([...msgs.rows].sort((x, y) => x.sender_side.localeCompare(y.sender_side))).toEqual([
        { sender_side: "professional", mine: false },
        { sender_side: "provider", mine: false },
      ]);
      const inbox = await tx.query<{ request: Record<string, unknown>; total: number }>(
        "select * from public.get_training_inbox($1)",
        [orgA],
      );
      expect(inbox.rows[0]!.total).toBe(1);
      const text = JSON.stringify(inbox.rows[0]!.request);
      expect(text).toContain("Alumno ficticio 21");
      expect(text).not.toMatch(/@|crewflex\.test|professional_id|professionalId|Technician Delta/);
      expect(text).not.toContain(DELTA);
      const ws = JSON.stringify(
        (await tx.query("select public.get_training_workspace($1) as w", [orgA])).rows[0],
      );
      expect(ws).not.toMatch(/@|crewflex\.test/);
      // The professional reads their own request with its history.
      await actAs(tx, DELTA);
      const mine = await tx.query<{
        request: { id: string; history: unknown[]; courseTitle: string };
      }>("select * from public.get_my_training_requests()");
      expect(mine.rows.map((r) => r.request.id)).toEqual([id]);
      expect(mine.rows[0]!.request.history).toHaveLength(1);
      // Favourites: own only; toggling returns the new state.
      expect(
        (
          await tx.query<{ t: boolean }>("select public.toggle_training_favorite($1) as t", [
            courseId,
          ])
        ).rows[0]!.t,
      ).toBe(true);
      expect(
        (await tx.query("select * from public.get_my_training_favorites()")).rows,
      ).toHaveLength(1);
      expect(
        (
          await tx.query<{ t: boolean }>("select public.toggle_training_favorite($1) as t", [
            courseId,
          ])
        ).rows[0]!.t,
      ).toBe(false);
      await actAs(tx, ECHO);
      expect((await tx.query("select * from public.training_favorites")).rows).toHaveLength(0);
    });
  });

  it("offer → explicit acceptance of the CURRENT offer (CFT05), idempotent retry, confirmation, cancellation frees the seat (CFT07)", async () => {
    await asUser(db, DELTA, async (tx) => {
      const { courseId, editionId } = await published(tx, {
        capacity: 1,
        priceUnit: "engine",
        priceCents: 25000,
      });
      const a = (await request(tx, DELTA, courseId, editionId)).id;
      const b = (await request(tx, ECHO, courseId, editionId)).id;
      expect(await stepError(tx, ADMIN_A, a, "confirmed")).toBe("55000"); // not accepted yet
      expect(await stepError(tx, DELTA, a, "offered")).toBe("42501"); // the other party's action
      const offered = await step(tx, ADMIN_A, a, "offered");
      expect(offered.status).toBe("offered");
      await asOwner(tx);
      const offer = await tx.query<{
        id: string;
        version: number;
        total_cents: string;
        terms: { title: string; sessions: unknown[] };
      }>(
        "select id, version, total_cents, terms from public.training_offers where request_id = $1",
        [a],
      );
      expect([
        offer.rows[0]!.version,
        Number(offer.rows[0]!.total_cents),
        offer.rows[0]!.terms.sessions.length,
      ]).toEqual([1, 25000, 2]);
      // Accept: needs the current offer id and the explicit acceptance.
      expect(await stepError(tx, DELTA, a, "accepted", { offerId: randomUUID() })).toBe("CFT05");
      expect(await stepError(tx, DELTA, a, "accepted", { acceptTerms: false })).toBe("22023");
      expect(await stepError(tx, ADMIN_A, a, "accepted")).toBe("42501");
      const key = randomUUID();
      const acc = await step(tx, DELTA, a, "accepted", { key });
      expect([acc.status, acc.replayed]).toEqual(["accepted", false]);
      const before = await requestRow(tx, a);
      // The same key with the same payload (the version the client loaded) replays its own result.
      const retry = await step(tx, DELTA, a, "accepted", {
        key,
        offerId: offer.rows[0]!.id,
        expected: iso(before.updated_at),
      });
      expect([retry.status, retry.replayed]).toEqual(["accepted", true]);
      expect(
        await stepError(tx, DELTA, a, "accepted", {
          expected: iso(new Date(before.updated_at.getTime() - 5000)),
        }),
      ).toBe("55000"); // a fresh key: no longer offered
      // Confirm under the edition lock; the second accepted request hits the capacity.
      await step(tx, ADMIN_A, b, "offered");
      await step(tx, ECHO, b, "accepted");
      expect((await step(tx, ADMIN_A, a, "confirmed")).status).toBe("confirmed");
      expect(await stepError(tx, ADMIN_A, b, "confirmed")).toBe("CFT07");
      // The edition with a confirmed seat cannot be edited (CFT10); the catalog shows 0 remaining.
      await asOwner(tx);
      const e = await tx.query<{ updated_at: Date }>(
        "select updated_at from public.training_editions where id = $1",
        [editionId],
      );
      await actAs(tx, ADMIN_A);
      expect(
        await sqlstate(
          tx,
          `select * from public.save_training_edition($1, $2, $3, 'onsite', false, 5, 'engine', 25000, 'EUR', 'x', 'y', 'Europe/Madrid', $4::jsonb)`,
          [courseId, editionId, iso(e.rows[0]!.updated_at), SESSIONS],
        ),
      ).toBe("CFT10");
      await actAs(tx, DELTA);
      const cat = await tx.query<{ course: { editions: { remaining: number }[] } }>(
        "select course from public.list_training_catalog()",
      );
      expect(
        cat.rows.find((r) => JSON.stringify(r).includes(editionId))!.course.editions[0]!.remaining,
      ).toBe(0);
      // Delta's calendar marker; Echo has none.
      const sessions = await tx.query<{ request_id: string }>(
        "select request_id from public.get_my_training_sessions(now(), now() + interval '60 days')",
      );
      expect(sessions.rows.map((r) => r.request_id)).toEqual([a, a]);
      // Cancelling a confirmed seat needs a reason and frees it: Echo is confirmed next.
      expect(await stepError(tx, DELTA, a, "cancelled")).toBe("22023");
      expect((await step(tx, DELTA, a, "cancelled", { reason: "No podré asistir" })).status).toBe(
        "cancelled",
      );
      expect((await step(tx, ADMIN_A, b, "confirmed")).status).toBe("confirmed");
      // Notices went to the other party each time; the professional's own acts notified the provider.
      expect((await notices(tx, DELTA)).map((n) => n.training_status)).toEqual(["confirmed"]); // offered → confirmed merged in place while unread; own cancellation not notified
      expect((await notices(tx, ECHO)).map((n) => n.training_status)).toEqual(["confirmed"]);
      // Messages: the conversation of the cancelled request is closed (CFT13); Echo's is open.
      await actAs(tx, DELTA);
      expect(
        await sqlstate(tx, "select * from public.send_training_message($1, $2, 'x')", [
          a,
          randomUUID(),
        ]),
      ).toBe("CFT13");
      await actAs(tx, ECHO);
      expect(
        (
          await tx.query("select * from public.send_training_message($1, $2, 'Gracias')", [
            b,
            randomUUID(),
          ])
        ).rows,
      ).toHaveLength(1);
    });
  });

  it("changed terms need a new offer and acceptance (CFT06); waitlist and reject with reason; quote editions carry the agreed total", async () => {
    await asUser(db, DELTA, async (tx) => {
      const { courseId, editionId } = await published(tx, { capacity: 5 });
      const a = await accepted(tx, DELTA, courseId, editionId);
      // The provider edits the edition (no confirmed seat yet) and it is published again.
      await saveEdition(tx, ADMIN_A, courseId, { id: editionId, capacity: 6 });
      await submit(tx, ADMIN_A, "edition", editionId);
      await review(tx, PLATFORM_ADMIN, "edition", editionId, "published");
      // One transaction = one now(): the version is moved by hand to see the edit (PGlite artefact).
      await asOwner(tx);
      await tx.exec(
        "alter table public.training_editions disable trigger training_editions_set_updated_at",
      );
      await tx.query(
        "update public.training_editions set updated_at = now() - interval '1 minute' where id = $1",
        [editionId],
      );
      await tx.exec(
        "alter table public.training_editions enable trigger training_editions_set_updated_at",
      );
      expect(await stepError(tx, ADMIN_A, a, "confirmed")).toBe("CFT06");
      const v2 = await step(tx, ADMIN_A, a, "offered");
      expect(v2.status).toBe("offered");
      await asOwner(tx);
      expect(
        (
          await tx.query(
            "select version from public.training_offers where request_id = $1 order by version",
            [a],
          )
        ).rows,
      ).toEqual([{ version: 1 }, { version: 2 }]);
      await step(tx, DELTA, a, "accepted");
      expect((await step(tx, ADMIN_A, a, "confirmed")).status).toBe("confirmed");
      // Waitlist and reject.
      const b = (await request(tx, ECHO, courseId, editionId)).id;
      expect((await step(tx, ADMIN_A, b, "waitlisted")).status).toBe("waitlisted");
      expect(await stepError(tx, ADMIN_A, b, "rejected")).toBe("22023");
      expect(
        (await step(tx, ADMIN_A, b, "rejected", { reason: "Sin plazas este trimestre" })).status,
      ).toBe("rejected");
      expect(await stepError(tx, ADMIN_A, b, "offered")).toBe("55000"); // terminal
      // Quote edition: the offer needs the agreed total.
      const q = await saveEdition(tx, ADMIN_A, courseId, {
        priceUnit: "quote",
        priceCents: null,
        capacity: 2,
      });
      await submit(tx, ADMIN_A, "edition", q.id);
      await review(tx, PLATFORM_ADMIN, "edition", q.id, "published");
      const c = (await request(tx, ECHO, courseId, q.id)).id;
      expect(await stepError(tx, ADMIN_A, c, "offered")).toBe("22023");
      await step(tx, ADMIN_A, c, "offered", { quote: 123450 });
      await asOwner(tx);
      expect(
        Number(
          (
            await tx.query<{ total_cents: string }>(
              "select total_cents from public.training_offers where request_id = $1",
              [c],
            )
          ).rows[0]!.total_cents,
        ),
      ).toBe(123450);
      // Withdraw by the professional; the provider cannot withdraw.
      expect(await stepError(tx, ADMIN_A, c, "withdrawn")).toBe("42501");
      expect((await step(tx, ECHO, c, "withdrawn")).status).toBe("withdrawn");
    });
  });

  it("edition cancellation: reason required, every active request cancelled by the system and notified", async () => {
    await asUser(db, DELTA, async (tx) => {
      const { courseId, editionId } = await published(tx, { capacity: 3 });
      const a = await accepted(tx, DELTA, courseId, editionId);
      await step(tx, ADMIN_A, a, "confirmed");
      const b = (await request(tx, ECHO, courseId, editionId)).id;
      await asOwner(tx);
      const e = await tx.query<{ updated_at: Date }>(
        "select updated_at from public.training_editions where id = $1",
        [editionId],
      );
      await actAs(tx, MANAGER_A);
      expect(
        await sqlstate(tx, "select * from public.cancel_training_edition($1, $2, '')", [
          editionId,
          iso(e.rows[0]!.updated_at),
        ]),
      ).toBe("22023");
      const r = await tx.query<{ status: string; requests_cancelled: number }>(
        "select * from public.cancel_training_edition($1, $2, 'Reprogramación')",
        [editionId, iso(e.rows[0]!.updated_at)],
      );
      expect([r.rows[0]!.status, r.rows[0]!.requests_cancelled]).toEqual(["cancelled", 2]);
      await asOwner(tx);
      const rows = await tx.query<{ status: string; reason: string }>(
        "select status, reason from public.training_requests where id in ($1, $2)",
        [a, b],
      );
      expect(rows.rows).toEqual([
        { status: "cancelled", reason: "Reprogramación" },
        { status: "cancelled", reason: "Reprogramación" },
      ]);
      const ev = await tx.query(
        "select 1 from public.training_request_events where request_id in ($1, $2) and actor = 'system' and to_status = 'cancelled'",
        [a, b],
      );
      expect(ev.rows).toHaveLength(2);
      expect((await notices(tx, DELTA)).at(-1)!.training_status).toBe("cancelled");
      expect((await notices(tx, ECHO)).at(-1)!.training_status).toBe("cancelled");
      // Delta's seat no longer marks the calendar.
      await actAs(tx, DELTA);
      expect(
        (
          await tx.query(
            "select 1 from public.get_my_training_sessions(now(), now() + interval '60 days')",
          )
        ).rows,
      ).toHaveLength(0);
      await actAs(tx, ADMIN_A);
      expect(
        await sqlstate(
          tx,
          "select * from public.submit_training_edition($1, now() - interval '1 hour')",
          [editionId],
        ),
      ).toBe("CF412");
    });
  });
});

/** Employment fixture (as tests/db/notices.test.ts): an open need of org B over [from, to), Delta applies and reaches `accepted`. */
async function acceptedApplication(tx: Transaction, from: string, to: string) {
  await asOwner(tx);
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.work_requirements
       (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
     values ($1, 'Overlap need', 'Lisboa (LIS)', $2, $3, 'day', 1, 'planned', 'open', $4) returning id`,
    [orgB, from, to, ADMIN_B],
  );
  const req = rows[0]!.id;
  await tx.query(
    `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
     select $1, id, 'hard' from public.qualification_types where code in ('B1.1', 'TR-A320')`,
    [req],
  );
  await tx.query(
    `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
     values ($1, now() - interval '1 day', now() + interval '120 days', 'available')`,
    [DELTA],
  );
  await actAs(tx, DELTA);
  const app = (
    await tx.query<{ id: string }>("select * from public.apply_to_requirement($1, $2, true)", [
      req,
      randomUUID(),
    ])
  ).rows[0]!.id;
  const appStep = async (actor: string, to: string) => {
    await asOwner(tx);
    const a = await tx.query<{ updated_at: Date; current_proposal_id: string | null }>(
      "select updated_at, current_proposal_id from public.applications where id = $1",
      [app],
    );
    await actAs(tx, actor);
    return tx.query<{ status: string }>(
      "select * from public.transition_application($1, $2, $3, $4, null, $5)",
      [
        app,
        to,
        iso(a.rows[0]!.updated_at),
        randomUUID(),
        to === "accepted" ? a.rows[0]!.current_proposal_id : null,
      ],
    );
  };
  await appStep(ADMIN_B, "shortlisted");
  await appStep(ADMIN_B, "proposed");
  await appStep(DELTA, "accepted");
  return { app, confirm: () => appStep(ADMIN_B, "confirmed") };
}

describe("training: overlaps, completion, closure, export (V19-028, 034, 037)", () => {
  it("a confirmed employment assignment over a session refuses the seat (CFT08); a confirmed seat refuses the assignment (CFA17)", async () => {
    await asUser(db, DELTA, async (tx) => {
      const { courseId, editionId } = await published(tx, { capacity: 5 });
      // Employment first: the need covers the first session's day.
      const { confirm } = await acceptedApplication(tx, inDays(30, 6), inDays(30, 18));
      expect((await confirm()).rows[0]!.status).toBe("confirmed");
      const a = await accepted(tx, DELTA, courseId, editionId);
      expect(await stepError(tx, ADMIN_A, a, "confirmed")).toBe("CFT08");
      // Training first: a second professional's seat blocks a later overlapping assignment.
      const b = await accepted(tx, ECHO, courseId, editionId);
      expect((await step(tx, ADMIN_A, b, "confirmed")).status).toBe("confirmed");
      await asOwner(tx);
      await tx.query(
        "update public.technician_qualifications set verification_status = 'verified' where technician_profile_id = $1",
        [ECHO],
      );
      // Echo: the same fixture, over the second session (Echo has the full set; SMS pending is soft-irrelevant).
      const need = await tx.query<{ id: string }>(
        `insert into public.work_requirements (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
         values ($1, 'Overlap need 2', 'Lisboa (LIS)', $2, $3, 'day', 1, 'planned', 'open', $4) returning id`,
        [orgB, inDays(31, 10), inDays(31, 20), ADMIN_B],
      );
      await tx.query(
        `insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
         select $1, id, 'hard' from public.qualification_types where code in ('B1.1', 'TR-A320')`,
        [need.rows[0]!.id],
      );
      await tx.query(
        "insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status) values ($1, now() - interval '1 day', now() + interval '120 days', 'available')",
        [ECHO],
      );
      await actAs(tx, ECHO);
      const app = (
        await tx.query<{ id: string }>("select * from public.apply_to_requirement($1, $2, true)", [
          need.rows[0]!.id,
          randomUUID(),
        ])
      ).rows[0]!.id;
      const appStep = async (actor: string, to: string) => {
        await asOwner(tx);
        const r = await tx.query<{ updated_at: Date; current_proposal_id: string | null }>(
          "select updated_at, current_proposal_id from public.applications where id = $1",
          [app],
        );
        await actAs(tx, actor);
        return [
          app,
          to,
          iso(r.rows[0]!.updated_at),
          randomUUID(),
          null,
          to === "accepted" ? r.rows[0]!.current_proposal_id : null,
        ];
      };
      await tx.query(
        "select * from public.transition_application($1, $2, $3, $4, $5, $6)",
        await appStep(ADMIN_B, "shortlisted"),
      );
      await tx.query(
        "select * from public.transition_application($1, $2, $3, $4, $5, $6)",
        await appStep(ADMIN_B, "proposed"),
      );
      await tx.query(
        "select * from public.transition_application($1, $2, $3, $4, $5, $6)",
        await appStep(ECHO, "accepted"),
      );
      expect(
        await sqlstate(
          tx,
          "select * from public.transition_application($1, $2, $3, $4, $5, $6)",
          await appStep(ADMIN_B, "confirmed"),
        ),
      ).toBe("CFA17");
    });
  });

  it("finish: only after the last session (CFT09), with an outcome; nothing else changes (no certification, V19-034)", async () => {
    await asUser(db, DELTA, async (tx) => {
      const { courseId, editionId } = await published(tx, { capacity: 2 });
      const a = await accepted(tx, DELTA, courseId, editionId);
      await step(tx, ADMIN_A, a, "confirmed");
      expect(await stepError(tx, ADMIN_A, a, "finished", { outcome: "completed" })).toBe("CFT09");
      expect(await stepError(tx, ADMIN_A, a, "finished")).toBe("22023");
      // Owner moves the sessions into the past (no RPC allows past dates).
      await asOwner(tx);
      await tx.query("delete from public.training_sessions where edition_id = $1", [editionId]);
      await tx.query(
        "insert into public.training_sessions (edition_id, span) values ($1, tstzrange(now() - interval '2 days', now() - interval '1 day'))",
        [editionId],
      );
      const snapshot = async () =>
        (
          await tx.query(
            "select (select count(*) from public.technician_qualifications) q, (select count(*) from public.professional_documents) d, (select count(*) from public.application_packs) p, (select count(*) from public.logbook_entries) l, (select count(*) from public.technician_type_ratings) t, (select md5(string_agg(tq.id::text || tq.verification_status || coalesce(tq.expires_at::text, ''), ',' order by tq.id)) from public.technician_qualifications tq where tq.technician_profile_id = $1) h",
            [DELTA],
          )
        ).rows[0];
      const before = await snapshot();
      expect(await stepError(tx, DELTA, a, "finished", { outcome: "completed" })).toBe("42501");
      expect((await step(tx, ADMIN_A, a, "finished", { outcome: "attended" })).status).toBe(
        "finished",
      );
      await asOwner(tx);
      expect(await snapshot()).toEqual(before);
      expect(
        (
          await tx.query<{ outcome: string }>(
            "select outcome from public.training_requests where id = $1",
            [a],
          )
        ).rows[0]!.outcome,
      ).toBe("attended");
      expect(
        (
          await tx.query(
            "select 1 from public.audit_events where action = 'training.request_finished' and entity_id = $1",
            [a],
          )
        ).rows,
      ).toHaveLength(1);
      // A finished seat keeps its place (capacity counts it) and stays on the calendar as history.
      await actAs(tx, DELTA);
      const own = await tx.query<{ request: { status: string; outcome: string } }>(
        "select * from public.get_my_training_requests()",
      );
      expect([own.rows[0]!.request.status, own.rows[0]!.request.outcome]).toEqual([
        "finished",
        "attended",
      ]);
      // The export carries the request, its offer, history and messages.
      const exp = await tx.query<{
        e: {
          requests: { id: string; offers: unknown[]; messages: unknown[]; history: unknown[] }[];
          favorites: unknown[];
        };
      }>("select public.export_my_training() as e");
      expect(exp.rows[0]!.e.requests.map((r) => r.id)).toEqual([a]);
      expect(exp.rows[0]!.e.requests[0]!.offers).toHaveLength(1);
      expect(exp.rows[0]!.e.requests[0]!.history).toHaveLength(5); // received, offered, accepted, confirmed, finished
    });
  });

  it("closing the account is refused with a future confirmed seat (CFT12); allowed once cancelled", async () => {
    await asUser(db, DELTA, async (tx) => {
      const { courseId, editionId } = await published(tx, { capacity: 2 });
      const a = await accepted(tx, DELTA, courseId, editionId);
      await step(tx, ADMIN_A, a, "confirmed");
      await actAs(tx, DELTA);
      expect(await sqlstate(tx, "select * from public.close_my_account()")).toBe("CFT12");
      await step(tx, DELTA, a, "cancelled", { reason: "Cierro la cuenta" });
      await actAs(tx, DELTA);
      await tx.query("select * from public.close_my_account()");
      await asOwner(tx);
      expect(
        (await tx.query("select 1 from public.training_requests where id = $1", [a])).rows,
      ).toHaveLength(0); // N-3: cascade
      expect(
        (await tx.query("select 1 from public.profiles where id = $1", [DELTA])).rows,
      ).toHaveLength(0);
    });
  });

  it("notices of kind training are listed and counted by the existing RPCs, with the course title; employment kinds unchanged", async () => {
    await asUser(db, DELTA, async (tx) => {
      const { courseId, editionId } = await published(tx, { capacity: 2 });
      const a = await accepted(tx, DELTA, courseId, editionId);
      await step(tx, ADMIN_A, a, "confirmed");
      await actAs(tx, DELTA);
      const list = await tx.query<{
        kind: string;
        audience: string;
        training_subject: string;
        training_status: string;
        training_title: string;
        requirement_id: string | null;
        training_request_id: string;
      }>("select * from public.get_my_notifications()");
      expect(
        list.rows.map((r) => [
          r.kind,
          r.audience,
          r.training_subject,
          r.training_status,
          r.training_title,
          r.requirement_id,
          r.training_request_id,
        ]),
      ).toEqual([["training", "technician", "request", "confirmed", "Prueba Ñandú HF", null, a]]);
      expect(
        (await tx.query<{ c: number }>("select public.count_my_unread_notifications() as c"))
          .rows[0]!.c,
      ).toBe(1);
      expect(
        (await tx.query<{ m: number }>("select public.mark_notifications_read() as m")).rows[0]!.m,
      ).toBe(1);
      await actAs(tx, ADMIN_A);
      const prov = await tx.query<{
        audience: string;
        training_subject: string;
        training_status: string;
      }>(
        "select audience, training_subject, training_status from public.get_my_notifications() where kind = 'training'",
      );
      expect(prov.rows).toContainEqual({
        audience: "organization",
        training_subject: "request",
        training_status: "accepted",
      });
      expect(prov.rows).toContainEqual({
        audience: "organization",
        training_subject: "provider",
        training_status: "reviewed",
      });
      expect(prov.rows).toContainEqual({
        audience: "organization",
        training_subject: "course",
        training_status: "published",
      });
      // A member who stops being admin/manager loses the organization's training notices from the list.
      await asOwner(tx);
      await tx.query(
        "update public.organization_members set role = 'member' where organization_id = $1 and profile_id = $2",
        [orgA, MANAGER_A],
      );
      await actAs(tx, MANAGER_A);
      expect(
        (await tx.query("select 1 from public.get_my_notifications() where kind = 'training'"))
          .rows,
      ).toHaveLength(0);
    });
  });

  it("the seeded demo provider is on the catalog and the training admin reads its workspace", async () => {
    await asUser(db, TRAINING_ADMIN, async (tx) => {
      const ws = (
        await tx.query<{
          w: {
            provider: { status: string };
            courses: { status: string; editions: { mode: string }[] }[];
          };
        }>("select public.get_training_workspace($1) as w", [demoTraining])
      ).rows[0]!.w;
      expect(ws.provider.status).toBe("reviewed");
      expect(ws.courses.map((c) => c.status).sort()).toEqual([
        "draft",
        "published",
        "published",
        "published",
      ]);
      expect(ws.courses.flatMap((c) => c.editions.map((e) => e.mode)).sort()).toEqual([
        "live",
        "onsite",
        "selfpaced",
      ]);
      await actAs(tx, DELTA);
      const cat = await tx.query<{ course: { organizationId: string }; total: number }>(
        "select * from public.list_training_catalog()",
      );
      expect(cat.rows.filter((r) => r.course.organizationId === demoTraining)).toHaveLength(3);
      expect(cat.rows[0]!.total).toBe(3);
    });
  });
});
