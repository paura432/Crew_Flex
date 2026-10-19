/* eslint-disable no-console -- CLI report */
// Release compatibility harness (LOCAL Docker stack only). Reproduces every intermediate state of
// the wave-1 rollout: functions served from the production commit (ddf5c4b) or the release commit
// (65df3b9) against the local DB at the production schema (10 migrations) or the release schema (15).
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const S = process.env.WT_DIR,
  REPO = process.cwd();
if (!S)
  throw new Error("WT_DIR (directory holding wt-<prod> and wt-<release> worktrees) is required");
const P = process.env.PROD_SHA,
  R = process.env.RELEASE_SHA;
if (!P || !R) throw new Error("PROD_SHA and RELEASE_SHA are required");
const HERE = new URL(".", import.meta.url).pathname;
const env = Object.fromEntries(
  readFileSync(`${REPO}/.env.local`, "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL,
  KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL_)) throw new Error("not a local stack");
const PW = "crewflex-local-only";
const psql = (sql) =>
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
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  ).trim();
const PORT = {
  "matching-evaluate": 54701,
  "capacity-evaluate": 54702,
  "professional-availability": 54703,
};
let procs = [];
async function start(map) {
  for (const p of procs) p.kill();
  procs = [];
  await new Promise((r) => setTimeout(r, 800));
  for (const [fn, commit] of Object.entries(map)) {
    const wt = `${S}/wt-${commit}`;
    procs.push(
      spawn(
        "deno",
        ["run", "-A", "--config", `${wt}/supabase/functions/deno.json`, `${HERE}serve.ts`],
        {
          env: {
            ...process.env,
            FN_ENTRY: `${wt}/supabase/functions/${fn}/index.ts`,
            PORT: String(PORT[fn]),
            SUPABASE_URL: URL_,
            SUPABASE_ANON_KEY: KEY,
          },
          stdio: ["ignore", "ignore", "inherit"],
        },
      ),
    );
  }
  for (const fn of Object.keys(map)) {
    for (let i = 0; i < 120; i++) {
      try {
        await fetch(`http://127.0.0.1:${PORT[fn]}/`);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
}
async function token(email) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PW }),
  });
  return (await r.json()).access_token;
}
async function call(fn, tok, { method = "GET", body, query = "", headers = {} } = {}) {
  const r = await fetch(`http://127.0.0.1:${PORT[fn]}/${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${tok}`,
      apikey: KEY,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body && JSON.stringify(body),
  });
  let json = null;
  try {
    json = await r.json();
  } catch {}
  return { status: r.status, json };
}
const ref = (req, profile) =>
  "CF-" + createHash("sha256").update(`${req}:${profile}`).digest("hex").slice(0, 10).toUpperCase();
const DELTA = "00000000-0000-4000-8000-000000000021",
  ALPHA = "00000000-0000-4000-8000-000000000011";
const MAD = psql(
  "select id from public.work_requirements where title = 'B1.1 · A320 line maintenance reinforcement'",
);
// AOG twin of MAD: same org, period and qualifications, urgency 'aog' (enum value exists since V0).
let AOG = psql("select id from public.work_requirements where title = 'COMPAT · AOG twin of MAD'");
if (!AOG) {
  psql(`with wr as (insert into public.work_requirements (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
          select organization_id, 'COMPAT · AOG twin of MAD', location, starts_at, ends_at, shift, headcount, 'aog', 'open', created_by from public.work_requirements where id = '${MAD}' returning id)
        insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
          select wr.id, q.qualification_type_id, q.requirement_level from wr, public.work_requirement_qualifications q where q.work_requirement_id = '${MAD}'`);
  AOG = psql("select id from public.work_requirements where title = 'COMPAT · AOG twin of MAD'");
}
const rows = [];
const rec = (state, check, got, expected) =>
  rows.push({
    state,
    check,
    got: String(got),
    expected: String(expected),
    ok: String(got) === String(expected),
  });

async function snapshot(state, { aogRows, newAvailability }) {
  const [mgr, fox, del] = await Promise.all([
    token("manager.mro@crewflex.test"),
    token("foxtrot@crewflex.test"),
    token("delta@crewflex.test"),
  ]);
  const mMad = await call("matching-evaluate", mgr, {
    method: "POST",
    body: { requirementId: MAD },
  });
  const mAog = await call("matching-evaluate", mgr, {
    method: "POST",
    body: { requirementId: AOG },
  });
  const eligible = (res) =>
    new Set(
      (res.json?.data?.candidates ?? []).filter((c) => c.match.eligible).map((c) => c.candidate.id),
    );
  rec(state, "matching MAD (urgent) HTTP", mMad.status, 200);
  rec(state, "matching AOG twin HTTP", mAog.status, 200);
  if (mMad.status === 200)
    rec(state, "delta eligible for urgent MAD", eligible(mMad).has(ref(MAD, DELTA)), !aogRows);
  if (mAog.status === 200)
    rec(state, "delta eligible for AOG twin", eligible(mAog).has(ref(AOG, DELTA)), true);
  const cMad = await call("capacity-evaluate", mgr, {
    method: "POST",
    body: { requirementId: MAD },
  });
  rec(state, "capacity MAD HTTP", cMad.status, 200);
  const internal = (cMad.json?.data?.internal ?? []).filter((c) => c.match.eligible).length;
  if (cMad.status === 200)
    rec(
      state,
      "capacity MAD internally eligible",
      internal,
      aogRows ? BASE.internal - 1 : BASE.internal,
    );
  const cAog = await call("capacity-evaluate", mgr, {
    method: "POST",
    body: { requirementId: AOG },
  });
  rec(state, "capacity AOG twin HTTP", cAog.status, 200);
  if (cAog.status === 200)
    rec(
      state,
      "capacity AOG twin internally eligible",
      (cAog.json?.data?.internal ?? []).filter((c) => c.match.eligible).length,
      BASE.internal,
    );
  const gFox = await call("professional-availability", fox);
  rec(state, "availability GET (no aog rows)", gFox.status, 200);
  const gDel = await call("professional-availability", del);
  rec(
    state,
    "availability GET (user with aog_only row)",
    gDel.status,
    aogRows && !newAvailability ? 500 : 200,
  );
  const key = crypto.randomUUID();
  const post = await call("professional-availability", fox, {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: { startsAt: "2032-01-10T00:00:00Z", endsAt: "2032-01-11T00:00:00Z", status: "available" },
  });
  rec(state, "availability POST create", post.status, 201);
  if (post.json?.data?.window?.id)
    await call("professional-availability", fox, {
      method: "DELETE",
      query: `?id=${post.json.data.window.id}`,
    });
  const put = await call("professional-availability", fox, {
    method: "PUT",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: { days: [{ date: "2032-01-12", status: null }] },
  });
  rec(state, "availability PUT (cycle save)", put.status, newAvailability ? 200 : 405);
  return { mMad, cMad };
}

