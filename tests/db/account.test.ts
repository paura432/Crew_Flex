// PKG account: sign-up by invitation (20261023400000) and account closure with retention (20261023400100).
import { createHash, randomUUID } from "node:crypto";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, orgIdByName, requirementIdByTitle, SEED } from "./harness";

const MAD = "B1.1 · A320 line maintenance reinforcement";
const LIS = "B2 · A330 avionics check support";
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

let db: PGlite;
let madId: string;
let lisId: string;
let madrid: string;
let lisbon: string;

beforeAll(async () => {
  db = await createTestDatabase();
  madId = await requirementIdByTitle(db, MAD);
  lisId = await requirementIdByTitle(db, LIS);
  madrid = await orgIdByName(db, "Demo MRO Madrid");
  lisbon = await orgIdByName(db, "Demo Aero Services Lisbon");
});

class Rollback extends Error {}

/** One transaction, always rolled back. Starts as the database owner (fixtures); `as` switches. */
async function scenario(fn: (tx: Transaction) => Promise<void>) {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

/** Act as an API role: `authenticated` with that `sub`, or `anon` for null. */
async function as(tx: Transaction, userId: string | null) {
  await tx.exec("reset role");
  const claims = userId ? JSON.stringify({ sub: userId, role: "authenticated" }) : "";
  await tx.query("select set_config('request.jwt.claims', $1, true)", [claims]);
  await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
}

/** Back to the owner, without a JWT (operator SQL, Auth's own connection). */
async function asOwner(tx: Transaction) {
  await tx.exec("reset role");
  await tx.query("select set_config('request.jwt.claims', '', true)");
}

/** The SQLSTATE of a statement expected to fail (savepoint keeps the transaction usable). */
async function sqlstate(tx: Transaction, sql: string, params: unknown[] = []) {
  await tx.exec("savepoint expected");
  try {
    await tx.query(sql, params);
  } catch (error) {
    await tx.exec("rollback to savepoint expected");
    return (error as { code?: string }).code ?? (error as Error).message;
  }
  throw new Error(`expected statement to fail: ${sql}`);
}

async function flagOn(tx: Transaction) {
  await tx.query(
    "insert into app_private.feature_flags (name, enabled) values ('invitation_signup', true) on conflict (name) do update set enabled = true",
  );
}

/** What GoTrue does on sign-up: inserts the auth user with the client's metadata. */
async function signUp(tx: Transaction, email: string, meta: Record<string, unknown>) {
  const id = randomUUID();
  await tx.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
    id,
    email,
    JSON.stringify(meta),
  ]);
  return id;
}

async function invite(tx: Transaction, email: string, type: "professional" | "organization") {
  await as(tx, SEED.platformAdmin);
  const { rows } = await tx.query<{ invitation_id: string; code: string; expires_at: string }>(
    "select * from public.create_invitation($1, $2, $3)",
    [email, type, randomUUID()],
  );
  await asOwner(tx);
  return rows[0]!;
}

async function status(tx: Transaction, code: string, email: string | null = null) {
  const { rows } = await tx.query<{ status: string; account_type: string | null }>(
    "select * from public.invitation_status($1, $2)",
    [code, email],
  );
  return rows[0]!;
}

