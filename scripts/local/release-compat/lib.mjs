/* eslint-disable no-console -- CLI report */
// Shared helpers of the release-compat harnesses (LOCAL Docker stack only): env, psql through the
// local container, one deno process per served Edge Function, password tokens, calls, a report.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";

export const PASSWORD = "crewflex-local-only";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function localEnv(repo) {
  const env = Object.fromEntries(
    readFileSync(`${repo}/.env.local`, "utf8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) throw new Error("not a local stack");
  return { url, key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
}

export const psql = (sql) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_crew-flex",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-Atq",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  ).trim();

/** Runs SQL that is expected to fail; returns the first ERROR line (without the prefix) or "ok". */
export function psqlError(sql) {
  try {
    psql(sql);
    return "ok";
  } catch (err) {
    const line = String(err.stderr ?? "")
      .split("\n")
      .find((l) => l.startsWith("ERROR:"));
    return line ? line.replace(/^ERROR:\s*/, "") : `unexpected: ${err.message}`;
  }
}

/** A deno server left by a crashed run would answer on our ports and fake the results. */
export function assertNoStaleServers() {
  try {
    const pids = execFileSync("pgrep", ["-f", "^deno run .*release-compat/serve\\.ts"], {
      encoding: "utf8",
    });
    throw new Error(`stale release-compat serve.ts process(es): ${pids.trim()} — kill them first`);
  } catch (err) {
    if (err.status === 1) return; // pgrep: no match
    throw err;
  }
}

let procs = [];
export function stop() {
  for (const p of procs) p.kill();
  procs = [];
}
/** servers: [{ entry, config, port }] — each `entry` served by serve.ts on its own port. */
export async function serve(servers, { url, key }) {
  stop();
  await sleep(800);
  for (const s of servers) {
    procs.push(
      spawn(
        "deno",
        ["run", "-A", "--config", s.config, new URL("./serve.ts", import.meta.url).pathname],
        {
          env: {
            ...process.env,
            FN_ENTRY: s.entry,
            PORT: String(s.port),
            SUPABASE_URL: url,
            SUPABASE_ANON_KEY: key,
          },
          stdio: ["ignore", "ignore", "inherit"],
        },
      ),
    );
  }
  for (const s of servers) {
    let ready = false;
    for (let i = 0; i < 120 && !ready; i++) {
      try {
        await fetch(`http://127.0.0.1:${s.port}/`);
        ready = true;
      } catch {
        await sleep(500);
      }
    }
    if (!ready) {
      stop();
      throw new Error(`function on port ${s.port} never answered (${s.entry})`);
    }
  }
}

export async function token({ url, key }, email) {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (await r.json()).access_token;
}

export async function call(
  port,
  { key },
  tok,
  { method = "GET", body, query = "", headers = {} } = {},
) {
  const r = await fetch(`http://127.0.0.1:${port}/${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${tok}`,
      apikey: key,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body && JSON.stringify(body),
  });
  let json = null;
  try {
    json = await r.json();
  } catch {
    /* no body */
  }
  return { status: r.status, json };
}

export function reporter() {
  const rows = [];
  return {
    rec(state, check, got, expected) {
      rows.push({ state, check, got: String(got), expected: String(expected) });
    },
    /** Prints PASS/FAIL lines and the total; returns true when every row matched. */
    print() {
      const width = Math.max(...rows.map((r) => r.state.length));
      let ok = 0;
      for (const r of rows) {
        const pass = r.got === r.expected;
        ok += pass;
        console.log(
          `${pass ? "PASS" : "FAIL"}  ${r.state.padEnd(width)}  ${r.check} = ${r.got}${pass ? "" : ` (expected ${r.expected})`}`,
        );
      }
      console.log(`\n${ok}/${rows.length} as expected`);
      return ok === rows.length;
    },
  };
}
