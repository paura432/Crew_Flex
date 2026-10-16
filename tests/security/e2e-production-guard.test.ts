import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateProductionGuard,
  expectedConfirmation,
  PRODUCTION_REF,
  readE2eEnvFiles,
} from "../e2e/guard";

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

  it("accepts the local Docker stack without any condition (never production)", () => {
    expect(evaluateProductionGuard({ url: "http://127.0.0.1:56321" })).toEqual({
      ok: true,
      ref: "local",
    });
    expect(evaluateProductionGuard({ url: "http://localhost:56321" })).toEqual({
      ok: true,
      ref: "local",
    });
    expect(evaluateProductionGuard({ url: "https://localhost.evil.example" }).ok).toBe(false);
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

describe("I. a stored confirmation is refused in ANY .env.e2e* file (separate production config)", () => {
  it("readE2eEnvFiles reads .env.e2e and .env.e2e.<name>, never the committed example", () => {
    const dir = mkdtempSync(join(tmpdir(), "e2e-env-"));
    try {
      expect(readE2eEnvFiles(dir)).toBeUndefined();
      writeFileSync(join(dir, ".env.e2e.example"), "E2E_WRITE_CONFIRM=\n");
      expect(readE2eEnvFiles(dir)).toBeUndefined();
      writeFileSync(join(dir, ".env.e2e"), "E2E_SUPABASE_URL=http://127.0.0.1:56321\n");
      writeFileSync(join(dir, ".env.e2e.production"), `E2E_WRITE_CONFIRM=${confirm}\n`);
      const content = readE2eEnvFiles(dir);
      expect(content).toContain("127.0.0.1");
      const r = evaluateProductionGuard({
        url,
        authorizedRef: PRODUCTION_REF,
        writeConfirm: confirm,
        today,
        envFileContent: content,
      });
      expect(r).toMatchObject({ ok: false, reason: expect.stringContaining("never stored") });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the shell guard refuses a confirmation stored in .env.e2e.<name>", () => {
    const file = join(root, ".env.e2e.guardtest");
    const today = expectedConfirmation(PRODUCTION_REF);
    writeFileSync(file, `E2E_WRITE_CONFIRM=${today}\n`);
    try {
      const r = spawnSync("bash", ["scripts/e2e/cleanup-synthetic.sh", "--dry-run"], {
        cwd: root,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          NODE_ENV: process.env.NODE_ENV,
          SUPABASE_URL: url,
          E2E_AUTHORIZED_PROJECT_REF: PRODUCTION_REF,
          E2E_WRITE_CONFIRM: today,
        } as NodeJS.ProcessEnv,
        encoding: "utf8",
      });
      expect(r.status).toBe(2);
      expect(r.stderr).toContain("never stored in .env.e2e.guardtest");
    } finally {
      rmSync(file, { force: true });
    }
  });
});

describe("I. synthetic-account scripts validate their inputs before any network call", () => {
  // Both guard conditions hold here, so each refusal below comes from the input validation itself.
  const authorized = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_URL: url,
    E2E_AUTHORIZED_PROJECT_REF: PRODUCTION_REF,
    E2E_WRITE_CONFIRM: expectedConfirmation(PRODUCTION_REF),
    SUPABASE_SECRET_KEY: "sb_secret_dummy",
  };
  const accounts = {
    E2E_PRO_A_EMAIL: "e2e-a@example.com",
    E2E_PRO_A_PASSWORD: "Aa1Bb2Cc3Dd4Ee5Ff6",
    E2E_PRO_B_EMAIL: "e2e-b@example.com",
    E2E_PRO_B_PASSWORD: "Gg7Hh8Ii9Jj0Kk1Ll2",
    E2E_ORG_ADMIN_EMAIL: "e2e-org@example.com",
    E2E_ORG_ADMIN_PASSWORD: "Mm3Nn4Oo5Pp6Qq7Rr8",
  };
  const run = (script: string, env: Record<string, string>, ...args: string[]) =>
    spawnSync("bash", [`scripts/e2e/${script}`, ...args], {
      cwd: root,
      env: { ...authorized, ...env } as NodeJS.ProcessEnv,
      encoding: "utf8",
    });

  it("seed refuses short passwords and passwords that would break the JSON payload", () => {
    for (const bad of ["short", 'Aa1Bb2Cc3Dd4"Ee5Ff6', "Aa1Bb2Cc3Dd4\\Ee5Ff6"]) {
      const r = run("seed-users.sh", { ...accounts, E2E_PRO_B_PASSWORD: bad });
      expect(r.status, bad).toBe(2);
      expect(r.stderr, bad).toMatch(/E2E_PRO_B_PASSWORD must/);
    }
  });

  it("cleanup refuses an e-mail that could inject SQL or is not synthetic", () => {
    const injected = run("cleanup-synthetic.sh", {
      ...accounts,
      E2E_PRO_A_EMAIL: "e2e'),('x@example.com",
    });
    expect(injected.status).toBe(2);
    expect(injected.stderr).toContain("not a plain e-mail address");
    const real = run("cleanup-synthetic.sh", { ...accounts, E2E_PRO_A_EMAIL: "pau@example.com" });
    expect(real.status).toBe(2);
    expect(real.stderr).toContain("not obviously synthetic");
  });
});