describe("sign-up by invitation behind the owner flag (migration 20261023400000)", () => {
  it("flag off: open sign-up is unchanged, invitations are refused, the status says off", async () => {
    await scenario(async (tx) => {
      const id = await signUp(tx, "open.signup@crewflex.test", {
        account_type: "organization",
        display_name: "Open Org",
        organization_name: "Open Org Ltd",
      });
      const { rows } = await tx.query<{ account_type: string }>(
        "select account_type from public.profiles where id = $1",
        [id],
      );
      expect(rows).toEqual([{ account_type: "organization" }]);

      await as(tx, null);
      const { rows: required } = await tx.query<{ r: boolean }>(
        "select public.invitation_signup_required() as r",
      );
      expect(required[0]!.r).toBe(false);
      expect(await status(tx, "a".repeat(64))).toEqual({ status: "off", account_type: null });

      await as(tx, SEED.platformAdmin);
      expect(
        await sqlstate(
          tx,
          "select * from public.create_invitation('x@crewflex.test', 'professional')",
        ),
      ).toBe("0A000");
    });
  });

  it("only a platform admin invites; the code comes back once and only its hash is stored", async () => {
    await scenario(async (tx) => {
      await flagOn(tx);
      for (const who of [SEED.alpha, SEED.adminMro]) {
        await as(tx, who);
        expect(
          await sqlstate(
            tx,
            "select * from public.create_invitation('x@crewflex.test', 'professional')",
          ),
        ).toBe("42501");
      }
      await as(tx, null);
      expect(
        await sqlstate(
          tx,
          "select * from public.create_invitation('x@crewflex.test', 'professional')",
        ),
      ).toBe("42501"); // execute revoked from anon

      const inv = await invite(tx, "  New.Person@Example.TEST ", "organization");
      expect(inv.code).toMatch(/^[0-9a-f]{64}$/);
      const { rows } = await tx.query<{ email: string; code_hash: string; days: number }>(
        `select email, code_hash, round(extract(epoch from expires_at - created_at) / 86400)::int as days
         from public.account_invitations where id = $1`,
        [inv.invitation_id],
      );
      expect(rows[0]).toEqual({
        email: "new.person@example.test",
        code_hash: sha256(inv.code),
        days: 7,
      });

      const { rows: audit } = await tx.query<{ actor_profile_id: string; metadata: object }>(
        "select actor_profile_id, metadata from public.audit_events where action = 'invitation.created' and entity_id = $1",
        [inv.invitation_id],
      );
      expect(audit).toHaveLength(1);
      expect(audit[0]!.actor_profile_id).toBe(SEED.platformAdmin);
      expect(Object.keys(audit[0]!.metadata).sort()).toEqual([
        "account_type",
        "replaced",
        "request_id",
      ]);
      expect(JSON.stringify(audit[0]!.metadata)).not.toMatch(/example|@/i);
    });
  });

  it("RLS: platform admins read invitations without the hash; nobody writes them directly", async () => {
    await scenario(async (tx) => {
      await flagOn(tx);
      const inv = await invite(tx, "reader@crewflex.test", "professional");
      await as(tx, SEED.platformAdmin);
      const { rows } = await tx.query(
        "select id, email, account_type from public.account_invitations",
      );
      expect(rows).toHaveLength(1);
      expect(await sqlstate(tx, "select code_hash from public.account_invitations")).toBe("42501");
      expect(
        await sqlstate(
          tx,
          "update public.account_invitations set expires_at = now() + interval '1 year'",
        ),
      ).toBe("42501");
      expect(
        await sqlstate(tx, "delete from public.account_invitations where id = $1", [
          inv.invitation_id,
        ]),
      ).toBe("42501");
      expect(
        await sqlstate(
          tx,
          "insert into public.account_invitations (email, account_type, code_hash, expires_at) values ('a@b.c', 'professional', $1, now() + interval '1 day')",
          ["0".repeat(64)],
        ),
      ).toBe("42501");
      for (const who of [SEED.alpha, SEED.adminMro]) {
        await as(tx, who);
        const { rows: none } = await tx.query("select id from public.account_invitations");
        expect(none).toEqual([]);
      }
      await as(tx, null);
      expect(await sqlstate(tx, "select id from public.account_invitations")).toBe("42501");
    });
  });

  it("flag on: a valid code of that address is required, consumed once; the invitation decides the type", async () => {
    await scenario(async (tx) => {
      await flagOn(tx);
      const inv = await invite(tx, "invitee@crewflex.test", "organization");

      // No code / an unknown code / the code of another address: refused, nothing consumed.
      expect(
        await sqlstate(
          tx,
          "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'invitee@crewflex.test', '{}')",
          [randomUUID()],
        ),
      ).toBe("CFI01");
      expect(
        await sqlstate(
          tx,
          "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'invitee@crewflex.test', $2)",
          [randomUUID(), JSON.stringify({ invitation_code: "f".repeat(64) })],
        ),
      ).toBe("CFI01");
      expect(
        await sqlstate(
          tx,
          "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'someone.else@crewflex.test', $2)",
          [randomUUID(), JSON.stringify({ invitation_code: inv.code })],
        ),
      ).toBe("CFI01");
      expect(await status(tx, inv.code, "invitee@crewflex.test")).toEqual({
        status: "valid",
        account_type: "organization",
      });

      // The right address: the invitation's type wins over the metadata; platform_role never from it.
      const id = await signUp(tx, "invitee@crewflex.test", {
        account_type: "professional",
        platform_role: "platform_admin",
        display_name: "Invited Org Admin",
        organization_name: "Invited MRO",
        organization_type: "mro",
        country: "ES",
        invitation_code: inv.code,
      });
      const { rows: profile } = await tx.query(
        "select account_type, platform_role from public.profiles where id = $1",
        [id],
      );
      expect(profile).toEqual([{ account_type: "organization", platform_role: "user" }]);
      const { rows: org } = await tx.query(
        "select o.name, m.role from public.organization_members m join public.organizations o on o.id = m.organization_id where m.profile_id = $1",
        [id],
      );
      expect(org).toEqual([{ name: "Invited MRO", role: "admin" }]);
      const { rows: used } = await tx.query(
        "select consumed_by, consumed_at is not null as consumed from public.account_invitations where id = $1",
        [inv.invitation_id],
      );
      expect(used).toEqual([{ consumed_by: id, consumed: true }]);
      const { rows: meta } = await tx.query<{ m: Record<string, unknown> }>(
        "select raw_user_meta_data as m from auth.users where id = $1",
        [id],
      );
      expect(meta[0]!.m).not.toHaveProperty("invitation_code");

      // Single use.
      expect(await status(tx, inv.code, "invitee@crewflex.test")).toEqual({
        status: "invalid",
        account_type: null,
      });
    });
  });

  it("an expired or revoked invitation no longer signs anyone up", async () => {
    await scenario(async (tx) => {
      await flagOn(tx);
      const expired = await invite(tx, "late@crewflex.test", "professional");
      await tx.query(
        "update public.account_invitations set created_at = now() - interval '8 days', expires_at = now() - interval '1 day' where id = $1",
        [expired.invitation_id],
      );
      expect(await status(tx, expired.code)).toEqual({ status: "invalid", account_type: null });
      expect(
        await sqlstate(
          tx,
          "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'late@crewflex.test', $2)",
          [randomUUID(), JSON.stringify({ invitation_code: expired.code })],
        ),
      ).toBe("CFI01");

      // A new invitation for the address revokes the previous one (expired or not).
      const first = await invite(tx, "twice@crewflex.test", "professional");
      const second = await invite(tx, "twice@crewflex.test", "organization");
      expect(await status(tx, first.code)).toEqual({ status: "invalid", account_type: null });
      expect(await status(tx, second.code)).toEqual({
        status: "valid",
        account_type: "organization",
      });
      const { rows } = await tx.query<{ m: { replaced: number } }>(
        "select metadata as m from public.audit_events where action = 'invitation.created' and entity_id = $1",
        [second.invitation_id],
      );
      expect(rows[0]!.m.replaced).toBe(1);
    });
  });

  it("invitation_status answers anon with a status and a type only, never ids or the address", async () => {
    await scenario(async (tx) => {
      await flagOn(tx);
      const inv = await invite(tx, "status@crewflex.test", "professional");
      await as(tx, null);
      const { rows: required } = await tx.query<{ r: boolean }>(
        "select public.invitation_signup_required() as r",
      );
      expect(required[0]!.r).toBe(true);
      expect(await status(tx, "not-a-code")).toEqual({ status: "invalid", account_type: null });
      expect(await status(tx, "0".repeat(64))).toEqual({ status: "invalid", account_type: null });
      expect(await status(tx, inv.code)).toEqual({ status: "valid", account_type: "professional" });
      expect(await status(tx, inv.code, " STATUS@crewflex.test ")).toEqual({
        status: "valid",
        account_type: "professional",
      });
      expect(await status(tx, inv.code, "other@crewflex.test")).toEqual({
        status: "other_email",
        account_type: null,
      });
      const { fields } = await tx.query("select * from public.invitation_status($1)", [inv.code]);
      expect(fields.map((f) => f.name)).toEqual(["status", "account_type"]);
    });
  });

  it("an address that already has an account is not invited (23505)", async () => {
    await scenario(async (tx) => {
      await flagOn(tx);
      await as(tx, SEED.platformAdmin);
      expect(
        await sqlstate(
          tx,
          "select * from public.create_invitation('ALPHA@crewflex.test', 'professional')",
        ),
      ).toBe("23505");
      expect(
        await sqlstate(
          tx,
          "select * from public.create_invitation('not-an-email', 'professional')",
        ),
      ).toBe("22023");
    });
  });

  it("delivery account: no profile, removed right after the e-mail; never a real account", async () => {
    await scenario(async (tx) => {
      await flagOn(tx);
      const inv = await invite(tx, "carrier@crewflex.test", "professional");
      // What the `invitations` function asks Auth to create to send the e-mail.
      const carrier = await signUp(tx, "carrier@crewflex.test", {
        invitation_delivery: inv.invitation_id,
      });
      const { rows: profile } = await tx.query("select id from public.profiles where id = $1", [
        carrier,
      ]);
      expect(profile).toEqual([]);

      // The marker alone never skips the profile: another address or an unknown id → normal rules.
      expect(
        await sqlstate(
          tx,
          "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'mallory@crewflex.test', $2)",
          [randomUUID(), JSON.stringify({ invitation_delivery: inv.invitation_id })],
        ),
      ).toBe("CFI01");
      expect(
        await sqlstate(
          tx,
          "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'mallory@crewflex.test', $2)",
          [randomUUID(), JSON.stringify({ invitation_delivery: randomUUID() })],
        ),
      ).toBe("CFI01");

      await as(tx, SEED.alpha);
      expect(
        await sqlstate(tx, "select public.finish_invitation_delivery($1, true)", [
          inv.invitation_id,
        ]),
      ).toBe("42501");
      await as(tx, SEED.platformAdmin);
      const { rows: removed } = await tx.query<{ n: number }>(
        "select public.finish_invitation_delivery($1, true, $2) as n",
        [inv.invitation_id, randomUUID()],
      );
      expect(removed[0]!.n).toBe(1);
      await asOwner(tx);
      const { rows: gone } = await tx.query("select id from auth.users where id = $1", [carrier]);
      expect(gone).toEqual([]);
      expect(await status(tx, inv.code)).toEqual({ status: "valid", account_type: "professional" });
      const { rows: sent } = await tx.query<{ action: string; metadata: object }>(
        "select action, metadata from public.audit_events where entity_id = $1 and action like 'invitation.%' order by created_at, action",
        [inv.invitation_id],
      );
      expect(sent.map((r) => r.action).sort()).toEqual(["invitation.created", "invitation.sent"]);

      // The invitee then signs up with the code; a later finish never touches that real account.
      const real = await signUp(tx, "carrier@crewflex.test", { invitation_code: inv.code });
      await as(tx, SEED.platformAdmin);
      const { rows: none } = await tx.query<{ n: number }>(
        "select public.finish_invitation_delivery($1, true) as n",
        [inv.invitation_id],
      );
      expect(none[0]!.n).toBe(0);
      await asOwner(tx);
      const { rows: still } = await tx.query("select id from auth.users where id = $1", [real]);
      expect(still).toHaveLength(1);
    });
  });

  it("a failed delivery revokes the invitation (nobody received its code)", async () => {
    await scenario(async (tx) => {
      await flagOn(tx);
      const inv = await invite(tx, "bounce@crewflex.test", "professional");
      await as(tx, SEED.platformAdmin);
      await tx.query("select public.finish_invitation_delivery($1, false)", [inv.invitation_id]);
      await asOwner(tx);
      expect(await status(tx, inv.code)).toEqual({ status: "invalid", account_type: null });
      const { rows } = await tx.query<{ m: { reason: string } }>(
        "select metadata as m from public.audit_events where action = 'invitation.revoked' and entity_id = $1",
        [inv.invitation_id],
      );
      expect(rows[0]!.m.reason).toBe("delivery_failed");
    });
  });

  it("the delivery marker is refused outside a genuine delivery, flag off included (review M-1)", async () => {
    await scenario(async (tx) => {
      // Flag off: an anonymous sign-up that sets the marker would get the invitation e-mail branch.
      expect(
        await sqlstate(
          tx,
          "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'victim@crewflex.test', $2)",
          [randomUUID(), JSON.stringify({ invitation_delivery: "1" })],
        ),
      ).toBe("CFI01");
      // An open invitation from a flag-on period does not help once the flag is off.
      await flagOn(tx);
      const inv = await invite(tx, "victim@crewflex.test", "professional");
      await tx.query("delete from app_private.feature_flags where name = 'invitation_signup'");
      expect(
        await sqlstate(
          tx,
          "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'victim@crewflex.test', $2)",
          [randomUUID(), JSON.stringify({ invitation_delivery: inv.invitation_id })],
        ),
      ).toBe("CFI01");
    });
  });

  it("finish never deletes an account that has a profile, even if it later set the marker itself", async () => {
    await scenario(async (tx) => {
      await flagOn(tx);
      const inv = await invite(tx, "marked@crewflex.test", "professional");
      const real = await signUp(tx, "marked@crewflex.test", { invitation_code: inv.code });
      // GoTrue lets a user edit their own metadata (updateUser({ data })).
      await tx.query(
        "update auth.users set raw_user_meta_data = raw_user_meta_data || $2 where id = $1",
        [real, JSON.stringify({ invitation_delivery: inv.invitation_id })],
      );
      await as(tx, SEED.platformAdmin);
      const { rows } = await tx.query<{ n: number }>(
        "select public.finish_invitation_delivery($1, true) as n",
        [inv.invitation_id],
      );
      expect(rows[0]!.n).toBe(0);
      await asOwner(tx);
      expect(await count(tx, "select 1 from public.profiles where id = $1", [real])).toBe(1);
    });
  });

  it("unused invitations (revoked or expired) go 30 days later, at the next invitation (review M-2)", async () => {
    await scenario(async (tx) => {
      await flagOn(tx);
      const old = await invite(tx, "never.came@crewflex.test", "professional");
      const recent = await invite(tx, "maybe.later@crewflex.test", "professional");
      await tx.query(
        `update public.account_invitations
         set created_at = now() - interval '40 days', expires_at = now() - interval '33 days'
         where id = $1`,
        [old.invitation_id],
      );
      await invite(tx, "someone.new@crewflex.test", "organization");
      expect(
        await count(tx, "select 1 from public.account_invitations where id = $1", [
          old.invitation_id,
        ]),
      ).toBe(0);
      expect(
        await count(tx, "select 1 from public.account_invitations where id = $1", [
          recent.invitation_id,
        ]),
      ).toBe(1);
    });
  });
});

