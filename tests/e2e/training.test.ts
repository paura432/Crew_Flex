// Local E2E of the `training` function against the real RPCs (ADR-003): the boundary the PGlite and Deno suites do not
// cross. Synthetic seed accounts only; skipped unless the URL is local (guard.ts). Draft courses «E2E …» are removed by
// scripts/local/cleanup-test-rows.sh.
import { beforeAll, describe, expect, it } from "vitest";
import { trainingWrite } from "../../src/lib/validation/training";
import { isLocalUrl } from "./guard";
import { call, client, key, signIn, url } from "./local-api";

describe.skipIf(!isLocalUrl(url) || !key)("local E2E: training function ↔ RPCs (V19-036)", () => {
  let admin = "";
  let orgId = "";

  beforeAll(async () => {
    admin = await signIn("admin.mro@crewflex.test");
    const { data } = await client(admin)
      .from("organizations")
      .select("id")
      .eq("name", "Demo MRO Madrid")
      .single();
    orgId = data!.id as string;
  });

  it("saving the provider answers 200 with the organization as id (it used to 500 after writing)", async () => {
    // A re-save carries the version (the profile may exist from an earlier run).
    const workspace = await call("training", {
      token: admin,
      query: { view: "workspace", organizationId: orgId },
    });
    const current = workspace.body.data?.provider as { updatedAt: string } | null;
    const res = await call("training", {
      method: "POST",
      token: admin,
      body: {
        op: "provider",
        input: {
          organizationId: orgId,
          name: "Demo MRO Academy",
          description: "E2E provider",
          ...(current ? { expectedUpdatedAt: current.updatedAt } : {}),
        },
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: orgId, status: "pending" });
  });

  it("a course parsed by the server action (empty texts → null) is accepted by the function", async () => {
    const body = trainingWrite.parse({
      op: "course",
      input: {
        organizationId: orgId,
        title: `E2E course ${Date.now()}`,
        family: "safety",
        description: "E2E draft course",
        language: "es",
        certificateInfo: "Certificado",
        issuer: "Demo MRO Academy",
        aircraft: "",
      },
    });
    const res = await call("training", { method: "POST", token: admin, body });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "draft" });
  });

  it("the private account export carries the caller's training data (V19-037)", async () => {
    const res = await call("account", { token: await signIn("kilo@crewflex.test") });
    expect(res.status).toBe(200);
    expect((res.body.data?.export as Record<string, unknown>).training).toMatchObject({
      requests: expect.any(Array),
      favorites: expect.any(Array),
    });
  });
});