let BASE = { internal: 0 };
// S0 = production today.
await start({ "matching-evaluate": P, "capacity-evaluate": P, "professional-availability": P });
{
  const mgr = await token("manager.mro@crewflex.test");
  const c = await call("capacity-evaluate", mgr, { method: "POST", body: { requirementId: MAD } });
  BASE.internal = (c.json?.data?.internal ?? []).filter((x) => x.match.eligible).length;
}
const s0 = await snapshot("S0 prod (DB10, all old)", { aogRows: false, newAvailability: false });
// S1 = step 1 done (new matching + capacity, old DB).
await start({ "matching-evaluate": R, "capacity-evaluate": R, "professional-availability": P });
const s1 = await snapshot("S1 step1 (DB10, new M/C)", { aogRows: false, newAvailability: false });
const elig = (r) =>
  JSON.stringify(
    (r.json?.data?.candidates ?? [])
      .map((c) => [c.candidate.id, c.match.eligible, c.match.blockers?.map((b) => b.code)])
      .sort(),
  );
rec("S0→S1", "matching MAD results identical", elig(s0.mMad) === elig(s1.mMad), true);
rec(
  "S0→S1",
  "capacity MAD identical",
  JSON.stringify(s0.cMad.json?.data?.capacity) === JSON.stringify(s1.cMad.json?.data?.capacity),
  true,
);
// Step 2: migrations #1–#5 from the release checkout only.
execFileSync("bash", ["scripts/local/sb-local.sh", "migration", "up", "--local"], {
  cwd: `${S}/wt-${R}`,
  stdio: "ignore",
});
rec(
  "step2",
  "local migrations applied (count)",
  psql("select count(*) from supabase_migrations.schema_migrations"),
  15,
);
rec(
  "step2",
  "wallet bucket/table absent",
  psql("select count(*) from pg_tables where tablename = 'professional_documents'") +
    "/" +
    psql("select count(*) from storage.buckets"),
  "0/0",
);
await snapshot("S2 step2 (DB15, no aog rows yet)", {
  aogRows: false,
  newAvailability: false,
});
// A professional writes aog_only windows directly (possible as soon as the enum exists).
psql(
  `insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status) values ('${DELTA}', '2026-10-19 00:00Z', '2026-10-20 00:00Z', 'aog_only'), ('${ALPHA}', '2026-10-19 00:00Z', '2026-10-20 00:00Z', 'aog_only')`,
);
await snapshot("S2 step2 (DB15 + aog_only rows)", { aogRows: true, newAvailability: false });
// Step 3: new professional-availability.
await start({ "matching-evaluate": R, "capacity-evaluate": R, "professional-availability": R });
await snapshot("S3 step3 (DB15, all new)", { aogRows: true, newAvailability: true });
// Rollback hazard: functions rolled back below step 1 while aog_only rows exist.
await start({ "matching-evaluate": P, "capacity-evaluate": P, "professional-availability": P });
{
  const mgr = await token("manager.mro@crewflex.test");
  const m = await call("matching-evaluate", mgr, { method: "POST", body: { requirementId: MAD } });
  rec("R1 rollback fns, aog rows", "OLD matching MAD HTTP (hazard)", m.status, 500);
  psql(
    `delete from public.availability_windows where status = 'aog_only' and technician_profile_id in ('${DELTA}','${ALPHA}')`,
  );
  const m2 = await call("matching-evaluate", mgr, { method: "POST", body: { requirementId: MAD } });
  rec("R2 rollback fns, aog rows converted/removed", "OLD matching MAD HTTP", m2.status, 200);
  rec("R2", "results identical to S0", elig(s0.mMad) === elig(m2), true);
}
for (const p of procs) p.kill();
psql(`delete from public.work_requirements where title = 'COMPAT · AOG twin of MAD'`).toString();
const width = Math.max(...rows.map((r) => r.state.length));
for (const r of rows)
  console.log(
    `${r.ok ? "PASS" : "FAIL"}  ${r.state.padEnd(width)}  ${r.check} = ${r.got}${r.ok ? "" : ` (expected ${r.expected})`}`,
  );
console.log(`\n${rows.filter((r) => r.ok).length}/${rows.length} as expected`);
process.exit(rows.every((r) => r.ok) ? 0 : 1);
