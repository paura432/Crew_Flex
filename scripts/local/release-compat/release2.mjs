// Release-2 compatibility drill (LOCAL Docker stack only). Reproduces every intermediate state of
// publishing local `main` after release 1 (`65df3b9`): the HEAD frontend's calls against the
// production `work-requirements`, the HEAD function against the production schema (15 migrations)
// and against the full local schema, and the rollback of the three functions. Run it through
// release2.sh, which resets the local database (destructive, local) and restores it afterwards.
import { execFileSync } from "node:child_process";
import {
  assertNoStaleServers,
  call,
  localEnv,
  psql,
  psqlError,
  reporter,
  serve,
  stop,
  token,
} from "./lib.mjs";

const REPO = process.cwd();
const PROD_WT = process.env.PROD_WT;
if (!PROD_WT) throw new Error("PROD_WT (worktree of the production commit) is required");
assertNoStaleServers();
const ENV = localEnv(REPO);
const PORT = { "work-requirements": 54711, "matching-evaluate": 54712, "capacity-evaluate": 54713 };
const fns = (root, names) =>
  names.map((name) => ({
    entry: `${root}/supabase/functions/${name}/index.ts`,
    config: `${root}/supabase/functions/deno.json`,
    port: PORT[name],
  }));
const { rec, print } = reporter();
const mgr = await token(ENV, "manager.mro@crewflex.test");
const MAD = psql(
  "select id from public.work_requirements where title = 'B1.1 · A320 line maintenance reinforcement'",
);
// Far-future twin of MAD (same org and qualifications): the focus query must keep returning it
// whatever today's date is, and it is the row the drill closes. The final reset removes it.
psql(`with wr as (insert into public.work_requirements (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
        select organization_id, 'DRILL · far-future twin of MAD', location, '2032-03-01 20:00Z', '2032-03-05 06:00Z', shift, headcount, urgency, 'open', created_by
        from public.work_requirements where id = '${MAD}' returning id)
      insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
        select wr.id, q.qualification_type_id, q.requirement_level from wr, public.work_requirement_qualifications q where q.work_requirement_id = '${MAD}'`);
const TWIN = psql(
  "select id from public.work_requirements where title = 'DRILL · far-future twin of MAD'",
);
const migrations = () => psql("select count(*) from supabase_migrations.schema_migrations");
const status = () => psql(`select status from public.work_requirements where id = '${TWIN}'`);
const audits = () =>
  psql(
    `select count(*) from public.audit_events where entity_id = '${TWIN}' and action = 'requirement.status_changed'`,
  );
const expectedFocus = () =>
  psql(
    `select count(*) from public.work_requirements where organization_id = (select organization_id from public.work_requirements where id = '${TWIN}') and status = 'open' and ends_at > now()`,
  );
const AS_DELTA = `set role authenticated; set request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000021","role":"authenticated"}';`;
// Exactly what src/app/app/organization/page.tsx sends for the dashboard focus (batch 15).
const focus = `?status=open&endsAfter=${encodeURIComponent(new Date().toISOString())}`;
const list = (query = "") => call(PORT["work-requirements"], ENV, mgr, { query });
const rows = (res) => res.json?.data?.requirements ?? [];
const focusShape = (res) =>
  `${res.status} ${rows(res).length}/${expectedFocus()} ${[...new Set(rows(res).map((r) => r.status))].join() || "-"} twin:${rows(res).some((r) => r.id === TWIN)}`;
const close = () =>
  call(PORT["work-requirements"], ENV, mgr, {
    method: "PATCH",
    body: { id: TWIN, status: "closed" },
  });
const reopen = () =>
  psqlError(`update public.work_requirements set status = 'open' where id = '${TWIN}'`);
const evaluate = (fn) =>
  call(PORT[fn], ENV, mgr, { method: "POST", body: { requirementId: TWIN } });

rec("pre", "local schema = production (migrations)", migrations(), 15);
rec("pre", "twin open", status(), "open");

// S0: production function, production schema, HEAD frontend.
await serve(fns(PROD_WT, ["work-requirements"]), ENV);
rec("S0 prod fn · DB15", "plain list", (await list()).status, 200);
const f0 = await list(focus);
rec(
  "S0 prod fn · DB15",
  "HEAD dashboard focus query → rejected (HAZARD: frontend before function)",
  `${f0.status} ${f0.json?.error?.code}`,
  "400 VALIDATION_ERROR",
);
rec(
  "S0 prod fn · DB15",
  "HEAD close (PATCH) → 405, nothing written",
  `${(await close()).status} ${status()}`,
  "405 open",
);
rec(
  "S0 prod fn · DB15",
  "wallet RPC absent (HEAD UI fails closed)",
  psqlError(`${AS_DELTA} select public.is_feature_enabled('document_wallet')`),
  "function public.is_feature_enabled(unknown) does not exist",
);

