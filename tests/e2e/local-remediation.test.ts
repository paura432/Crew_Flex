/**
 * LOCAL-ONLY end-to-end checks for the 2026-10-15 remediation (E-3, I-1, I-3, candidate pool,
 * qualification review), through the real local stack: Supabase Auth → Edge Functions (`supabase
 * functions serve`) → PostgREST/PostgreSQL with RLS. Uses the deterministic synthetic seed accounts
 * of docs/qa/LOCAL_ENVIRONMENT.md §4 (local password, nobody real).
 *
 * Never runs against a remote project: the whole suite is skipped unless E2E_SUPABASE_URL is
 * http://127.0.0.1 or http://localhost (tests/e2e/guard.ts `isLocalUrl`). Every check restores
 * what it changed; requirements (no delete path) are created with an `E2E ` title and cancelled,
 * and `scripts/local/cleanup-test-rows.sh` removes them.
 * Run: `pnpm e2e:remote` with `.env.e2e` pointing at the local stack.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { isLocalUrl } from "./guard";

const url = process.env.E2E_SUPABASE_URL;
const key = process.env.E2E_SUPABASE_PUBLISHABLE_KEY;
const LOCAL_PASSWORD = "crewflex-local-only"; // synthetic local seed only (LOCAL_ENVIRONMENT.md §4)
const MAD = "B1.1 · A320 line maintenance reinforcement";
const GOLF = "00000000-0000-4000-8000-000000000024";

interface Envelope {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
  requestId: string;
}

const client = (token?: string) =>
  createClient(url!, key!, {
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    auth: { persistSession: false, autoRefreshToken: false },
  });

async function signIn(email: string): Promise<string> {
  const { data, error } = await client().auth.signInWithPassword({
    email,
    password: LOCAL_PASSWORD,
  });
  if (error || !data.session) throw new Error(`local sign-in failed: ${error?.message}`);
  return data.session.access_token;
}

async function call(
  fn: string,
  init: {
    method?: string;
    token?: string;
    query?: Record<string, string>;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<{ status: number; body: Envelope }> {
  const target = new URL(`/functions/v1/${fn}`, url);
  for (const [k, v] of Object.entries(init.query ?? {})) target.searchParams.set(k, v);
  const res = await fetch(target, {
    method: init.method ?? "GET",
    headers: {
      ...init.headers,
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      apikey: key!,
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return { status: res.status, body: (await res.json()) as Envelope };
}

describe.skipIf(!isLocalUrl(url) || !key)("local E2E: remediation 2026-10-15", () => {
  let manager = "";
  let foxtrot = "";
  let golf = "";
  let platformAdmin = "";
  let madId = "";
  let mroId = "";

  beforeAll(async () => {
    [manager, foxtrot, golf, platformAdmin] = await Promise.all([
      signIn("manager.mro@crewflex.test"),
      signIn("foxtrot@crewflex.test"), // not used by remote-smoke (which edits Delta in parallel)
      signIn("golf@crewflex.test"),
      signIn("platform.admin@crewflex.test"),
    ]);
    const { data } = await client(manager)
      .from("work_requirements")
      .select("id, organization_id")
      .eq("title", MAD)
      .single();
    madId = data!.id as string;
    mroId = data!.organization_id as string;
  });

  it("E-3: a manager cannot strip the hard qualifications through PostgREST directly", async () => {
    const db = client(manager);
    const { error } = await db
      .from("work_requirement_qualifications")
      .delete()
      .eq("work_requirement_id", madId)
      .eq("requirement_level", "hard");
    expect(error?.code).toBe("23514");
    const { count } = await db
      .from("work_requirement_qualifications")
      .select("*", { count: "exact", head: true })
      .eq("work_requirement_id", madId)
      .eq("requirement_level", "hard");
    expect(count).toBe(5);
    // …nor create an open requirement without qualifications.
    const created = await db.from("work_requirements").insert({
      organization_id: mroId,
      title: "E2E should fail · no qualifications",
      location: "MAD",
      starts_at: "2031-03-01T06:00:00Z",
      ends_at: "2031-03-02T06:00:00Z",
      headcount: 1,
      created_by: "00000000-0000-4000-8000-000000000014",
    });
    expect(created.error?.code).toBe("23514");
  });

  it("I-1: a replayed requirement POST returns the first result (201 → 200, same id); another payload is 409", async () => {
    const idempotencyKey = randomUUID();
    const { data: types } = await client(manager)
      .from("qualification_types")
      .select("id")
      .eq("code", "B1.1")
      .single();
    const body = {
      organizationId: mroId,
      title: `E2E remediation idempotency ${idempotencyKey.slice(0, 8)}`,
      location: "Madrid (MAD)",
      startsAt: "2031-04-01T06:00:00.000Z",
      endsAt: "2031-04-02T18:00:00.000Z",
      shift: "day",
      headcount: 1,
      urgency: "planned",
      qualifications: [{ qualificationTypeId: types!.id, level: "hard" }],
    };
    const headers = { "Idempotency-Key": idempotencyKey };
    const first = await call("work-requirements", {
      method: "POST",
      token: manager,
      body,
      headers,
    });
    const replay = await call("work-requirements", {
      method: "POST",
      token: manager,
      body,
      headers,
    });
    expect([first.status, replay.status]).toEqual([201, 200]);
    const id = (first.body.data?.requirement as { id: string }).id;
    expect((replay.body.data?.requirement as { id: string }).id).toBe(id);
    const other = await call("work-requirements", {
      method: "POST",
      token: manager,
      body: { ...body, headcount: 2 },
      headers,
    });
    expect([other.status, other.body.error?.code]).toEqual([409, "CONFLICT"]);
    const { count } = await client(manager)
      .from("work_requirements")
      .select("*", { count: "exact", head: true })
      .eq("title", body.title);
    expect(count).toBe(1);
    const malformed = await call("work-requirements", {
      method: "POST",
      token: manager,
      body,
      headers: { "Idempotency-Key": "retry-1" },
    });
    expect(malformed.status).toBe(400);
    await client(manager).from("work_requirements").update({ status: "cancelled" }).eq("id", id);
  });

  it("I-1: availability and declarations replay instead of duplicating / returning 409", async () => {
    const headers = { "Idempotency-Key": randomUUID() };
    const body = {
      startsAt: "2031-05-01T00:00:00.000Z",
      endsAt: "2031-05-02T00:00:00.000Z",
      status: "available",
    };
    const a = await call("professional-availability", {
      method: "POST",
      token: foxtrot,
      body,
      headers,
    });
    const b = await call("professional-availability", {
      method: "POST",
      token: foxtrot,
      body,
      headers,
    });
    expect([a.status, b.status]).toEqual([201, 200]);
    const windowId = (a.body.data?.window as { id: string }).id;
    expect((b.body.data?.window as { id: string }).id).toBe(windowId);
    await call("professional-availability", {
      method: "DELETE",
      token: foxtrot,
      query: { id: windowId },
    });

    const { data: type } = await client(foxtrot)
      .from("qualification_types")
      .select("id")
      .eq("code", "BORESCOPE")
      .single();
    const qHeaders = { "Idempotency-Key": randomUUID() };
    const qBody = { qualificationTypeId: type!.id, issuedAt: null, expiresAt: null };
    const d1 = await call("professional-qualifications", {
      method: "POST",
      token: foxtrot,
      body: qBody,
      headers: qHeaders,
    });
    const d2 = await call("professional-qualifications", {
      method: "POST",
      token: foxtrot,
      body: qBody,
      headers: qHeaders,
    });
    expect([d1.status, d2.status]).toEqual([201, 200]);
    const declared = d1.body.data?.qualification as { id: string; verificationStatus: string };
    expect(declared.verificationStatus).toBe("pending");
    expect((d2.body.data?.qualification as { id: string }).id).toBe(declared.id);
    await call("professional-qualifications", {
      method: "DELETE",
      token: foxtrot,
      query: { id: declared.id },
    });
  });

  it("I-3: a stale passport save is a 409 and writes nothing; a fresh one saves both tables", async () => {
    const current = await call("professional-profile", { token: foxtrot });
    const profile = current.body.data?.profile as Record<string, unknown> & { updatedAt: string };
    const { updatedAt, ...fields } = profile;
    const stale = await call("professional-profile", {
      method: "PATCH",
      token: foxtrot,
      body: {
        ...fields,
        displayName: "Stale write",
        expectedUpdatedAt: "2020-01-01T00:00:00.000Z",
      },
    });
    expect([stale.status, stale.body.error?.code]).toEqual([409, "CONFLICT"]);
    const unchanged = await call("professional-profile", { token: foxtrot });
    expect((unchanged.body.data?.profile as { displayName: string }).displayName).toBe(
      fields.displayName,
    );

    const fresh = await call("professional-profile", {
      method: "PATCH",
      token: foxtrot,
      body: {
        ...fields,
        displayName: "Foxtrot (E2E)",
        baseLocation: "Valencia (VLC)",
        expectedUpdatedAt: updatedAt,
      },
    });
    expect(fresh.status).toBe(200);
    const saved = fresh.body.data?.profile as {
      displayName: string;
      baseLocation: string;
      updatedAt: string;
    };
    expect([saved.displayName, saved.baseLocation]).toEqual(["Foxtrot (E2E)", "Valencia (VLC)"]);
    // Restore the seed values with the new version.
    const restored = await call("professional-profile", {
      method: "PATCH",
      token: foxtrot,
      body: { ...fields, expectedUpdatedAt: saved.updatedAt },
    });
    expect(restored.status).toBe(200);
  });

  it("candidate pool: matching reports how complete the external evaluation is", async () => {
    const { status, body } = await call("matching-evaluate", {
      method: "POST",
      token: manager,
      body: { requirementId: madId },
    });
    expect(status).toBe(200);
    const summary = body.data?.summary as {
      evaluated: number;
      eligible: number;
      pool: { prefiltered: number; hardEligible: number; cap: number };
    };
    expect(summary.pool.cap).toBe(100);
    expect(summary.pool.prefiltered).toBe(summary.evaluated); // seed: < 100, exhaustive
    expect(summary.pool.hardEligible).toBe(summary.eligible); // SQL preselection ≡ evaluateMatch
  });

  it("phase 6: only a platform admin verifies; the decision changes matching and is audited", async () => {
    const ref =
      "CF-" +
      createHash("sha256").update(`${madId}:${GOLF}`).digest("hex").slice(0, 10).toUpperCase();
    const golfEligible = async () => {
      const { body } = await call("matching-evaluate", {
        method: "POST",
        token: manager,
        body: { requirementId: madId },
      });
      const candidates = body.data?.candidates as {
        candidate: { id: string };
        match: { eligible: boolean };
      }[];
      return candidates.find((c) => c.candidate.id === ref)?.match.eligible;
    };
    expect(await golfEligible()).toBe(false); // B1.1 pending

    const queue = await call("qualification-reviews", { token: platformAdmin });
    expect(queue.status).toBe(200);
    const item = (
      queue.body.data?.pending as {
        id: string;
        updatedAt: string;
        type: { code: string };
        professional: { id: string };
      }[]
    ).find((p) => p.professional.id === GOLF && p.type.code === "B1.1");
    expect(item).toBeDefined();

    for (const token of [manager, golf, foxtrot]) {
      const denied = await call("qualification-reviews", {
        method: "POST",
        token,
        body: {
          qualificationId: item!.id,
          decision: "verified",
          expectedUpdatedAt: item!.updatedAt,
        },
      });
      expect(denied.status).toBe(403);
    }
    const rejectWithoutReason = await call("qualification-reviews", {
      method: "POST",
      token: platformAdmin,
      body: { qualificationId: item!.id, decision: "rejected", expectedUpdatedAt: item!.updatedAt },
    });
    expect(rejectWithoutReason.status).toBe(400);

    // M1: a decision about a version the reviewer did not see is refused and changes nothing.
    const stale = await call("qualification-reviews", {
      method: "POST",
      token: platformAdmin,
      body: {
        qualificationId: item!.id,
        decision: "verified",
        expectedUpdatedAt: "2020-01-01T00:00:00.000Z",
      },
    });
    expect([stale.status, stale.body.error?.code]).toEqual([409, "CONFLICT"]);
    expect(await golfEligible()).toBe(false);

    const verified = await call("qualification-reviews", {
      method: "POST",
      token: platformAdmin,
      body: {
        qualificationId: item!.id,
        decision: "verified",
        note: "E2E: checked against the register",
        expectedUpdatedAt: item!.updatedAt,
      },
    });
    expect(verified.status).toBe(200);
    expect(await golfEligible()).toBe(true);
    const again = await call("qualification-reviews", {
      method: "POST",
      token: platformAdmin,
      body: {
        qualificationId: item!.id,
        decision: "rejected",
        note: "late",
        expectedUpdatedAt: item!.updatedAt,
      },
    });
    expect(again.status).toBe(409);
    const history = await call("qualification-reviews", { token: platformAdmin });
    const recent = history.body.data?.recent as {
      qualificationId: string;
      decision: string;
      requestId: string | null;
    }[];
    expect(recent[0]).toMatchObject({ qualificationId: item!.id, decision: "verified" });
    expect(recent[0]?.requestId).toBe(verified.body.requestId);

    // Restore the seed: re-dating a reviewed qualification sends it back to pending (BR-2.8).
    const own = await call("professional-qualifications", { token: golf });
    const b11 = (
      own.body.data?.qualifications as {
        id: string;
        type: { code: string };
        issuedAt: string | null;
        expiresAt: string;
      }[]
    ).find((q) => q.type.code === "B1.1")!;
    await call("professional-qualifications", {
      method: "PATCH",
      token: golf,
      query: { id: b11.id },
      body: { issuedAt: b11.issuedAt, expiresAt: "2029-06-29", status: "active" },
    });
    const back = await call("professional-qualifications", {
      method: "PATCH",
      token: golf,
      query: { id: b11.id },
      body: { issuedAt: b11.issuedAt, expiresAt: b11.expiresAt, status: "active" },
    });
    expect(
      (back.body.data?.qualification as { verificationStatus: string }).verificationStatus,
    ).toBe("pending");
    expect(await golfEligible()).toBe(false);
  });

  it("availability PUT: whole days in one transaction, replayed by key, refused for past days and organizations", async () => {
    const days = [
      { date: "2031-02-01", status: "unavailable" },
      { date: "2031-02-02", status: "unavailable" },
      { date: "2031-02-03", status: "available" },
    ];
    const idem = randomUUID();
    const put = (token: string, body: unknown, k = idem) =>
      call("professional-availability", {
        method: "PUT",
        token,
        body,
        headers: { "Idempotency-Key": k },
      });
    const first = await put(foxtrot, { days });
    expect(first.status).toBe(200);
    expect(first.body.data?.replayed).toBe(false);
    const replay = await put(foxtrot, { days });
    expect(replay.body.data).toEqual({ changeId: first.body.data?.changeId, replayed: true });
    const db = client(foxtrot);
    const inFebruary = async () =>
      (
        await db
          .from("availability_windows")
          .select("starts_at, ends_at, status")
          .gte("starts_at", "2031-02-01")
          .lt("starts_at", "2031-03-01")
          .order("starts_at")
      ).data ?? [];
    expect((await inFebruary()).map((w) => w.status)).toEqual(["unavailable", "available"]);

    expect(
      (await put(foxtrot, { days: [{ date: "2020-01-01", status: "available" }] }, randomUUID()))
        .status,
    ).toBe(400);
    expect((await put(foxtrot, { days: [] }, randomUUID())).status).toBe(400);
    // An organization admin without a technician profile cannot write availability.
    expect(
      (await put(await signIn("admin.mro@crewflex.test"), { days }, randomUUID())).status,
    ).toBe(403);

    // Restore: clearing the same days removes what this check created.
    const cleared = await put(
      foxtrot,
      { days: days.map((d) => ({ date: d.date, status: null })) },
      randomUUID(),
    );
    expect(cleared.status).toBe(200);
    expect(await inFebruary()).toEqual([]);
  });
});
