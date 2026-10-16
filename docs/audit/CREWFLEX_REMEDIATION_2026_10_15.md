# Crew Flex · Remediation report — 2026-10-15

> Scope: close the technical and functional debt found by the last audit (phase 0.8,
> `docs/integration/crewflex-v13/`) before continuing the V1.3 integration. Everything below was executed
> locally unless marked otherwise. **Nothing remote was read or written; nothing was committed or pushed;
> no migration was applied and no function deployed outside the local Docker stack.** SKIPPED, BLOCKED and
> NOT RUN are never counted as PASS.

## 1. Executive summary

| Area                                          | Result                                                                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| E-3 · requirement without hard qualifications | **Fixed** in PostgreSQL (deferred constraint trigger) + engine guard. Reproduced before, impossible after — incl. real concurrency  |
| I-3 · half-saved passport                     | **Fixed**: one-transaction RPC + optimistic concurrency (409, nothing written)                                                      |
| I-1 · duplicates on retry                     | **Fixed**: `Idempotency-Key` enforced by PostgreSQL in the same transaction as the insert, three create endpoints + forms           |
| Candidate pool (cap hides eligible people)    | **Fixed**: eligible candidates are selected first (SQL ≡ `evaluateMatch`, parity-tested); the UI states when a result is partial    |
| Qualification verification                    | **Implemented locally** (platform admin, audited, no self-review). **Remote use blocked by OD-3** (fails closed)                    |
| Local E2E environment                         | **Restored**: Docker from WSL, Edge runtime, migrations applied incrementally, 25/25 E2E, 78/78 browser smoke on a production build |
| Document wallet                               | **Design only** (§10), no storage created                                                                                           |
| UX / i18n                                     | Mobile navigation no longer hides items; completeness ≠ verification; next steps; review reasons visible; ES/EN parity kept         |
| Verdict                                       | **PARTIALLY READY** (§15)                                                                                                           |

Defects found **during** this remediation and fixed before the end of the run (they never left the machine):
PostgREST retry loop on a deterministic `40001` (§4.6), review success message lost on revalidation, metric
card overflow at 360 px (pre-existing), seed relying on separate statements, documentation of BR-2.4.

## 2. Baseline Git

| Item                  | Value                                                                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remote                | `origin` = `git@github-paura432:paura432/Crew_Flex.git`                                                                                                                                                                                       |
| `origin/main`         | `4f98e67` (last published HEAD, as recorded by the previous audit)                                                                                                                                                                            |
| Local `main`          | `a7fd5a7`, **2 commits ahead** of `origin/main`, not pushed                                                                                                                                                                                   |
| Working tree at start | 130 changed/untracked paths (i18n/settings phase 1.5, phase 0.8 V1.3 audit, two unapplied migrations, evidence) — not mine                                                                                                                    |
| Isolation             | Local branch `fix/remediation-2026-10-15` created from that state (no checkout of other content, nothing discarded)                                                                                                                           |
| Baseline snapshot     | `refs/baseline/remediation-start` = `bf3feb1` (`git stash create`: **tracked** changes only). Untracked files at the start (e.g. `messages/*.json`, the 0.8 migrations) are not in that snapshot; every change I made to them is listed in §5 |
| Other branches        | `chore/tmp-material`, `feat/crewflex-parity-migration` (ahead 1 of its remote), `feat/foundation-v0` — untouched                                                                                                                              |
| Commits / pushes      | **None** (not authorised). AGENTS.md's main-only rule (OD-9) and this brief's "no push to main" were both respected by not committing                                                                                                         |
| Final tree            | Same branch, 173 changed/untracked paths (baseline + this work), `git diff --check` clean                                                                                                                                                     |

## 3. Findings revisited (phase 0)