// S1: HEAD function on the production schema (function before migrations).
await serve(fns(REPO, ["work-requirements"]), ENV);
rec(
  "S1 HEAD fn · DB15",
  "focus query: 200, count = SQL (open, ends_at > now), only open rows, twin present",
  focusShape(await list(focus)),
  `200 ${expectedFocus()}/${expectedFocus()} open twin:true`,
);
rec(
  "S1 HEAD fn · DB15",
  "close → 200 closed",
  `${(await close()).status} ${status()}`,
  "200 closed",
);
rec(
  "S1 HEAD fn · DB15",
  "no audit row, reopen allowed (HAZARD: function before migrations)",
  `${audits()} ${reopen()}`,
  "0 ok",
);

// S2: full local schema, HEAD functions.
execFileSync("bash", ["scripts/local/sb-local.sh", "migration", "up", "--local"], {
  stdio: "ignore",
});
await serve(fns(REPO, ["work-requirements", "matching-evaluate", "capacity-evaluate"]), ENV);
rec("S2 HEAD fns · DB20", "local migrations applied", migrations(), 20);
rec(
  "S2 HEAD fns · DB20",
  "RLS enabled on every public table",
  psql("select count(*) from pg_tables where schemaname = 'public' and not rowsecurity"),
  0,
);
rec(
  "S2 HEAD fns · DB20",
  "close triggers present",
  psql(
    "select count(*) from pg_trigger where tgname in ('work_requirements_status_change','work_requirements_closed_frozen','work_requirement_qualifications_closed_frozen')",
  ),
  3,
);
rec(
  "S2 HEAD fns · DB20",
  "wallet bucket exists; flag absent → RPC false for a technician",
  `${psql("select count(*) from storage.buckets where id = 'professional-documents'")} ${psql(`${AS_DELTA} select public.is_feature_enabled('document_wallet')`)}`,
  "1 f",
);
rec(
  "S2 HEAD fns · DB20",
  "wallet Storage insert refused by RLS without the flag",
  psqlError(
    `${AS_DELTA} insert into storage.objects (bucket_id, name, owner_id) values ('professional-documents', '00000000-0000-4000-8000-000000000021/${crypto.randomUUID()}-00', '00000000-0000-4000-8000-000000000021')`,
  ),
  'new row violates row-level security policy for table "objects"',
);
rec(
  "S2 HEAD fns · DB20",
  "close → 200 closed, one audit row",
  `${(await close()).status} ${status()} ${audits()}`,
  "200 closed 1",
);
rec(
  "S2 HEAD fns · DB20",
  "close again → 200 no-op, still one audit row",
  `${(await close()).status} ${audits()}`,
  "200 1",
);
rec(
  "S2 HEAD fns · DB20",
  "focus query drops the closed row",
  focusShape(await list(focus)),
  `200 ${expectedFocus()}/${expectedFocus()} ${expectedFocus() === "0" ? "-" : "open"} twin:false`,
);
rec(
  "S2 HEAD fns · DB20",
  "reopen refused (frozen guard fires first, alphabetical)",
  reopen(),
  "a closed requirement cannot be changed",
);
rec(
  "S2 HEAD fns · DB20",
  "closed requirement frozen",
  psqlError(`update public.work_requirements set title = title || ' x' where id = '${TWIN}'`),
  "a closed requirement cannot be changed",
);
rec(
  "S2 HEAD fns · DB20",
  "matching / capacity on the closed row → 409",
  `${(await evaluate("matching-evaluate")).status} ${(await evaluate("capacity-evaluate")).status}`,
  "409 409",
);

// R: the three production functions on the full schema (schema first; function rollback).
await serve(fns(PROD_WT, ["work-requirements", "matching-evaluate", "capacity-evaluate"]), ENV);
const r = await list();
rec(
  "R prod fns · DB20",
  "plain list returns the closed row as closed",
  `${r.status} ${rows(r).find((x) => x.id === TWIN)?.status}`,
  "200 closed",
);
rec(
  "R prod fns · DB20",
  "close → 405 (old function has no write path)",
  (await close()).status,
  405,
);
rec(
  "R prod fns · DB20",
  "old matching / capacity on the closed row → 200 (no 409 yet, harmless)",
  `${(await evaluate("matching-evaluate")).status} ${(await evaluate("capacity-evaluate")).status}`,
  "200 200",
);
stop();
process.exit(print() ? 0 : 1);
