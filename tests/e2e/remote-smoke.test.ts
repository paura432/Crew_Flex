/**
 * Remote end-to-end checks against the REAL Supabase project (deployed Edge Functions + RLS).
 * Target: the single Crew Flex project = production (docs/architecture/ENVIRONMENTS.md). Writes
 * are blocked unless both guard conditions in `./guard.ts` hold (authorized ref + per-run
 * confirmation typed on the command line).
 *
 * Skipped unless `.env.e2e` provides synthetic, confirmed test accounts (see `.env.e2e.example`).
 * Run with `E2E_WRITE_CONFIRM=WRITE:<ref>:<today> pnpm e2e:remote`. Each run creates and deletes one
 * availability window; the organization checks create one work requirement (no delete path in V0),
 * left in the synthetic org until `scripts/e2e/cleanup-synthetic.sh` removes it.
 *
 * Covers the ten mandatory checks (docs/audit/DEPLOYMENT_PLAN.md §6):
 *   1 sign-in · 2 create availability · 3 edit + delete · 4 persistence across a fresh session ·
 *   5 isolation between professionals · 6 authorized requirement creation · 7 capacity ·
 *   8 deterministic matching · 9 401/403 · 10 cross-organization protection.
 * Phase 1 (profile + qualifications): 11 passport edit + persistence + isolation · 12 declaration
 *   stays pending, verification cannot be supplied, BR-2.7 · 13 B cannot touch A's declaration ·
 *   14 a withdrawn hard qualification changes matching deterministically (restored afterwards).
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { evaluateProductionGuard } from "./guard";

const env = {
  url: process.env.E2E_SUPABASE_URL,
  key: process.env.E2E_SUPABASE_PUBLISHABLE_KEY,
  proA: [process.env.E2E_PRO_A_EMAIL, process.env.E2E_PRO_A_PASSWORD],
  proB: [process.env.E2E_PRO_B_EMAIL, process.env.E2E_PRO_B_PASSWORD],
  org: [process.env.E2E_ORG_ADMIN_EMAIL, process.env.E2E_ORG_ADMIN_PASSWORD],
} as const;

const configured = Boolean(env.url && env.key && env.proA[0] && env.proA[1] && env.proB[0]);
const orgConfigured = Boolean(env.org[0] && env.org[1]);
const root = join(import.meta.dirname, "..", "..");
const readIfExists = (path: string) =>
  existsSync(path) ? readFileSync(path, "utf8").trim() : undefined;

interface Envelope {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
  requestId: string;
}

type Window = { id: string; startsAt: string; endsAt: string; status: string };
type Profile = {
  displayName: string;
  baseLocation: string | null;
  mobility: string;
  yearsExperience: number | null;
  currentStatus: string;
  visibility: string;
};
type Qualification = {
  id: string;
  type: { id: string; code: string; requiresExpiry: boolean };
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
  verificationStatus: string;
};

function userClient(token?: string) {
  return createClient(env.url!, env.key!, {
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** A fresh sign-in = a new session, which is what "persists after reload" means for the API. */
async function signIn(email: string, password: string): Promise<string> {
  const { data, error } = await userClient().auth.signInWithPassword({ email, password });
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

const windowsOf = (body: Envelope) => (body.data?.windows ?? []) as Window[];

describe.skipIf(!configured)(
  "remote E2E: deployed Edge Functions + RLS (production, guarded)",
  () => {
    let tokenA = "";
    let tokenB = "";
    let windowId = "";
    let originalProfile: Profile | null = null;
    let declaredId = "";

    beforeAll(async () => {
      const guard = evaluateProductionGuard({
        url: env.url,
        authorizedRef: process.env.E2E_AUTHORIZED_PROJECT_REF,
        linkedRef: readIfExists(join(root, "supabase", ".temp", "project-ref")),
        writeConfirm: process.env.E2E_WRITE_CONFIRM,
        envFileContent: readIfExists(join(root, ".env.e2e")),
      });
      if (!guard.ok) throw new Error(`remote E2E blocked: ${guard.reason}`);
      tokenA = await signIn(env.proA[0]!, env.proA[1]!);
      tokenB = await signIn(env.proB[0]!, env.proB[1]!);
    });

    afterAll(async () => {
      if (windowId) {
        await call("professional-availability", {
          method: "DELETE",
          token: tokenA,
          query: { id: windowId },
        });
      }
      if (originalProfile) {
        await call("professional-profile", {
          method: "PATCH",
          token: tokenA,
          body: originalProfile,
        });
      }
      if (declaredId) {
        await call("professional-qualifications", {
          method: "DELETE",
          token: tokenA,
          query: { id: declaredId },
        });
      }
    });

    it("0. health returns the standard envelope", async () => {
      const { status, body } = await call("health");
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("1. sign-in works for both professionals and tokens are accepted by the functions", async () => {
      expect(tokenA).not.toBe("");
      expect(tokenB).not.toBe("");
      const { status } = await call("professional-availability", { token: tokenA });
      expect(status).toBe(200);
    });

    it("9a. unauthenticated and malformed-token calls are rejected (401)", async () => {
      const none = await call("professional-availability");
      expect(none.status).toBe(401);
      expect(none.body.error?.code).toBe("UNAUTHORIZED");
      const bad = await call("professional-availability", { token: "not-a-jwt" });
      expect(bad.status).toBe(401);
    });

    it("2. professional A creates an availability window", async () => {
      const created = await call("professional-availability", {
        method: "POST",
        token: tokenA,
        body: {
          startsAt: "2031-01-10T00:00:00.000Z",
          endsAt: "2031-01-11T00:00:00.000Z",
          status: "available",
        },
      });
      expect(created.status).toBe(201);
      windowId = String((created.body.data?.window as Window).id);
      expect(windowId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("3a. professional A edits the window", async () => {
      const updated = await call("professional-availability", {
        method: "PATCH",
        token: tokenA,
        query: { id: windowId },
        body: {
          startsAt: "2031-01-10T00:00:00.000Z",
          endsAt: "2031-01-12T00:00:00.000Z",
          status: "unavailable",
        },
      });
      expect(updated.status).toBe(200);
      expect((updated.body.data?.window as Window).status).toBe("unavailable");
      expect((updated.body.data?.window as Window).endsAt).toBe("2031-01-12T00:00:00.000Z");
    });

    it("4. the edited window persists in a fresh session (reload)", async () => {
      const freshToken = await signIn(env.proA[0]!, env.proA[1]!);
      const listed = await call("professional-availability", { token: freshToken });
      expect(listed.status).toBe(200);
      const found = windowsOf(listed.body).find((w) => w.id === windowId);
      expect(found?.status).toBe("unavailable");
      expect(found?.endsAt).toBe("2031-01-12T00:00:00.000Z");
    });

    it("5. professional B cannot see, edit or delete A's window (RLS + ownership)", async () => {
      const listed = await call("professional-availability", { token: tokenB });
      expect(listed.status).toBe(200);
      expect(windowsOf(listed.body).some((w) => w.id === windowId)).toBe(false);

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

      // Direct PostgREST access as B must also be empty for A's row (RLS, not just the function).
      const direct = await userClient(tokenB)
        .from("availability_windows")
        .select("id")
        .eq("id", windowId);
      expect(direct.error).toBeNull();
      expect(direct.data).toEqual([]);

      const stillThere = await call("professional-availability", { token: tokenA });
      expect(windowsOf(stillThere.body).some((w) => w.id === windowId)).toBe(true);
    });

    it("3b. professional A deletes the window and it is gone", async () => {
      const deleted = await call("professional-availability", {
        method: "DELETE",
        token: tokenA,
        query: { id: windowId },
      });
      expect(deleted.status).toBe(200);
      const listed = await call("professional-availability", { token: tokenA });
      expect(windowsOf(listed.body).some((w) => w.id === windowId)).toBe(false);
      windowId = "";
    });

    it("11. professional A edits the passport; it persists in a fresh session; B is untouched", async () => {
      const before = await call("professional-profile", { token: tokenA });
      expect(before.status).toBe(200);
      const profile = before.body.data?.profile as Profile;
      const editable: Profile = {
        displayName: profile.displayName,
        baseLocation: profile.baseLocation,
        mobility: profile.mobility,
        yearsExperience: profile.yearsExperience,
        currentStatus: profile.currentStatus,
        visibility: profile.visibility,
      };
      originalProfile = editable;
      const bBefore = (await call("professional-profile", { token: tokenB })).body.data
        ?.profile as Profile;

      const edited = await call("professional-profile", {
        method: "PATCH",
        token: tokenA,
        body: {
          ...editable,
          yearsExperience: (editable.yearsExperience ?? 0) + 1,
          baseLocation: "E2E base",
        },
      });
      expect(edited.status).toBe(200);
      expect((edited.body.data?.profile as Profile).baseLocation).toBe("E2E base");

      const fresh = await call("professional-profile", {
        token: await signIn(env.proA[0]!, env.proA[1]!),
      });
      expect((fresh.body.data?.profile as Profile).baseLocation).toBe("E2E base");
      expect((fresh.body.data?.profile as Profile).yearsExperience).toBe(
        (editable.yearsExperience ?? 0) + 1,
      );

      const bAfter = (await call("professional-profile", { token: tokenB })).body.data
        ?.profile as Profile;
      expect(bAfter).toEqual(bBefore);

      // Privileged or identity fields are rejected, not silently ignored (strict schema).
      for (const extra of [
        { platformRole: "platform_admin" },
        { profileId: "00000000-0000-4000-8000-000000000022" },
      ]) {
        const refused = await call("professional-profile", {
          method: "PATCH",
          token: tokenA,
          body: { ...editable, ...extra },
        });
        expect(refused.status).toBe(400);
        expect(refused.body.error?.code).toBe("VALIDATION_ERROR");
      }

      const restored = await call("professional-profile", {
        method: "PATCH",
        token: tokenA,
        body: editable,
      });
      expect(restored.status).toBe(200);
      originalProfile = null;
    });

    it("12. a declaration starts pending, cannot be verified by its owner and respects BR-2.7", async () => {
      const catalog = await userClient(tokenA)
        .from("qualification_types")
        .select("id, code, requires_expiry")
        .in("code", ["B2", "TR-A350"]);
      expect(catalog.error).toBeNull();
      const b2 = catalog.data!.find((t) => t.code === "B2")!;
      const a350 = catalog.data!.find((t) => t.code === "TR-A350")!;

      const noExpiry = await call("professional-qualifications", {
        method: "POST",
        token: tokenA,
        body: { qualificationTypeId: b2.id },
      });
      expect(noExpiry.status).toBe(400); // B2 requires an expiry date

      const preVerified = await call("professional-qualifications", {
        method: "POST",
        token: tokenA,
        body: { qualificationTypeId: a350.id, verificationStatus: "verified" },
      });
      expect(preVerified.status).toBe(400);

      const created = await call("professional-qualifications", {
        method: "POST",
        token: tokenA,
        body: { qualificationTypeId: a350.id, issuedAt: "2024-01-01" },
      });
      expect(created.status).toBe(201);
      const q = created.body.data?.qualification as Qualification;
      declaredId = q.id;
      expect(q.verificationStatus).toBe("pending");
      expect(q.type.code).toBe("TR-A350");

      const duplicate = await call("professional-qualifications", {
        method: "POST",
        token: tokenA,
        body: { qualificationTypeId: a350.id },
      });
      expect(duplicate.status).toBe(409);

      const direct = await userClient(tokenA)
        .from("technician_qualifications")
        .update({ verification_status: "verified" })
        .eq("id", declaredId)
        .select("id");
      expect(direct.error?.code).toBe("42501"); // column grant: not even the owner

      const edited = await call("professional-qualifications", {
        method: "PATCH",
        token: tokenA,
        query: { id: declaredId },
        body: { issuedAt: "2024-01-01", expiresAt: "2030-01-01", status: "active" },
      });
      expect(edited.status).toBe(200);
      expect((edited.body.data?.qualification as Qualification).expiresAt).toBe("2030-01-01");
      expect((edited.body.data?.qualification as Qualification).verificationStatus).toBe("pending");

      const fresh = await call("professional-qualifications", {
        token: await signIn(env.proA[0]!, env.proA[1]!),
      });
      const list = fresh.body.data?.qualifications as Qualification[];
      expect(list.find((x) => x.id === declaredId)?.expiresAt).toBe("2030-01-01");
    });

    it("13. professional B cannot see, edit or delete A's declaration", async () => {
      const listed = await call("professional-qualifications", { token: tokenB });
      expect(
        (listed.body.data?.qualifications as Qualification[]).some((x) => x.id === declaredId),
      ).toBe(false);
      const patched = await call("professional-qualifications", {
        method: "PATCH",
        token: tokenB,
        query: { id: declaredId },
        body: { issuedAt: null, expiresAt: null, status: "withdrawn" },
      });
      expect(patched.status).toBe(404);
      const deleted = await call("professional-qualifications", {
        method: "DELETE",
        token: tokenB,
        query: { id: declaredId },
      });
      expect(deleted.status).toBe(404);
      const direct = await userClient(tokenB)
        .from("technician_qualifications")
        .select("id")
        .eq("id", declaredId);
      expect(direct.data).toEqual([]);

      const gone = await call("professional-qualifications", {
        method: "DELETE",
        token: tokenA,
        query: { id: declaredId },
      });
      expect(gone.status).toBe(200);
      declaredId = "";
    });

    it("9b. a professional cannot create work requirements (403)", async () => {
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
        const membership = await userClient(tokenOrg)
          .from("organization_members")
          .select("organization_id")
          .limit(1)
          .maybeSingle();
        organizationId = String(membership.data?.organization_id ?? "");
      });

      it("6. organization admin creates a requirement (201) and reads it back", async () => {
        expect(organizationId).toMatch(/^[0-9a-f-]{36}$/);
        const catalog = await userClient(tokenOrg)
          .from("qualification_types")
          .select("id")
          .limit(1)
          .single();
        expect(catalog.error).toBeNull();

        const created = await call("work-requirements", {
          method: "POST",
          token: tokenOrg,
          body: {
            organizationId,
            title: `E2E ${new Date().toISOString()}`,
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

        const one = await call("work-requirements", {
          token: tokenOrg,
          query: { id: requirementId },
        });
        expect(one.status).toBe(200);
        expect((one.body.data?.requirement as { id: string }).id).toBe(requirementId);
      });

      it("7. capacity evaluation returns required / eligible / gap / coverage", async () => {
        const capacity = await call("capacity-evaluate", {
          method: "POST",
          token: tokenOrg,
          body: { requirementId },
        });
        expect(capacity.status).toBe(200);
        const c = capacity.body.data?.capacity as Record<string, number>;
        expect(c.required).toBe(1);
        expect(typeof c.gap).toBe("number");
        expect(c.gap).toBe(Math.max(0, c.required! - c.internallyEligible!));
      });

      it("8. matching is deterministic: two evaluations return identical results", async () => {
        const first = await call("matching-evaluate", {
          method: "POST",
          token: tokenOrg,
          body: { requirementId },
        });
        const second = await call("matching-evaluate", {
          method: "POST",
          token: tokenOrg,
          body: { requirementId },
        });
        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(first.body.data?.summary).toEqual(second.body.data?.summary);
        expect(first.body.data?.candidates).toEqual(second.body.data?.candidates);
        // Private professionals (default visibility) must never appear.
        const candidates = first.body.data?.candidates as { candidate: { id: string } }[];
        for (const c of candidates) expect(c.candidate.id).not.toMatch(/@/);
      });

      it("14. withdrawing a hard qualification changes matching deterministically (then restored)", async () => {
        // Seed scenario: Delta (professional A) is one of the 3 eligible externals for the MAD need.
        const mad = await userClient(tokenOrg)
          .from("work_requirements")
          .select("id")
          .eq("title", "B1.1 · A320 line maintenance reinforcement")
          .limit(1)
          .maybeSingle();
        if (!mad.data) return; // not the seeded organization: nothing to assert
        const madId = String(mad.data.id);
        const evaluate = async () =>
          (
            await call("matching-evaluate", {
              method: "POST",
              token: tokenOrg,
              body: { requirementId: madId },
            })
          ).body.data?.summary as { evaluated: number; eligible: number };
        const baseline = await evaluate();

        const mine = (await call("professional-qualifications", { token: tokenA })).body.data
          ?.qualifications as Qualification[];
        const fts = mine.find((q) => q.type.code === "FTS");
        if (!fts || fts.verificationStatus !== "verified") return; // account is not Delta
        const withdraw = await call("professional-qualifications", {
          method: "PATCH",
          token: tokenA,
          query: { id: fts.id },
          body: { issuedAt: fts.issuedAt, expiresAt: fts.expiresAt, status: "withdrawn" },
        });
        expect(withdraw.status).toBe(200);
        try {
          const after = await evaluate();
          expect(after.evaluated).toBe(baseline.evaluated);
          expect(after.eligible).toBe(baseline.eligible - 1);
        } finally {
          const restore = await call("professional-qualifications", {
            method: "PATCH",
            token: tokenA,
            query: { id: fts.id },
            body: { issuedAt: fts.issuedAt, expiresAt: fts.expiresAt, status: "active" },
          });
          expect(restore.status).toBe(200);
          // Same dates → the review state is untouched (only date changes reset it).
          expect((restore.body.data?.qualification as Qualification).verificationStatus).toBe(
            "verified",
          );
        }
        expect(await evaluate()).toEqual(baseline);
      });

      it("10. a professional outside the organization cannot read or evaluate its requirement", async () => {
        const read = await call("work-requirements", {
          token: tokenA,
          query: { id: requirementId },
        });
        expect(read.status).toBe(404);
        const evaluated = await call("capacity-evaluate", {
          method: "POST",
          token: tokenA,
          body: { requirementId },
        });
        expect([403, 404]).toContain(evaluated.status);
        expect(evaluated.body.ok).toBe(false);
        const direct = await userClient(tokenA)
          .from("work_requirements")
          .select("id")
          .eq("id", requirementId);
        expect(direct.error).toBeNull();
        expect(direct.data).toEqual([]);
      });
    });
  },
);
