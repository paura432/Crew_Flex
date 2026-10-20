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
import { execFileSync } from "node:child_process";
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

/**
 * Document wallet (D-10, migration 20261019160000, `professional-documents`). LOCAL ONLY, same guard
 * as above. Foxtrot uploads synthetic bytes built here (no real document); every document this
 * block creates is deleted again (row + object) in `finally`.
 */
describe.skipIf(!isLocalUrl(url) || !key)("local E2E: document wallet (D-10)", () => {
  const FN = "professional-documents";
  const BUCKET = "professional-documents";
  // Smallest well-formed PDF: header, one empty catalog, trailer.
  const PDF = new TextEncoder().encode(
    "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
  );
  let foxtrot = "";
  let golf = "";
  let orgAdmin = "";
  let foxtrotId = "";

  const subOf = (jwt: string) =>
    JSON.parse(Buffer.from(jwt.split(".")[1]!, "base64url").toString("utf8")).sub as string;

  async function upload(
    token: string,
    parts: {
      bytes: Uint8Array<ArrayBuffer>;
      name: string;
      type?: string;
      fields?: Record<string, string>;
    },
    idempotencyKey: string | null = randomUUID(),
  ): Promise<{ status: number; body: Envelope }> {
    const form = new FormData();
    form.append(
      "file",
      new Blob([parts.bytes], { type: parts.type ?? "application/pdf" }),
      parts.name,
    );
    for (const [k, v] of Object.entries(parts.fields ?? { kind: "license" })) form.append(k, v);
    const res = await fetch(new URL(`/functions/v1/${FN}`, url), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: key!,
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: form,
    });
    return { status: res.status, body: (await res.json()) as Envelope };
  }

  beforeAll(async () => {
    [foxtrot, golf, orgAdmin] = await Promise.all([
      signIn("foxtrot@crewflex.test"),
      signIn("golf@crewflex.test"),
      signIn("admin.mro@crewflex.test"),
    ]);
    foxtrotId = subOf(foxtrot);
  });

  it("upload → list → signed URL (same bytes) → owner-only → replay → rejections → delete", async () => {
    const created: string[] = [];
    try {
      const idempotencyKey = randomUUID();
      const fields = {
        kind: "license",
        title: "  E2E wallet\r\n../licence  ",
        expiresAt: "2031-12-31",
      };
      const first = await upload(
        foxtrot,
        { bytes: PDF, name: "licence.pdf", fields },
        idempotencyKey,
      );
      expect(first.status, JSON.stringify(first.body)).toBe(201);
      const doc = first.body.data!.document as Record<string, unknown>;
      created.push(doc.id as string);
      const sha256 = createHash("sha256").update(PDF).digest("hex");
      expect(doc).toMatchObject({
        kind: "license",
        title: "E2E wallet .. licence",
        mimeType: "application/pdf",
        sizeBytes: PDF.byteLength,
        sha256,
        expiresAt: "2031-12-31",
        qualificationId: null,
        scanStatus: "not_scanned",
      });
      expect(doc).not.toHaveProperty("storagePath");
      const path = `${foxtrotId}/${idempotencyKey}-${sha256.slice(0, 16)}`;

      // Replay (same key, same file and fields) → 200, same document; other title → 409.
      const replay = await upload(
        foxtrot,
        { bytes: PDF, name: "licence.pdf", fields },
        idempotencyKey,
      );
      expect(replay.status).toBe(200);
      expect((replay.body.data!.document as { id: string }).id).toBe(doc.id);
      const changed = await upload(
        foxtrot,
        { bytes: PDF, name: "licence.pdf", fields: { ...fields, title: "Other" } },
        idempotencyKey,
      );
      expect(changed.status).toBe(409);
      // Another file under the same key → 409, and its object was removed again (compensation).
      const otherBytes = new TextEncoder().encode("%PDF-1.4\n% other file\n%%EOF\n");
      const otherFile = await upload(
        foxtrot,
        { bytes: otherBytes, name: "x.pdf", fields },
        idempotencyKey,
      );
      expect(otherFile.status).toBe(409);
      const listed = await client(foxtrot).storage.from(BUCKET).list(foxtrotId);
      expect((listed.data ?? []).map((o) => o.name)).toEqual([path.split("/")[1]]);

      const list = await call(FN, { token: foxtrot });
      expect(list.status).toBe(200);
      expect((list.body.data!.documents as { id: string }[]).map((d) => d.id)).toContain(doc.id);

      // Signed URL: 60 s, returns exactly the uploaded bytes.
      const signed = await call(FN, { token: foxtrot, query: { id: doc.id as string, url: "1" } });
      expect(signed.status).toBe(200);
      expect(signed.body.data!.expiresInSeconds).toBe(60);
      const signedUrl = signed.body.data!.url as string;
      expect(new URL(signedUrl).origin).toBe(new URL(url!).origin);
      const fetched = await fetch(signedUrl);
      expect(fetched.status).toBe(200);
      expect(new Uint8Array(await fetched.arrayBuffer())).toEqual(PDF);

      // Another professional: 404 everywhere, and Storage itself refuses the object.
      for (const method of ["GET", "PATCH", "DELETE"] as const) {
        const res = await call(FN, {
          method,
          token: golf,
          query: method === "GET" ? { id: doc.id as string, url: "1" } : { id: doc.id as string },
          body:
            method === "PATCH"
              ? { kind: "other", title: "pwned", expiresAt: null, qualificationId: null }
              : undefined,
        });
        expect(res.status, method).toBe(404);
      }
      expect((await client(golf).storage.from(BUCKET).download(path)).error).toBeTruthy();
      expect(
        (await client(golf).storage.from(BUCKET).createSignedUrl(path, 60)).error,
      ).toBeTruthy();
      expect((await client(golf).from("professional_documents").select("id")).data).toEqual([]);
      // The bucket is not public: the public URL shape serves nothing.
      const publicUrl = new URL(`/storage/v1/object/public/${BUCKET}/${path}`, url);
      expect((await fetch(publicUrl)).ok).toBe(false);

      // PATCH: own metadata, title sanitised; strict schema.
      const patched = await call(FN, {
        method: "PATCH",
        token: foxtrot,
        query: { id: doc.id as string },
        body: { kind: "course", title: 'E2E "renamed"', expiresAt: null, qualificationId: null },
      });
      expect(patched.status).toBe(200);
      expect(patched.body.data!.document).toMatchObject({ kind: "course", title: "E2E renamed" });
      const forged = await call(FN, {
        method: "PATCH",
        token: foxtrot,
        query: { id: doc.id as string },
        body: {
          kind: "course",
          title: "x",
          expiresAt: null,
          qualificationId: null,
          scanStatus: "clean",
        },
      });
      expect(forged.status).toBe(400);

      // Rejections: a renamed executable, a text file called .pdf, > 5 MiB, no key, not a professional.
      const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      const renamed = await upload(foxtrot, { bytes: exe, name: "licence.pdf" });
      expect(renamed.status).toBe(400);
      expect(JSON.stringify(renamed.body.error)).toContain("v.document.file.type");
      const fake = await upload(foxtrot, {
        bytes: new TextEncoder().encode("this is not a pdf"),
        name: "licence.pdf",
      });
      expect(fake.status).toBe(400);
      const big = new Uint8Array(5 * 1024 * 1024 + 1);
      big.set(PDF);
      expect((await upload(foxtrot, { bytes: big, name: "big.pdf" })).status).toBe(413);
      expect((await upload(foxtrot, { bytes: PDF, name: "l.pdf" }, null)).status).toBe(400);
      expect((await upload(orgAdmin, { bytes: PDF, name: "l.pdf" })).status).toBe(403);
      // …nor straight through the Storage API (insert policy requires a technician profile).
      const orgId = subOf(orgAdmin);
      const direct = await client(orgAdmin)
        .storage.from(BUCKET)
        .upload(`${orgId}/${randomUUID()}-0123456789abcdef`, PDF, {
          contentType: "application/pdf",
        });
      expect(direct.error).toBeTruthy();

      // Delete: row and object gone; the old signed URL no longer serves the bytes.
      const deleted = await call(FN, {
        method: "DELETE",
        token: foxtrot,
        query: { id: doc.id as string },
      });
      expect(deleted.status).toBe(200);
      expect(deleted.body.data).toEqual({ deleted: true, id: doc.id });
      created.splice(created.indexOf(doc.id as string), 1);
      expect(
        (await call(FN, { token: foxtrot, query: { id: doc.id as string, url: "1" } })).status,
      ).toBe(404);
      expect((await client(foxtrot).storage.from(BUCKET).list(foxtrotId)).data ?? []).toEqual([]);
      expect((await fetch(signedUrl)).ok).toBe(false);
    } finally {
      for (const id of created) {
        await call(FN, { method: "DELETE", token: foxtrot, query: { id } });
      }
    }
  });
  /** Owner-side SQL on the LOCAL container only (scripts/local/db-owner-sql.sh re-checks the target). */
  const ownerSql = (sql: string) =>
    execFileSync("bash", ["scripts/local/db-owner-sql.sh"], {
      input: sql,
      encoding: "utf8",
    }).trim();
  const flagOn = () =>
    ownerSql(
      "insert into app_private.feature_flags (name, enabled) values ('document_wallet', true) on conflict (name) do update set enabled = true;",
    );
  const objectExists = (path: string) =>
    ownerSql(
      `select count(*) from storage.objects where bucket_id = '${BUCKET}' and name = '${path.replace(/[^0-9a-f/-]/g, "")}';`,
    ) === "1";
  const pathOf = (doc: { sha256: string }, key: string) =>
    `${foxtrotId}/${key}-${doc.sha256.slice(0, 16)}`;

  it("flag OFF (20261019160200): no new upload by function or Storage; list, open and delete keep working", async () => {
    const created: string[] = [];
    try {
      const first = await upload(foxtrot, {
        bytes: PDF,
        name: "flag.pdf",
        fields: { kind: "other", title: "E2E flag off" },
      });
      expect(first.status).toBe(201);
      const doc = first.body.data!.document as { id: string };
      created.push(doc.id);

      ownerSql("delete from app_private.feature_flags where name = 'document_wallet';");
      expect((await upload(foxtrot, { bytes: PDF, name: "again.pdf" })).status).toBe(404);
      const direct = await client(foxtrot)
        .storage.from(BUCKET)
        .upload(`${foxtrotId}/${randomUUID()}-0123456789abcdef`, PDF, {
          contentType: "application/pdf",
        });
      expect(direct.error).toBeTruthy();
      const rpc = await client(foxtrot).rpc("is_feature_enabled", { p_name: "document_wallet" });
      expect(rpc.data).toBe(false);

      const list = await call(FN, { token: foxtrot });
      expect((list.body.data!.documents as { id: string }[]).map((d) => d.id)).toContain(doc.id);
      const signed = await call(FN, { token: foxtrot, query: { id: doc.id, url: "1" } });
      expect(signed.status).toBe(200);
      expect(
        new Uint8Array(await (await fetch(signed.body.data!.url as string)).arrayBuffer()),
      ).toEqual(PDF);
      const deleted = await call(FN, { method: "DELETE", token: foxtrot, query: { id: doc.id } });
      expect(deleted.status).toBe(200);
      created.pop();
    } finally {
      flagOn();
      for (const id of created) await call(FN, { method: "DELETE", token: foxtrot, query: { id } });
    }
  });

  it("maintenance against real Storage: platform admin only; dry-run reports, apply purges tombstoned objects only", async () => {
    const platformAdmin = await signIn("platform.admin@crewflex.test");
    const maintenance = (token: string, query: Record<string, string> = {}) =>
      call("documents-maintenance", { method: "POST", token, query: { limit: "100", ...query } });
    const liveIds: string[] = [];
    let youngPath = "";
    try {
      // A: owner deletes the ROW directly (PostgREST) → tombstone owner_delete, object still there.
      const keyA = randomUUID();
      const a = await upload(
        foxtrot,
        {
          bytes: PDF,
          name: "a.pdf",
          fields: { kind: "other", title: "E2E purge A" },
        },
        keyA,
      );
      expect(a.status).toBe(201);
      const docA = a.body.data!.document as { id: string; sha256: string };
      const pathA = pathOf(docA, keyA);
      const removedRow = await client(foxtrot)
        .from("professional_documents")
        .delete()
        .eq("id", docA.id);
      expect(removedRow.error).toBeNull();
      expect(objectExists(pathA)).toBe(true);
      const tombA = ownerSql(
        `select id || '|' || reason from app_private.document_object_tombstones where storage_path = '${pathA}' and purged_at is null;`,
      );
      const [tombstoneA, reasonA] = tombA.split("|");
      expect(reasonA).toBe("owner_delete");

      // B: a live document — must never be purged.
      const keyB = randomUUID();
      const b = await upload(
        foxtrot,
        {
          bytes: new TextEncoder().encode("%PDF-1.4\n% live\n%%EOF\n"),
          name: "b.pdf",
          fields: { kind: "other", title: "E2E purge B" },
        },
        keyB,
      );
      expect(b.status).toBe(201);
      const docB = b.body.data!.document as { id: string; sha256: string };
      liveIds.push(docB.id);
      const pathB = pathOf(docB, keyB);

      // C: a fresh orphan (Storage upload, no row) — younger than the 24 h grace.
      youngPath = `${foxtrotId}/${randomUUID()}-0123456789abcdef`;
      const young = await client(foxtrot)
        .storage.from(BUCKET)
        .upload(youngPath, PDF, { contentType: "application/pdf" });
      expect(young.error).toBeNull();

      // Not a platform admin → 403 (professional and organization accounts).
      expect((await maintenance(foxtrot)).status).toBe(403);
      expect((await maintenance(orgAdmin, { apply: "1" })).status).toBe(403);

      const dry = await maintenance(platformAdmin);
      expect(dry.status, JSON.stringify(dry.body)).toBe(200);
      expect(dry.body.data!.mode).toBe("dry-run");
      expect((dry.body.data!.due as { tombstoneId: string }[]).map((d) => d.tombstoneId)).toContain(
        tombstoneA,
      );
      expect(JSON.stringify(dry.body)).not.toContain(foxtrotId); // ids and counts only, no paths
      expect(objectExists(pathA)).toBe(true); // dry-run wrote and deleted nothing

      const applied = await maintenance(platformAdmin, { apply: "1" });
      expect(applied.status, JSON.stringify(applied.body)).toBe(200);
      expect(applied.body.data!.purged as number).toBeGreaterThanOrEqual(1);
      expect(objectExists(pathA)).toBe(false);
      expect(
        ownerSql(
          `select purged_at is not null from app_private.document_object_tombstones where id = '${tombstoneA}';`,
        ),
      ).toBe("t");
      const { data: audit } = await client(platformAdmin)
        .from("audit_events")
        .select("metadata")
        .eq("action", "document.purged")
        .eq("entity_id", tombstoneA!);
      expect(audit).toEqual([
        {
          metadata: {
            technician_profile_id: foxtrotId,
            reason: "owner_delete",
            object_found: true,
          },
        },
      ]);
      expect(JSON.stringify(audit)).not.toContain(pathA);
      // The live document and the young orphan are untouched and unmarked.
      expect(objectExists(pathB)).toBe(true);
      expect(objectExists(youngPath)).toBe(true);
      expect(
        ownerSql(
          `select count(*) from app_private.document_object_tombstones where storage_path in ('${pathB}', '${youngPath}');`,
        ),
      ).toBe("0");
      // Idempotent: a second apply does not purge A again.
      const again = await maintenance(platformAdmin, { apply: "1" });
      expect(
        (again.body.data!.due as { tombstoneId: string }[]).map((d) => d.tombstoneId),
      ).not.toContain(tombstoneA);
    } finally {
      for (const id of liveIds) await call(FN, { method: "DELETE", token: foxtrot, query: { id } });
      if (youngPath) await client(foxtrot).storage.from(BUCKET).remove([youngPath]);
    }
  });

  it("close (V1.8 job.status, 20261020120000): 403 member · 404 other org · 200 manager, repeat 200; never reopened", async () => {
    const manager = await signIn("manager.mro@crewflex.test");
    const { data: mad } = await client(manager)
      .from("work_requirements")
      .select("organization_id")
      .eq("title", MAD)
      .single();
    const mroId = mad!.organization_id as string;
    const { data: types } = await client(manager)
      .from("qualification_types")
      .select("id")
      .eq("code", "B1.1")
      .single();
    const created = await call("work-requirements", {
      method: "POST",
      token: manager,
      headers: { "Idempotency-Key": randomUUID() },
      body: {
        organizationId: mroId,
        title: `E2E close ${randomUUID().slice(0, 8)}`,
        location: "Madrid (MAD)",
        startsAt: "2031-06-01T06:00:00.000Z",
        endsAt: "2031-06-02T18:00:00.000Z",
        shift: "day",
        headcount: 1,
        urgency: "planned",
        qualifications: [{ qualificationTypeId: types!.id, level: "hard" }],
      },
    });
    expect(created.status).toBe(201);
    const id = (created.body.data?.requirement as { id: string }).id;
    const close = (token: string) =>
      call("work-requirements", { method: "PATCH", token, body: { id, status: "closed" } });
    const [charlie, adminOther] = await Promise.all([
      signIn("charlie@crewflex.test"),
      signIn("admin.other@crewflex.test"),
    ]);
    expect((await close(charlie)).status).toBe(403);
    expect((await close(adminOther)).status).toBe(404);
    const reopen = await call("work-requirements", {
      method: "PATCH",
      token: manager,
      body: { id, status: "open" },
    });
    expect(reopen.status).toBe(400); // the API offers no other transition
    const first = await close(manager);
    const again = await close(manager);
    expect([first.status, again.status]).toEqual([200, 200]);
    expect((again.body.data?.requirement as { status: string }).status).toBe("closed");
    const direct = await client(manager)
      .from("work_requirements")
      .update({ status: "open" })
      .eq("id", id);
    expect(direct.error?.code).toBe("55000");
  });
});