| Finding                                                                           | State at start   | Evidence (new)                                                                                                              | Severity | Action                                                                          | State now                                        |
| --------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------- | ------------------------------------------------ |
| E-3 · direct PostgREST writes can leave a need without `hard`                     | CONFIRMED_OPEN   | grants `insert, delete` on `work_requirement_qualifications`, `insert` on `work_requirements`; 6 tests fail without the fix | P0       | §4.1                                                                            | CONFIRMED_FIXED                                  |
| I-3 · passport saved in two separate writes                                       | CONFIRMED_OPEN   | `professional-profile` PATCH = 2 PostgREST updates                                                                          | P1       | §4.2                                                                            | CONFIRMED_FIXED                                  |
| I-1 · no idempotency on creates                                                   | CONFIRMED_OPEN   | plain inserts, no key                                                                                                       | P1       | §4.3                                                                            | CONFIRMED_FIXED                                  |
| Candidate pool cap may hide eligible candidates                                   | CONFIRMED_OPEN   | real Postgres: 100 verified-but-expiring decoys + 1 eligible → `winner_included=false` with `20261015120100`                | P1       | §4.4                                                                            | CONFIRMED_FIXED                                  |
| No verification path (pending forever)                                            | CONFIRMED_OPEN   | no grant/RPC/function/UI                                                                                                    | P0 func. | §4.5                                                                            | FIXED LOCALLY · NEEDS_DECISION (OD-3) for remote |
| Local Edge runtime / WSL Docker unavailable                                       | NOT_REPRODUCIBLE | Docker socket present; DB port proxy was stale (ECONNRESET) → `docker restart supabase_db_crew-flex`                        | P0 env.  | `LOCAL_ENVIRONMENT.md` §9                                                       | CONFIRMED_FIXED                                  |
| `20261015120000/120100` not applied to the local Docker DB                        | CONFIRMED_OPEN   | `schema_migrations` had 3 rows                                                                                              | P1       | applied incrementally with the guarded wrapper                                  | CONFIRMED_FIXED                                  |
| `.env.production.local` could point a local smoke at production                   | CONFIRMED_FIXED  | no `.env.production*`/`.env` file; `ui-smoke.mjs` refuses them; `.env.local` and `.env.e2e` point at `127.0.0.1:56321`      | P0 iso.  | kept; re-verified each run                                                      | CONFIRMED_FIXED                                  |
| 13 E2E skipped                                                                    | CONFIRMED_OPEN   | ran against the local stack                                                                                                 | P0       | §11                                                                             | 25/25 PASS (local)                               |
| Mobile nav clips "Availability" (V13-X08)                                         | CONFIRMED_OPEN   | screenshot 390 px                                                                                                           | P2       | §9                                                                              | CONFIRMED_FIXED                                  |
| "Passport 100 % Complete" reads like "verified"                                   | CONFIRMED_OPEN   | BR-11 needs one verified item out of seven                                                                                  | P2       | §9 (label, no rule change)                                                      | FIXED (R-D5 open)                                |
| BR-2.4 text ≠ code (`date(endsAt)` vs `endsAt − 1 ms`)                            | new              | `validityForPeriod`                                                                                                         | P3 doc   | doc corrected                                                                   | CONFIRMED_FIXED                                  |
| Pre-existing PGlite test commits state (`audit › records qualification.verified`) | new              | full-run failures of new tests that assumed the seed                                                                        | P3 test  | new tests made order-independent; old test untouched (no test deleted/weakened) | OPEN (recommend isolating)                       |

## 4. Root causes and implemented fixes

### 4.1 E-3 — BR-1.4 invariant (`20261015130000_requirement_qualification_invariant.sql`)

Root cause: the invariant lived in the form, the Edge Function and `create_work_requirement`, but that RPC is
`SECURITY INVOKER`, so `authenticated` needs direct `insert` on both tables — and therefore can also insert an
empty `open` requirement, delete the last `hard` row, or delete + insert it as `soft`.

Fix: function `enforce_requirement_qualifications()` (DEFINER, `search_path = ''`, execute revoked from
everyone) behind two **DEFERRABLE INITIALLY DEFERRED** constraint triggers (parent insert / status change; any
child write). At commit, every `open`/`covered` requirement must have ≥ 1 `hard` and ≤ 20 qualifications
(SQLSTATE 23514). Creating parent + children in one transaction and swapping one hard rating for another keep
working. Before counting, the parent row is **updated** (lock + write), so concurrent editors serialize under
READ COMMITTED and fail instead of committing a stale count under REPEATABLE READ/SERIALIZABLE.
Defense in depth: `assertEvaluableRequirement` (pure domain) makes capacity and matching refuse a requirement
without hard qualifications (400), so even a historical bad row cannot make everyone "eligible".
`draft` is exempt (no UI creates drafts) and cancelling/closing is always allowed, so a legacy row that
predates the check can still be closed; moving to `open`/`covered` runs the check — decision R-D4.

### 4.2 I-3 — atomic passport (`20261015130100_atomic_professional_profile.sql`)

