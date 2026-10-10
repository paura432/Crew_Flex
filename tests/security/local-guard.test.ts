import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..", "..");

/** Every case here must be refused before the wrapper runs any `supabase` command. */
function run(...args: string[]) {
  const result = spawnSync("bash", ["scripts/local/sb-local.sh", ...args], {
    cwd: root,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: process.env.NODE_ENV,
    } as NodeJS.ProcessEnv,
    encoding: "utf8",
  });
  return { status: result.status, stderr: result.stderr };
}

describe("J. local CLI wrapper never reaches a remote project", () => {
  it("refuses remote targeting flags", () => {
    for (const flag of [
      "--linked",
      "--project-ref",
      "--project-ref=sbjkzrkmcekokkqiuvvh",
      "--project-id",
    ]) {
      const { status, stderr } = run("db", "query", flag, "select 1");
      expect(status, flag).toBe(2);
      expect(stderr, flag).toContain("remote targeting is not allowed");
    }
  });

  it("refuses --db-url unless the host is 127.0.0.1 or localhost", () => {
    const remote = run(
      "db",
      "query",
      "--db-url=postgresql://u:p@db.sbjkzrkmcekokkqiuvvh.supabase.co:5432/postgres",
      "select 1",
    );
    expect(remote.status).toBe(2);
    expect(remote.stderr).toContain("non-local host");
    const bare = run(
      "db",
      "query",
      "--db-url",
      "postgresql://u:p@127.0.0.1:56322/postgres",
      "select 1",
    );
    expect(bare.status).toBe(2);
  });

  it("refuses subcommands that can modify a remote project", () => {
    for (const cmd of [
      ["link"],
      ["projects", "list"],
      ["secrets", "set", "X=1"],
      ["functions", "deploy", "health"],
      ["db", "push"],
      ["migration", "up"],
      ["migration", "repair", "1"],
      ["branches", "list"],
    ]) {
      const { status, stderr } = run(...cmd);
      expect(status, cmd.join(" ")).toBe(2);
      expect(stderr, cmd.join(" ")).toContain("not a local-only operation");
    }
  });
});
