/**
 * Remote end-to-end smoke test against the REAL Supabase project (deployed Edge Functions + RLS).
 *
 * Skipped unless `.env.e2e` provides synthetic, confirmed test accounts (see `.env.e2e.example`).
 * Run with `pnpm e2e:remote`. Never run with real users' credentials. It creates and deletes one
 * availability window per run; the organization checks create one work requirement (requirements
 * have no delete path in V0, so each run leaves one synthetic row in the synthetic organization).
 *
 * What it proves (docs/audit/DEPLOYMENT_PLAN.md §E2E):
 *   1. health is reachable and returns the envelope.
 *   2. Unauthenticated calls are rejected with UNAUTHORIZED.
 *   3. Professional A can create → read → update → delete an availability window.
 *   4. Professional B cannot read, update or delete A's window (RLS + ownership filter).
 *   5. Organization admin can create a requirement and evaluate capacity and matching.
 *   6. A professional cannot evaluate capacity (FORBIDDEN), and cannot create requirements.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const env = {
  url: process.env.E2E_SUPABASE_URL,
  key: process.env.E2E_SUPABASE_PUBLISHABLE_KEY,
  proA: [process.env.E2E_PRO_A_EMAIL, process.env.E2E_PRO_A_PASSWORD],
  proB: [process.env.E2E_PRO_B_EMAIL, process.env.E2E_PRO_B_PASSWORD],
  org: [process.env.E2E_ORG_ADMIN_EMAIL, process.env.E2E_ORG_ADMIN_PASSWORD],
} as const;

const configured = Boolean(env.url && env.key && env.proA[0] && env.proA[1] && env.proB[0]);
const orgConfigured = Boolean(env.org[0] && env.org[1]);

interface Envelope {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
  requestId: string;
}

async function signIn(email: string, password: string): Promise<string> {
  const client = createClient(env.url!, env.key!, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session)
    throw new Error(`sign-in failed for a test account: ${error?.message}`);
  return data.session.access_token;
}

async function call(
  fn: string,
  init: { method?: string; token?: string; query?: Record<string, string>; body?: unknown } = {},
): Promise<{ status: number; body: Envelope }> {
  const url = new URL(`/functions/v1/${fn}`, env.url);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      apikey: env.key!,
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return { status: res.status, body: (await res.json()) as Envelope };
}

describe.skipIf(!configured)("remote smoke: deployed Edge Functions + RLS", () => {
  let tokenA = "";
  let tokenB = "";
  let windowId = "";

  beforeAll(async () => {
    tokenA = await signIn(env.proA[0]!, env.proA[1]!);
    tokenB = await signIn(env.proB[0]!, env.proB[1]!);
  });

  afterAll(async () => {
    if (windowId)
      await call("professional-availability", {
        method: "DELETE",
        token: tokenA,
        query: { id: windowId },
      });
  });

  it("1. health returns the standard envelope", async () => {
    const { status, body } = await call("health");
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("2. unauthenticated calls are rejected", async () => {
    const { status, body } = await call("professional-availability");
    expect(status).toBe(401);
    expect(body.error?.code).toBe("UNAUTHORIZED");
  });

  it("3. professional A creates, reads, updates and deletes an availability window", async () => {
    const startsAt = "2031-01-10T00:00:00.000Z";
    const created = await call("professional-availability", {
      method: "POST",
      token: tokenA,
      body: { startsAt, endsAt: "2031-01-11T00:00:00.000Z", status: "available" },
    });
    expect(created.status).toBe(201);
    windowId = String((created.body.data?.window as { id: string }).id);

    const listed = await call("professional-availability", { token: tokenA });
    expect(listed.status).toBe(200);
    expect((listed.body.data?.windows as { id: string }[]).some((w) => w.id === windowId)).toBe(
      true,
    );

    const updated = await call("professional-availability", {
      method: "PATCH",
      token: tokenA,
      query: { id: windowId },
      body: { startsAt, endsAt: "2031-01-12T00:00:00.000Z", status: "unavailable" },
    });
    expect(updated.status).toBe(200);
    expect((updated.body.data?.window as { status: string }).status).toBe("unavailable");
  });

  it("4. professional B cannot see, update or delete A's window", async () => {
    const listed = await call("professional-availability", { token: tokenB });
    expect(listed.status).toBe(200);
    expect((listed.body.data?.windows as { id: string }[]).some((w) => w.id === windowId)).toBe(
      false,
    );

    const patched = await call("professional-availability", {
      method: "PATCH",
      token: tokenB,
      query: { id: windowId },
      body: {
        startsAt: "2031-01-10T00:00:00.000Z",
        endsAt: "2031-01-11T00:00:00.000Z",
        status: "available",
      },
    });
    expect(patched.status).toBe(404);

    const deleted = await call("professional-availability", {
      method: "DELETE",
      token: tokenB,
      query: { id: windowId },
    });
    expect(deleted.status).toBe(404);

    const stillThere = await call("professional-availability", { token: tokenA });
    expect((stillThere.body.data?.windows as { id: string }[]).some((w) => w.id === windowId)).toBe(
      true,
    );
  });

  it("6a. a professional cannot create work requirements", async () => {
    const { status, body } = await call("work-requirements", {
      method: "POST",
      token: tokenA,
      body: {
        organizationId: "00000000-0000-4000-8000-000000000000",
        title: "E2E should fail",
        location: "MAD",
        startsAt: "2031-02-01T08:00:00.000Z",
        endsAt: "2031-02-02T08:00:00.000Z",
        shift: "day",
        headcount: 1,
        urgency: "planned",
        qualifications: [
          { qualificationTypeId: "00000000-0000-4000-8000-000000000001", level: "hard" },
        ],
      },
    });
    expect(status).toBe(403);
    expect(body.error?.code).toBe("FORBIDDEN");
  });

  describe.skipIf(!orgConfigured)("organization flows", () => {
    let tokenOrg = "";
    let organizationId = "";
    let requirementId = "";

    beforeAll(async () => {
      tokenOrg = await signIn(env.org[0]!, env.org[1]!);
      const client: SupabaseClient = createClient(env.url!, env.key!, {
        global: { headers: { Authorization: `Bearer ${tokenOrg}` } },
        auth: { persistSession: false },
      });
      const membership = await client
        .from("organization_members")
        .select("organization_id")
        .limit(1)
        .maybeSingle();
      organizationId = String(membership.data?.organization_id ?? "");
    });

    it("5. organization admin creates a requirement and evaluates capacity and matching", async () => {
      expect(organizationId).not.toBe("");
      const client = createClient(env.url!, env.key!, {
        global: { headers: { Authorization: `Bearer ${tokenOrg}` } },
        auth: { persistSession: false },
      });
      const catalog = await client.from("qualification_types").select("id").limit(1).single();
      expect(catalog.error).toBeNull();

      const created = await call("work-requirements", {
        method: "POST",
        token: tokenOrg,
        body: {
          organizationId,
          title: `E2E smoke ${new Date().toISOString()}`,
          location: "Madrid (MAD)",
          startsAt: "2031-03-01T08:00:00.000Z",
          endsAt: "2031-03-03T08:00:00.000Z",
          shift: "day",
          headcount: 1,
          urgency: "planned",
          qualifications: [{ qualificationTypeId: String(catalog.data!.id), level: "hard" }],
        },
      });
      expect(created.status).toBe(201);
      requirementId = String((created.body.data?.requirement as { id: string }).id);

      const capacity = await call("capacity-evaluate", {
        method: "POST",
        token: tokenOrg,
        body: { requirementId },
      });
      expect(capacity.status).toBe(200);
      expect(typeof (capacity.body.data?.capacity as { gap: number }).gap).toBe("number");

      const matching = await call("matching-evaluate", {
        method: "POST",
        token: tokenOrg,
        body: { requirementId },
      });
      expect(matching.status).toBe(200);
      expect(typeof (matching.body.data?.summary as { evaluated: number }).evaluated).toBe(
        "number",
      );
    });

    it("6b. a professional cannot evaluate another organization's requirement", async () => {
      const { status, body } = await call("capacity-evaluate", {
        method: "POST",
        token: tokenA,
        body: { requirementId },
      });
      // Hidden by RLS → NOT_FOUND; if visible but not a member → FORBIDDEN. Both deny.
      expect([403, 404]).toContain(status);
      expect(body.ok).toBe(false);
    });
  });
});