`update_professional_profile(...)` (INVOKER: column grants + RLS still decide) locks the caller's two rows,
optionally compares `expectedUpdatedAt` (ms precision, what the API exposes), updates both tables and returns
the new version. The Edge Function makes one RPC call; the form sends the `updatedAt` it was rendered with and
shows a specific conflict message, keeping the user's input.

### 4.3 I-1 — idempotent creates (`20261015130200_idempotent_creates.sql`)

Contract in `EDGE_FUNCTIONS.md` § Idempotent creates. Key points: schema `app_private` (not exposed by
PostgREST), key scoped to (JWT subject, operation), request hash computed in SQL from canonical parameters
(qualification order irrelevant), claim in the same transaction as the insert (concurrent duplicate waits on
the unique index, then replays), failure rolls the key back. 201 / 200 replay / 409 (`CF409`) / 400. Browser:
`useIdempotencyKey` reuses a key only for the same payload until a confirmed success.

### 4.4 Candidate pool (`20261015130300_candidate_pool_exhaustiveness.sql`)

Root cause: the cap was applied after ordering by "hard types held verified", which says nothing about expiry
inside the period or availability. Options evaluated: pagination, batches, safe SQL prefilter, full
eligibility before the cap, hybrid. Chosen: **hybrid** — the selection order first takes every candidate who
passes the BR-3 hard filters computed in SQL with the _same_ rules as the engine (BR-2 with
`date(endsAt − 1 ms)`, availability with `range_agg` multiranges, `unavailable` subtracted, half-open
intervals), then near misses; the cap stays at 100 (T9). `get_requirement_external_pool_summary` returns
counts only; the UI says _complete_, _near misses trimmed (all eligible evaluated)_, or **partial result**
(more eligible candidates than the cap). SQL is an ordering hint only; `evaluateMatch` still decides, and a
parity test compares both on 300 randomised boundary profiles. Pagination is decision R-D3.

### 4.5 Qualification review (`20261015130400_qualification_review.sql`) — approval checkpoint OD-3

