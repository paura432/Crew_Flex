// Package shell-visual (v2 diff 50 #13, T-146): «Red visible» = count_visible_network(), migration
// 20261024600000. Every case runs in a rolled-back transaction.
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, orgIdByName, SEED } from "./harness";
import {
  isExternallyMatchable,
  type OrganizationReviewStatus,
} from "../../src/domain/organization";
import type { ProfileVisibility } from "../../src/domain/professional";

let db: PGlite;
let mroId: string;

beforeAll(async () => {
  db = await createTestDatabase();
  mroId = await orgIdByName(db, "Demo MRO Madrid");
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

async function sqlState(tx: Transaction, sql: string, params: unknown[] = []) {
  await tx.exec("savepoint expected_error");
  try {
    await tx.query(sql, params);
  } catch (error) {
    await tx.exec("rollback to savepoint expected_error");
    return (error as { code?: string }).code;
  }
  throw new Error(`expected statement to fail: ${sql}`);
}

const COUNT = "select public.count_visible_network($1) as n";
const count = async (tx: Transaction, orgId: string) =>
  (await tx.query<{ n: number }>(COUNT, [orgId])).rows[0]!.n;

/** The same rule in TypeScript (BR-8 + blocks), over the rows as a superuser reads them. */
async function expected(tx: Transaction, orgId: string) {
  await tx.exec("reset role");
  const [{ rows: profiles }, { rows: org }, { rows: members }, { rows: blocks }] =
    await Promise.all([
      tx.query<{ profile_id: string; visibility: ProfileVisibility }>(
        "select profile_id, visibility from public.technician_profiles",
      ),
      tx.query<{ review_status: OrganizationReviewStatus }>(
        "select review_status from public.organizations where id = $1",
        [orgId],
      ),
      tx.query<{ profile_id: string }>(
        "select profile_id from public.organization_members where organization_id = $1",
        [orgId],
      ),
      tx.query<{ technician_profile_id: string }>(
        "select technician_profile_id from public.technician_organization_blocks where organization_id = $1",
        [orgId],
      ),
    ]);
  const excluded = new Set([
    ...members.map((m) => m.profile_id),
    ...blocks.map((b) => b.technician_profile_id),
  ]);
  return profiles.filter(
    (p) =>
      !excluded.has(p.profile_id) && isExternallyMatchable(p.visibility, org[0]!.review_status),
  ).length;
}

describe("count_visible_network («Red visible», T-146)", () => {
  it("admin and manager read the same count as the TypeScript visibility rule", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const want = await expected(tx, mroId);
      expect(want).toBeGreaterThan(0);
      await actAs(tx, SEED.adminMro);
      expect(await count(tx, mroId)).toBe(want);
      await actAs(tx, SEED.managerMro);
      expect(await count(tx, mroId)).toBe(want);
    });
  });

  it("follows privacy, blocks and the organization's review (verified_orgs)", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      const before = await count(tx, mroId);
      await tx.exec("reset role");
      // Delta (anonymous) goes private; Echo (open) blocks the organization.
      await tx.query(
        "update public.technician_profiles set visibility = 'private' where profile_id = $1",
        [SEED.delta],
      );
      await tx.query(
        "insert into public.technician_organization_blocks (technician_profile_id, organization_id) values ($1, $2)",
        [SEED.echo, mroId],
      );
      await actAs(tx, SEED.adminMro);
      expect(await count(tx, mroId)).toBe(before - 2);

      // Hotel (private) opens to verified organizations only: counted once the review is registered.
      await tx.exec("reset role");
      await tx.query(
        "update public.technician_profiles set visibility = 'verified_orgs' where profile_id = $1",
        [SEED.hotelPrivate],
      );
      await tx.query(
        "update public.organizations set review_status = 'pending', reviewed_at = null where id = $1",
        [mroId],
      );
      await actAs(tx, SEED.adminMro);
      const pending = await count(tx, mroId);
      await tx.exec("reset role");
      await tx.query(
        "update public.organizations set review_status = 'reviewed', reviewed_at = now() where id = $1",
        [mroId],
      );
      await actAs(tx, SEED.adminMro);
      expect(await count(tx, mroId)).toBe(pending + 1);
      expect(await count(tx, mroId)).toBe(await expected(tx, mroId));
    });
  });

  it("never counts the organization's own members, whatever their visibility", async () => {
    await asUser(db, SEED.adminMro, async (tx) => {
      await tx.exec("reset role");
      await tx.query(
        "update public.technician_profiles set visibility = 'open' where profile_id = $1",
        [SEED.alpha],
      );
      const want = await expected(tx, mroId);
      await actAs(tx, SEED.adminMro);
      expect(await count(tx, mroId)).toBe(want);
    });
  });

  it("refuses plain members, professionals, other organizations' admins and anon (42501)", async () => {
    for (const user of [SEED.charlieMember, SEED.delta, SEED.adminOther, SEED.platformAdmin]) {
      await asUser(db, user, async (tx) => {
        expect(await sqlState(tx, COUNT, [mroId]), user).toBe("42501");
      });
    }
    await asUser(db, null, async (tx) => {
      expect(await sqlState(tx, COUNT, [mroId])).toBe("42501");
    });
  });
});