// --- Account closure -------------------------------------------------------------------------------

/** An application in `status` (owner fixture). Proposal rows for the states that need one. */
async function application(
  tx: Transaction,
  requirementId: string,
  technicianId: string,
  status: "received" | "shortlisted" | "proposed" | "accepted" | "confirmed" | "finished",
) {
  const { rows } = await tx.query<{ id: string }>(
    "insert into public.applications (requirement_id, technician_profile_id) values ($1, $2) returning id",
    [requirementId, technicianId],
  );
  const id = rows[0]!.id;
  await tx.query(
    "insert into public.application_events (application_id, seq, from_status, to_status, actor) values ($1, 1, null, 'received', 'technician')",
    [id],
  );
  if (status === "received") return id;
  let proposal: string | null = null;
  if (status !== "shortlisted") {
    const { rows: p } = await tx.query<{ id: string }>(
      "insert into public.application_proposals (application_id, version, terms) values ($1, 1, '{}') returning id",
      [id],
    );
    proposal = p[0]!.id;
  }
  const accepted = ["accepted", "confirmed", "finished"].includes(status) ? proposal : null;
  await tx.query(
    "update public.applications set status = $2, current_proposal_id = $3, accepted_proposal_id = $4 where id = $1",
    [id, status, proposal, accepted],
  );
  return id;
}