`review_qualification(id, decision, expected_updated_at, note, request_id)` — DEFINER, `search_path = ''`,
refuses unless the owner-only row `app_private.feature_flags('qualification_review', true)` exists, `is_platform_admin()`
from `profiles.platform_role` (no grant can set it; the sign-up trigger always writes `user`), never own
qualification, `active` + `pending` only, `rejected` needs a reason ≤ 500, `FOR UPDATE` + state re-check (a
second reviewer gets 409) and **version re-check** (the reviewer decides on the `updated_at` they saw; a
declaration re-dated meanwhile → 409), audit `qualification.reviewed` with previous/new status, `note_provided` and the
request id (no free text in the audit). Columns `reviewed_by/at`, `review_note` (no write grant; `reviewed_by` and `review_note` are **not
column-readable** by API roles — the table-level SELECT became a column list — and the owner reads reasons
through `own_qualification_reviews()`). Re-dating a reviewed row sends it back to `pending` and clears the review. Edge Function
`qualification-reviews` (GET queue without the reviewer's own declarations + last decisions, POST decision)
**returns 404 unless `QUALIFICATION_REVIEW_ENABLED=true`** and the RPC behind it returns 404 unless the DB flag
is on — so an accidental `db push` of this migration, or a direct RPC call, verifies nothing; page `/app/admin/verifications` is a 404 for anyone but a platform admin.
Verification ≠ validity: an expired verified rating stays verified and is still blocked by BR-2.

### 4.6 Defect found and fixed during the run: PostgREST retry loop

The first version of 4.2 raised `40001` for a stale version. PostgREST (hasql) retries serialization failures
automatically, so a deterministic `40001` looped and held row locks (local E2E timed out; two
`idle in transaction` sessions holding `technician_profiles` locks). Fixed with a private SQLSTATE `CF412`
mapped to 409; rule recorded in `EDGE_FUNCTIONS.md`. PGlite could not have shown it (no PostgREST).

## 5. Files changed by this remediation

Database: the five `20261015130*` migrations (new); `supabase/seed.sql` (requirements inserted with their
qualifications in one statement each); `supabase/config.toml` (+ `qualification-reviews`);
`supabase/functions/.env.example` (+ flag). Edge: `_shared/{errors,validation,cors,requirements}.ts`,
`work-requirements`, `professional-availability`, `professional-qualifications`, `professional-profile`,
`matching-evaluate`, new `qualification-reviews` (+ tests), new `_shared/validation_test.ts`.
App: `src/domain/capacity.ts`, `src/lib/{idempotency,candidate-pool}.ts` (new),
`src/lib/validation/{idempotency,review}.ts` (new), `src/lib/validation/professional.ts`,
`src/server/edge-functions.ts`, `src/types/api.ts`, `src/features/{requirements,availability,qualifications,professional}/…`,
`src/features/matching/{pool.ts,components/PoolCoverageNote.tsx}` (new), `src/features/reviews/**` (new),
`src/app/app/admin/verifications/page.tsx` (new), matches page, professional overview,
`src/components/{layout/AppShell,layout/NavLinks,ui/Metric}.tsx`, `messages/{en,es}.json` (keys added only).
Tests/scripts: `tests/db/rls.test.ts` (J–N added, nothing removed), `tests/e2e/local-remediation.test.ts`,
`src/server/edge-functions.test.ts`, `src/features/matching/pool.test.ts`, `src/lib/validation/review.test.ts`,
`src/domain/capacity.test.ts`, Deno tests; `scripts/local/db-race-check.sh` (new), `scripts/local/ui-smoke.mjs`
(sections 0 and 6), `scripts/export-zip.sh` (earlier request). Docs: see §17.

## 6. Database changes

| Migration        | Adds                                                                                                                                             | Privileges                                                                                                                                                                    | Data change |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `20261015130000` | function + 2 deferred constraint triggers                                                                                                        | execute revoked from public/anon/authenticated                                                                                                                                | none        |
| `20261015130100` | `update_professional_profile`                                                                                                                    | execute to authenticated only                                                                                                                                                 | none        |
| `20261015130200` | schema `app_private`, `idempotency_keys` (+RLS), 2 helpers, 3 RPCs                                                                               | usage on schema + minimal column grants to authenticated; RPCs to authenticated                                                                                               | none        |
| `20261015130300` | `create or replace` pool (same signature/columns/DEFINER/check), private ranking helper, summary RPC                                             | helper: no API grant; summary: authenticated (role-checked)                                                                                                                   | none        |
| `20261015130400` | `app_private.feature_flags`, 3 nullable columns, `review_qualification`, `own_qualification_reviews`, `create or replace` reset trigger function | flag table: no grant; table-level SELECT on `technician_qualifications` replaced by a column list without `reviewed_by`/`review_note`; RPCs to authenticated (checked inside) | none        |

Pre-flight queries before applying to any database with data (0 rows expected; all 0 on the local DB):

```sql
-- BR-1.4 (20261015130000): non-draft requirements without a hard qualification / with > 20
select wr.id from public.work_requirements wr where wr.status <> 'draft' and not exists (
  select 1 from public.work_requirement_qualifications q where q.work_requirement_id = wr.id and q.requirement_level = 'hard');
select work_requirement_id from public.work_requirement_qualifications group by 1 having count(*) > 20;
-- plus the two phase 0.8 checks in docs/integration/crewflex-v13/07-validation-evidence.md
```

Rollback (local, documented, not needed): drop the triggers/functions/columns/schema added by each migration
in reverse order (no data depends on them except `idempotency_keys` and the review columns, which can be
dropped without affecting any existing row). Remote order when authorised: `20261011120000` →
`20261015120000` → `20261015120100` → `20261015130000` → `130100` → `130200` → `130300`, **then** deploy the
changed functions (they call the new RPCs), then push `main`. `20261015130400` only after OD-3 (even if it
were applied, the review stays off until the owner inserts the `qualification_review` flag).
**Correction (2026-10-15, architecture audit):** `professional-qualifications` already selects `reviewed_at` and
calls `own_qualification_reviews()`, both created by `130400`, so `130400` must be applied with the rest (flag row
absent, `qualification-reviews` not deployed) or that function must be changed first. OD-3 governs the
**activation** of the review, not the schema. See `docs/audit/CREWFLEX_DIFF_CURRENT.md` §5. Before any
`db push`, verify in the dashboard that `app_private` is **not** among the exposed API schemas (review S2).

Applied locally (incremental, `sb-local.sh migration up`): all ten migrations recorded in
`supabase_migrations.schema_migrations`. From-scratch creation: PGlite applies all migrations + seed on every
test run.

## 7. RLS / privilege verification

PGlite (`tests/db/rls.test.ts`, executed): members and other organizations cannot touch requirement
qualifications; the invariant cannot be skipped by direct inserts/deletes or delete+insert; anon gets
`permission denied` on every new RPC; `app_private.idempotency_keys` invisible across actors, no delete;
summary and review RPCs refuse members, other orgs, professionals; `ranked_external_pool` not executable by API
roles; nobody can self-assign `platform_role`; professionals cannot write review columns. Real Postgres
(`db-race-check.sh`, executed twice): E-3 sequential and simultaneous commits, I-1 same-key race, double review.

## 8. API contracts (frontend → server action → Edge Function → RPC → render)

| Flow                    | Validation                         | Identity / authz                      | Transaction          | Errors                              | Refresh / success                               |
| ----------------------- | ---------------------------------- | ------------------------------------- | -------------------- | ----------------------------------- | ----------------------------------------------- |
| Create requirement      | Zod client + action + EF           | JWT; org role in EF; RLS in RPC       | one RPC (idempotent) | 400/403/409, field keys             | redirect only after `ok`                        |
| Create window / declare | Zod client + action + EF; key UUID | JWT subject; RLS                      | one RPC (idempotent) | 400/403/409                         | notice only after `ok`; key released then       |
| Save passport           | strict Zod + `expectedUpdatedAt`   | JWT subject; column grants + RLS      | one RPC              | 409 specific copy; form keeps input | revalidate after `ok`                           |
| Matching                | `requirementId`                    | admin/manager (EF + DEFINER re-check) | read                 | 400 if no hard qualification        | completeness note from counts                   |
| Review                  | strict Zod (reason for reject)     | platform role from DB in EF + RPC     | one RPC, row lock    | 403/404/409                         | parent-level notice survives the card's removal |

Types: one definition per contract (`src/types/api.ts`, `src/lib/validation/*`), shared with Deno; the pool
row mapper moved to `src/lib/candidate-pool.ts` so tests and the Edge Function use the same code.
`invokeEdgeFunction` (E-4 test): a rejected fetch or timeout is `NETWORK_ERROR`, a non-envelope body is a
generic error, extra headers cannot replace the session's `Authorization`.

## 9. UI changes (8.x)

- **Navigation (8.3):** items wrap below `lg`; no clipped tab at 360/390 (smoke 24); sections tightened.
- **Passport (8.2):** "Profile completeness" with the explicit sentence "This is not a verification status";
  "Verified N of M" with the count awaiting review (warn tone). Rule BR-11 unchanged (R-D5).
- **Overview (8.1):** "Next steps" panel (rejected → open qualifications; awaiting review explained; next
  BR-11 item with a direct link). No invented KPIs.
- **Qualifications:** a rejected declaration shows the reviewer's reason.
- **Matching:** completeness note (complete / near misses trimmed / partial result as an alert).
- **Admin review page:** queue cards, reason field with hint, decisions history with request reference.
- **Metric cards:** no content overflow at 360 px (smoke 24b; "Anonymous" spilled before).
- **i18n:** every new string in ES and EN, plural forms, aviation codes untouched; catalog parity test green.
- Accessibility: labels/`aria-describedby` on the reason field, `role=alert` for partial results and errors,
  `role=status` for confirmations, table caption, keyboard-operable native controls, no new animation.

## 10. Document wallet — design (phase 7, nothing deployed)

| Topic              | Design                                                                                                                                                                                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data model         | `qualification_documents(id, technician_profile_id, qualification_id null, object_path, sha256, media_type, size_bytes, state, uploaded_at, scanned_at, scan_result, expires_at, retention_until, deleted_at)`; states `uploaded → quarantined → clean \| infected \| rejected → archived/deleted` |
| Storage            | Private bucket `evidence` (no public URLs); path `{profile_id}/{document_id}` generated server-side; DB stores the path only                                                                                                                                                                       |
| Upload             | Edge Function issues a signed **upload** URL for a server-chosen path after checking type (PDF/JPEG/PNG allowlist), declared size ≤ 10 MB; object lands in quarantine; magic-byte check + scanner before `clean`                                                                                   |
| Reads              | Owner: signed URL ≤ 60 s after an ownership check by id (never by a client-sent path). Platform reviewer: same, only for a qualification under review, audited `document.viewed`. Organizations: only after D-07 consent rules                                                                     |
| RLS                | table: owner select/insert(own)/soft-delete; reviewers select via DEFINER function scoped to pending reviews; storage policies deny all direct access to `authenticated` except through signed URLs                                                                                                |
| Review             | Uploading never changes `verification_status`; the reviewer sees the document next to the declaration in `/app/admin/verifications`                                                                                                                                                                |
| Retention/deletion | owner delete → soft delete + object removal job; retention per R-D2-style decision; audit keeps ids only                                                                                                                                                                                           |
| Tests planned      | path traversal, foreign id, expired URL, oversize, wrong magic bytes, infected sample (EICAR), reviewer outside a review, org access before consent, audit rows                                                                                                                                    |
| External deps      | malware scanner service (D-10), storage quotas, legal retention (OD-6)                                                                                                                                                                                                                             |
| Risks              | licences are high-sensitivity personal data (T6/T12); scanning outsourced; signed-URL leakage in logs                                                                                                                                                                                              |
| Pending decisions  | D-07 (what unlocks documents for organizations), D-10 (scanner), OD-3 (reviewer), retention period                                                                                                                                                                                                 |

## 11. Tests (executed 2026-10-15, after the last code change unless noted)

| Suite                                        | PASS | FAIL | SKIPPED | Notes                                                                                                               |
| -------------------------------------------- | ---- | ---- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` → Vitest                        | 216  | 0    | 19      | 19 = the two E2E files without `.env.e2e` (run separately below)                                                    |
| `pnpm check` → Deno (`test:edge`)            | 48   | 0    | 0       | plus deno lint + deno check                                                                                         |
| `pnpm check` → ESLint, `tsc`, Prettier       | ✓    | –    | –       | exit 0                                                                                                              |
| `pnpm build`                                 | ✓    | –    | –       | exit 0                                                                                                              |
| `git diff --check`                           | ✓    | –    | –       |                                                                                                                     |
| E2E local (`pnpm e2e:remote`, URL 127.0.0.1) | 25   | 0    | 0       | 19 `remote-smoke` + 6 `local-remediation`; re-run after the independent-review fixes                                |
| Real-Postgres races (`db-race-check.sh all`) | 4    | 0    | –       | re-run after the review fixes                                                                                       |
| Browser smoke (production build, `:3002`)    | 78   | 0    | –       | final run after all fixes; 76/76 twice earlier; console clean; only localhost contacted                             |
| Browser smoke (`next dev`)                   | 72   | 1    | –       | the one failure = React dev-only `performance.measure` console errors (see LOCAL_ENVIRONMENT §7)                    |
| Regression proof (fails without the fix)     | –    | 6    | –       | E-3: 6 PGlite tests fail with `20261015130000` removed; pool: `winner_included=false` on real PG with the old order |
| Remote anything                              | –    | –    | –       | NOT RUN (out of scope)                                                                                              |

Critical cases from the brief now covered: retries do not duplicate (L, E2E, race), atomicity (K, E2E),
network error ≠ success (E-4), E-3 incl. concurrency, pool 50/100/101/500 + eligible-last + parity, review
roles/transitions/concurrency/audit/matching before-after, private never external, anonymous identity hidden.
Performance (local Docker, synthetic, rolled back): pool 500 candidates 15 ms / summary 7 ms; 5 000 candidates
62 ms / 55 ms; payload bounded (104 rows ≈ 118 kB).

## 12. Blockers

None for local work. Remote rollout is blocked by design (explicit authorisation; OD-9: `main` = production).

## 13. Open decisions

OD-3 / D-01 (review in production), R-D1…R-D5 (`OPEN_DECISIONS.md`), D-07/D-10 for documents.

## 14. Security summary

RLS unchanged or tightened; no service role; every new DEFINER function has `search_path = ''`, revoked public
execute and an in-function role check; identity only from `auth.uid()`; idempotency keys per actor in a schema
PostgREST does not expose; audit metadata ids/flags only. Remaining risks: OD-5 (no organization KYB),
idempotency key retention (R-D2), dev-only console noise, the pre-existing test that mutates the shared PGlite DB.

## 15. Release readiness — **PARTIALLY READY**

Local core: profiles, qualifications, availability, requirements, capacity and matching behave transactionally
and are verified end to end. Not READY because: production still runs the old schema/functions (E-3 is open
there until the authorised rollout), OD-3 is not approved (no verification path in production → no newly
registered professional can become eligible), and the wallet is design-only.

## 16. Next increment (one)

**Authorised production rollout of the integrity remediation** (`20261011120000` → `20261015130300` + redeploy
of `work-requirements`, `professional-availability`, `professional-qualifications`, `professional-profile`,
`matching-evaluate`, `user-preferences`), excluding `20261015130400`/`qualification-reviews`. Why first: E-3
(P0) and the duplicate/partial-write defects are live in production today; the code is ready and verified
locally. Dependencies: owner authorisation, the pre-flight queries in §6 returning 0 on production, migrations
**before** functions (the functions call the new RPCs), guarded E2E afterwards. OD-3 approval is the increment
after that.

> **Correction (2026-10-15, architecture audit):** include `20261015130400` (schema only, flag off, no
> `qualification-reviews` deploy) — see §6 correction; `professional-profile`, `professional-qualifications` and
> `user-preferences` are **first** deploys (production returns 404 for them), and `capacity-evaluate` also
> changed through `_shared`/`src`. Full list: `docs/audit/CREWFLEX_DIFF_CURRENT.md` §5.

## 17. Independent review (QA, read-only subagent) and disposition

No critical or high findings. Every DEFINER function, the trigger bypass paths, idempotency scoping and the
SQL ↔ TypeScript eligibility equivalence were checked and found sound by the reviewer.

| ID  | Finding                                                                                             | Disposition                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| M1  | A reviewer could approve dates changed after the queue was loaded (reset only from non-pending)     | **Fixed**: `expected_updated_at` required; 409 on mismatch; PGlite N-M1 + E2E stale case                      |
| M2  | Org admins could read `review_note` / `reviewed_by` of members                                      | **Fixed**: column-level SELECT without them; owner-only `own_qualification_reviews()`; PGlite N-M2            |
| M3  | Migration would ship with `db push`; RPC callable directly, bypassing the function flag             | **Fixed**: owner-only DB flag checked inside the RPC (a custom GUC was not possible on Supabase); PGlite N-M3 |
| L1  | Legacy invalid requirement could not be cancelled/closed                                            | **Fixed**: invariant enforced for `open`/`covered` only; PGlite J-L1                                          |
| L2  | Pool and summary read in two snapshots (counts may differ by a concurrent edit)                     | Accepted, documented: counts are informational; the eligibility shown always comes from the evaluated rows    |
| L3  | Summary publishes exact network counts per query                                                    | Accepted for org admins/managers (no identities, no cross-org data); revisit with OD-5 / R-D3 (bucketing)     |
| L4  | One key per form: a retry of an uncertain earlier payload after another payload duplicated          | **Fixed**: one key per payload until confirmed success; `src/lib/idempotency.test.ts`                         |
| L5  | Language change made the next passport save a false 409                                             | **Fixed**: version = `technician_profiles.updated_at` (Deno mapping test updated with the reason)             |
| L6  | NULL decision passed the first check (stopped later by NOT NULL)                                    | **Fixed**: explicit null check                                                                                |
| L7  | Queue showed the reviewer's own declarations (then 403)                                             | **Fixed**: filtered out                                                                                       |
| S1  | Possible deadlock if one transaction mixes parent status update + child deletes across requirements | Not reachable from any app path (single-statement PostgREST requests); fails safe; documented                 |
| S2  | `app_private` exposure on the remote project not verified                                           | Pre-rollout check added to §6                                                                                 |
| S3  | µs vs ms precision between SQL and TS for windows written directly                                  | Ordering hint only (eligibility decided in TS); documented                                                    |

The local database was re-synchronised after these fixes: `create or replace` of the two changed function
bodies, and a local revert + re-apply of the (unreleased) `20261015130400` through the guarded wrapper.

## 18. Documentation updated

`BUSINESS_RULES.md` (BR-1.4, BR-2.4 correction, BR-2.6, BR-7, BR-11), `EDGE_FUNCTIONS.md`, `AUTHORIZATION.md`,
`SECURITY_PRIVACY.md` (T9, T10, T19–T21), `DATA_MODEL.md`, `V1_SCOPE.md`, `OPEN_DECISIONS.md` (OD-3, R-D1…R-D5),
`docs/integration/crewflex-v13/06-implementation-roadmap.md`, `07-validation-evidence.md` (new section),
`LOCAL_ENVIRONMENT.md` §9, `QUALITY_GATES.md`. Evidence screenshots: `docs/audit/evidence/remediation-2026-10-15/`
(the earlier evidence files were not overwritten).
