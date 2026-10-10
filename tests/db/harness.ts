import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";

const root = join(import.meta.dirname, "..", "..");
const migrationsDir = join(root, "supabase", "migrations");

/** Seed user ids (supabase/seed.sql). */
export const SEED = {
  adminMro: "00000000-0000-4000-8000-000000000001",
  adminOther: "00000000-0000-4000-8000-000000000002",
  alpha: "00000000-0000-4000-8000-000000000011",
  bravo: "00000000-0000-4000-8000-000000000012",
  charlieMember: "00000000-0000-4000-8000-000000000013",
  managerMro: "00000000-0000-4000-8000-000000000014",
  adminAirline: "00000000-0000-4000-8000-000000000003",
  lima: "00000000-0000-4000-8000-000000000042",
  delta: "00000000-0000-4000-8000-000000000021",
  echo: "00000000-0000-4000-8000-000000000022",
  hotelPrivate: "00000000-0000-4000-8000-000000000025",
  platformAdmin: "00000000-0000-4000-8000-000000000031",
} as const;

/** Fresh Postgres 17 (WASM) with the Supabase stub, all migrations and the local seed. */
export async function createTestDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(join(import.meta.dirname, "supabase-stub.sql"), "utf8"));
  for (const file of readdirSync(migrationsDir).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  await db.exec(readFileSync(join(root, "supabase", "seed.sql"), "utf8"));
  return db;
}

class Rollback extends Error {}

/**
 * Runs `fn` as the `authenticated` API role with `auth.uid() = userId` (or as `anon` when
 * userId is null), inside a transaction that is always rolled back.
 */
export async function asUser<T>(
  db: PGlite,
  userId: string | null,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  let result: T | undefined;
  try {
    await db.transaction(async (tx) => {
      const claims = userId ? JSON.stringify({ sub: userId, role: "authenticated" }) : "";
      await tx.query("select set_config('request.jwt.claims', $1, true)", [claims]);
      await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
      result = await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
  return result as T;
}

export async function orgIdByName(db: PGlite, name: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "select id from public.organizations where name = $1",
    [name],
  );
  if (!rows[0]) throw new Error(`organization not found: ${name}`);
  return rows[0].id;
}

export async function requirementIdByTitle(db: PGlite, title: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "select id from public.work_requirements where title = $1",
    [title],
  );
  if (!rows[0]) throw new Error(`requirement not found: ${title}`);
  return rows[0].id;
}

/**
 * Runs a statement expected to fail and returns the error message. Uses a savepoint so the
 * surrounding transaction stays usable for further assertions.
 */
export async function queryError(tx: Transaction, sql: string, params: unknown[] = []) {
  await tx.exec("savepoint expected_error");
  try {
    await tx.query(sql, params);
  } catch (error) {
    await tx.exec("rollback to savepoint expected_error");
    return (error as Error).message;
  }
  throw new Error(`expected statement to fail: ${sql}`);
}