/** A document row with its Storage object (owner fixture). */
async function documentFor(tx: Transaction, ownerId: string) {
  const content = `%PDF-1.4 ${randomUUID()}`;
  const hash = sha256(content);
  const path = `${ownerId}/${randomUUID()}-${hash.slice(0, 16)}`;
  await tx.query(
    "insert into storage.objects (bucket_id, name, owner, metadata) values ('professional-documents', $1, $2, $3)",
    [path, ownerId, JSON.stringify({ size: content.length, mimetype: "application/pdf" })],
  );
  await tx.query(
    `insert into public.professional_documents (owner_id, kind, title, storage_path, mime_type, size_bytes, sha256)
     values ($1, 'license', 'Licence', $2, 'application/pdf', $3, $4)`,
    [ownerId, path, content.length, hash],
  );
  return path;
}

async function close(tx: Transaction, userId: string, requestId: string = randomUUID()) {
  await as(tx, userId);
  const { rows } = await tx.query<{ storage_path: string }>(
    "select * from public.close_my_account($1)",
    [requestId],
  );
  await asOwner(tx);
  return rows.map((r) => r.storage_path);
}

const count = async (tx: Transaction, sql: string, params: unknown[] = []) =>
  Number(
    (await tx.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params)).rows[0]!.n,
  );

