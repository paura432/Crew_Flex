import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateProductionGuard, expectedConfirmation, PRODUCTION_REF } from "../e2e/guard";

const root = join(import.meta.dirname, "..", "..");
const url = `https://${PRODUCTION_REF}.supabase.co`;
const today = new Date("2026-10-10T12:00:00Z");
const confirm = expectedConfirmation(PRODUCTION_REF, today);

describe("I. remote E2E writes need the authorized ref AND a per-run confirmation", () => {
  it("passes only when both conditions hold", () => {
    const ok = evaluateProductionGuard({
      url,
      authorizedRef: PRODUCTION_REF,
      writeConfirm: confirm,
      today,
    });
    expect(ok).toEqual({ ok: true, ref: PRODUCTION_REF });
  });

  it("refuses a URL that is not a Supabase project", () => {
    const r = evaluateProductionGuard({
      url: "https://example.com",
      authorizedRef: PRODUCTION_REF,
      writeConfirm: confirm,
      today,
    });
    expect(r.ok).toBe(false);
  });

  it("refuses when the authorized ref is missing or differs from the URL", () => {
    expect(evaluateProductionGuard({ url, writeConfirm: confirm, today }).ok).toBe(false);
    expect(
      evaluateProductionGuard({
        url,
        authorizedRef: "abcdefghijabcdefghij",
        writeConfirm: confirm,
        today,
      }).ok,
    ).toBe(false);
  });

  it("refuses when the linked project differs from the authorized ref", () => {
    const r = evaluateProductionGuard({
      url,
      authorizedRef: PRODUCTION_REF,
      linkedRef: "abcdefghijabcdefghij",
      writeConfirm: confirm,
      today,
    });
    expect(r).toMatchObject({ ok: false, reason: expect.stringContaining("linked") });
  });

  it("refuses a missing, stale (yesterday) or wrong-ref confirmation", () => {
    expect(evaluateProductionGuard({ url, authorizedRef: PRODUCTION_REF, today }).ok).toBe(false);
    const stale = expectedConfirmation(PRODUCTION_REF, new Date("2026-10-09T12:00:00Z"));
    expect(
      evaluateProductionGuard({ url, authorizedRef: PRODUCTION_REF, writeConfirm: stale, today })
        .ok,
    ).toBe(false);
    const other = expectedConfirmation("abcdefghijabcdefghij", today);
    expect(
      evaluateProductionGuard({ url, authorizedRef: PRODUCTION_REF, writeConfirm: other, today })
        .ok,
    ).toBe(false);
  });

  it("refuses a confirmation stored in .env.e2e even when it is correct", () => {
    const r = evaluateProductionGuard({
      url,
      authorizedRef: PRODUCTION_REF,
      writeConfirm: confirm,
      today,
      envFileContent: `E2E_SUPABASE_URL=${url}\nE2E_WRITE_CONFIRM=${confirm}\n`,
    });
    expect(r).toMatchObject({ ok: false, reason: expect.stringContaining("never stored") });
  });
});

describe("I. the shell scripts enforce the same guard before any network call", () => {
  function run(script: string, env: Record<string, string>, ...args: string[]) {
    const result = spawnSync("bash", [`scripts/e2e/${script}`, ...args], {
      cwd: root,
      // Minimal environment: no .env.e2e values leak in, so every refusal is caused by the test input.
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_ENV: process.env.NODE_ENV,
        SUPABASE_SECRET_KEY: "sb_secret_dummy",
        ...env,
      } as NodeJS.ProcessEnv,
      encoding: "utf8",
    });
    return { status: result.status, stderr: result.stderr };
  }
  const base = { SUPABASE_URL: url, E2E_AUTHORIZED_PROJECT_REF: PRODUCTION_REF };

  it("seed refuses without the authorized ref", () => {
    const r = run("seed-users.sh", { SUPABASE_URL: url });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("E2E_AUTHORIZED_PROJECT_REF");
  });

  it("seed and cleanup refuse without the per-run confirmation", () => {
    for (const script of ["seed-users.sh", "cleanup-synthetic.sh"]) {
      const r = run(script, base);
      expect(r.status, script).toBe(2);
      expect(r.stderr, script).toContain("E2E_WRITE_CONFIRM=WRITE:");
    }
  });

  it("seed refuses non-synthetic e-mails even when both conditions hold", () => {
    const r = run("seed-users.sh", {
      ...base,
      E2E_WRITE_CONFIRM: expectedConfirmation(PRODUCTION_REF),
      E2E_PRO_A_EMAIL: "someone@example.com",
      E2E_PRO_A_PASSWORD: "x",
      E2E_PRO_B_EMAIL: "e2e-b@example.com",
      E2E_PRO_B_PASSWORD: "x",
      E2E_ORG_ADMIN_EMAIL: "e2e-org@example.com",
      E2E_ORG_ADMIN_PASSWORD: "x",
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("not obviously synthetic");
  });
});