describe("account closure: one transaction, commitments and audit stay without the profile (migration 20261023400100)", () => {
  it("anon cannot call it and no argument names the account: it is always the caller", async () => {
    await scenario(async (tx) => {
      await as(tx, null);
      expect(await sqlstate(tx, "select * from public.close_my_account()")).toBe("42501");
      await asOwner(tx);
      const { rows } = await tx.query<{ args: string }>(
        "select pg_get_function_identity_arguments('public.close_my_account(uuid)'::regprocedure) as args",
      );
      expect(rows[0]!.args).toBe("p_request_id uuid");
    });
  });

  it("refused while the technician has an accepted or confirmed application (CFA11); nothing changes", async () => {
    for (const blocking of ["accepted", "confirmed"] as const) {
      await scenario(async (tx) => {
        const app = await application(tx, lisId, SEED.delta, blocking);
        await documentFor(tx, SEED.delta);
        await as(tx, SEED.delta);
        expect(await sqlstate(tx, "select * from public.close_my_account()")).toBe("CFA11");
        await asOwner(tx);
        expect(await count(tx, "select 1 from public.profiles where id = $1", [SEED.delta])).toBe(
          1,
        );
        expect(
          await count(tx, "select 1 from public.professional_documents where owner_id = $1", [
            SEED.delta,
          ]),
        ).toBe(1);
        const { rows } = await tx.query("select status from public.applications where id = $1", [
          app,
        ]);
        expect(rows).toEqual([{ status: blocking }]);
      });
    }
  });

  it("a technician leaves: in-progress applications are withdrawn explicitly, history stays without them", async () => {
    await scenario(async (tx) => {
      const received = await application(tx, madId, SEED.delta, "received");
      const finished = await application(tx, lisId, SEED.delta, "finished");
      const path = await documentFor(tx, SEED.delta);
      await as(tx, SEED.adminMro);
      const poolBefore = await count(
        tx,
        "select * from public.get_requirement_candidate_pool($1)",
        [madId],
      );
      await asOwner(tx);
      // A full profile, closed under the owner's own JWT: qualifications (their audit trigger used to
      // break that cascade on the actor FK), windows, a rotation, applications and a document.
      await tx.query(
        "insert into public.availability_rotations (technician_profile_id, pattern, anchor) values ($1, '5x2', '2026-10-01')",
        [SEED.delta],
      );
      for (const table of ["technician_qualifications", "availability_windows"]) {
        expect(
          await count(tx, `select 1 from public.${table} where technician_profile_id = $1`, [
            SEED.delta,
          ]),
          table,
        ).toBeGreaterThan(0);
      }
      const requestId = randomUUID();

      expect(await close(tx, SEED.delta, requestId)).toEqual([path]);

      for (const sql of [
        "select 1 from auth.users where id = $1",
        "select 1 from public.profiles where id = $1",
        "select 1 from public.technician_profiles where profile_id = $1",
        "select 1 from public.technician_qualifications where technician_profile_id = $1",
        "select 1 from public.availability_windows where technician_profile_id = $1",
        "select 1 from public.availability_rotations where technician_profile_id = $1",
        "select 1 from public.professional_documents where owner_id = $1",
        "select 1 from public.audit_events where actor_profile_id = $1",
      ]) {
        expect(await count(tx, sql, [SEED.delta]), sql).toBe(0);
      }
      // Retained without the technician; the in-progress one withdrawn with an event and an audit row.
      const { rows: apps } = await tx.query(
        "select id, status, technician_profile_id from public.applications where id = any($1) order by status",
        [[received, finished]],
      );
      expect(apps).toEqual([
        { id: finished, status: "finished", technician_profile_id: null },
        { id: received, status: "withdrawn", technician_profile_id: null },
      ]);
      const { rows: events } = await tx.query(
        "select seq, from_status, to_status, actor from public.application_events where application_id = $1 order by seq",
        [received],
      );
      expect(events.at(-1)).toEqual({
        seq: 2,
        from_status: "received",
        to_status: "withdrawn",
        actor: "technician",
      });
      const { rows: withdrawn } = await tx.query<{
        actor_profile_id: string | null;
        organization_id: string | null;
        metadata: Record<string, unknown>;
      }>(
        "select actor_profile_id, organization_id, metadata from public.audit_events where action = 'application.withdrawn' and entity_id = $1",
        [received],
      );
      expect(withdrawn).toHaveLength(1);
      expect(withdrawn[0]).toMatchObject({ actor_profile_id: null, organization_id: null });
      expect(withdrawn[0]!.metadata).toMatchObject({ account_closed: true, request_id: requestId });

      // Files: the owner's own delete → due at once for documents-maintenance.
      const { rows: tomb } = await tx.query(
        "select reason, purge_after <= now() as due from app_private.document_object_tombstones where storage_path = $1",
        [path],
      );
      expect(tomb).toEqual([{ reason: "owner_delete", due: true }]);

      const { rows: closed } = await tx.query<{
        actor_profile_id: string | null;
        metadata: Record<string, unknown>;
      }>(
        "select actor_profile_id, metadata from public.audit_events where action = 'account.closed' and entity_id = $1",
        [SEED.delta],
      );
      expect(closed).toHaveLength(1);
      expect(closed[0]!.actor_profile_id).toBeNull();
      expect(closed[0]!.metadata).toEqual({
        account_type: "professional",
        self_service: true,
        request_id: requestId,
      });

      // Gone from matching.
      await as(tx, SEED.adminMro);
      expect(
        await count(tx, "select * from public.get_requirement_candidate_pool($1)", [madId]),
      ).toBe(poolBefore - 1);
    });
  });

  it("an organization whose last admin leaves closes its open requirements, audited; it and its history stay", async () => {
    await scenario(async (tx) => {
      await close(tx, SEED.adminOther);
      const { rows: req } = await tx.query(
        "select status, created_by from public.work_requirements where id = $1",
        [lisId],
      );
      expect(req).toEqual([{ status: "closed", created_by: null }]);
      const { rows: audit } = await tx.query<{ organization_id: string; metadata: object }>(
        "select organization_id, metadata from public.audit_events where action = 'requirement.status_changed' and entity_id = $1",
        [lisId],
      );
      expect(audit).toEqual([
        { organization_id: lisbon, metadata: { from: "open", to: "closed" } },
      ]);
      expect(await count(tx, "select 1 from public.organizations where id = $1", [lisbon])).toBe(1);
      expect(
        await count(tx, "select 1 from public.organization_members where organization_id = $1", [
          lisbon,
        ]),
      ).toBe(1); // Lima stays
    });
  });

  it("…and is refused while one of those requirements has an accepted or confirmed application", async () => {
    await scenario(async (tx) => {
      await application(tx, lisId, SEED.delta, "confirmed");
      await as(tx, SEED.adminOther);
      expect(await sqlstate(tx, "select * from public.close_my_account()")).toBe("CFA11");
      await asOwner(tx);
      const { rows } = await tx.query("select status from public.work_requirements where id = $1", [
        lisId,
      ]);
      expect(rows).toEqual([{ status: "open" }]);
    });
  });

  it("an organization that keeps another admin keeps its requirements; created_by is cleared", async () => {
    await scenario(async (tx) => {
      await tx.query(
        "update public.organization_members set role = 'admin' where organization_id = $1 and profile_id = $2",
        [madrid, SEED.managerMro],
      );
      await close(tx, SEED.adminMro);
      const { rows } = await tx.query(
        "select status, created_by from public.work_requirements where id = $1",
        [madId],
      );
      expect(rows).toEqual([{ status: "open", created_by: null }]);
    });
  });

  it("the same rules hold when an operator deletes the Auth user directly", async () => {
    await scenario(async (tx) => {
      const received = await application(tx, madId, SEED.echo, "shortlisted");
      await tx.query("delete from auth.users where id = $1", [SEED.echo]);
      const { rows } = await tx.query(
        "select status, technician_profile_id from public.applications where id = $1",
        [received],
      );
      expect(rows).toEqual([{ status: "withdrawn", technician_profile_id: null }]);
      const { rows: closed } = await tx.query<{ metadata: object }>(
        "select metadata from public.audit_events where action = 'account.closed' and entity_id = $1",
        [SEED.echo],
      );
      expect(closed).toEqual([
        { metadata: { account_type: "professional", self_service: false, request_id: null } },
      ]);
    });
    await scenario(async (tx) => {
      await application(tx, madId, SEED.delta, "accepted");
      expect(await sqlstate(tx, "delete from auth.users where id = $1", [SEED.delta])).toBe(
        "CFA11",
      );
    });
  });

  it("deleting a technician profile alone never orphans an application in progress", async () => {
    await scenario(async (tx) => {
      await application(tx, madId, SEED.delta, "proposed");
      expect(
        await sqlstate(tx, "delete from public.technician_profiles where profile_id = $1", [
          SEED.delta,
        ]),
      ).toBe("55000");
    });
  });

  it("every invitation of the address (they hold it) leaves with the account", async () => {
    await scenario(async (tx) => {
      await flagOn(tx);
      const first = await invite(tx, "short.stay@crewflex.test", "professional"); // revoked below
      const inv = await invite(tx, "short.stay@crewflex.test", "professional");
      const id = await signUp(tx, "short.stay@crewflex.test", { invitation_code: inv.code });
      await close(tx, id);
      expect(
        await count(tx, "select 1 from public.account_invitations where email = $1", [
          "short.stay@crewflex.test",
        ]),
      ).toBe(0);
      expect(first.invitation_id).not.toBe(inv.invitation_id);
      const { rows } = await tx.query(
        "select 1 from public.audit_events where action = 'invitation.created' and entity_id = $1",
        [inv.invitation_id],
      );
      expect(rows).toHaveLength(1); // the audit row stays (no address in it)
    });
  });

  it("the caller's JWT claims are back once the closure returns (cleared only for the cascade)", async () => {
    await scenario(async (tx) => {
      await as(tx, SEED.delta);
      await tx.query("select * from public.close_my_account()");
      const { rows } = await tx.query<{ sub: string | null; closing: string | null }>(
        "select auth.uid()::text as sub, nullif(current_setting('crewflex.account_closure', true), '') as closing",
      );
      expect(rows).toEqual([{ sub: SEED.delta, closing: null }]);
    });
  });

  it("two last-admin checks serialise on the organization row (lock taken before the question)", async () => {
    await scenario(async (tx) => {
      // PGlite has one connection: this proves the lock statement runs and the rule still holds when
      // another admin exists; real concurrency is for scripts/local/db-race-check.sh.
      await tx.query(
        "update public.organization_members set role = 'admin' where organization_id = $1 and profile_id = $2",
        [lisbon, SEED.lima],
      );
      await close(tx, SEED.adminOther);
      await close(tx, SEED.lima);
      const { rows } = await tx.query("select status from public.work_requirements where id = $1", [
        lisId,
      ]);
      expect(rows).toEqual([{ status: "closed" }]); // the second one was the last admin
    });
  });
});
