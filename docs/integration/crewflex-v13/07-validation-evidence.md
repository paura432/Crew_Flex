# 07 · Validation evidence (phase 0.8, 2026-10-15)

> Everything below was executed in this phase unless marked otherwise. SKIPPED and BLOCKED are
> never counted as PASS. No remote project was read or written; nothing was committed or pushed.

> **Superseded in part (2026-10-15, later the same day):** the "Edge runtime not running" / "WSL Docker CLI
> unavailable" rows and the NOT RE-RUN / blocked items below were resolved by the remediation run (see the
> remediation section at the end of this file and `docs/qa/LOCAL_ENVIRONMENT.md` §9). Current gate results:
> `memory-bank/01-current-state.md`. The Vitest figure of that section (208) predates the last remediation
> tests; the final run on 2026-10-15 is 216 passed / 19 skipped.

## Environment

| Item                            | State                                                                                                                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch / HEAD                   | `main` @ `a7fd5a7`, with the uncommitted i18n/settings phase (2026-10-11) still in the tree; a baseline snapshot (patch + hashes) was taken before any change                             |
| ZIP                             | `CrewFlex_v1.3_Unificada.zip`, 86/86 manifest hashes OK, extracted to git-ignored `tmp/references/crewflex-v13/`                                                                          |
| Local Supabase (Docker Desktop) | Containers `supabase_*_crew-flex` running; API `127.0.0.1:56321` healthy; **Edge runtime not running**                                                                                    |
| WSL Docker CLI                  | **Unavailable** (`/var/run/docker.sock` missing: Docker Desktop WSL integration proxy not running in Ubuntu) → `supabase status/functions serve` and the `sb-local.sh` wrapper cannot run |
| Remote                          | Not touched                                                                                                                                                                               |

## Gates (final run, after all changes)

| Command                                                                | Result                                                                                                                                                  |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` (lint, typecheck, Vitest, Prettier, deno lint/check/test) | **PASS** — exit 0. Vitest: 18 files passed, 1 skipped (`tests/e2e`, no `.env.e2e` targeting); **161 passed, 13 skipped**. Deno: **36 passed, 0 failed** |
| `pnpm build`                                                           | **PASS** — exit 0                                                                                                                                       |
| `git diff --check`                                                     | **PASS** — no whitespace errors                                                                                                                         |
| Baseline before changes (same tree, before phase 0.8)                  | `pnpm check` exit 0, Vitest 150 passed / 13 skipped, Deno 36 passed                                                                                     |

## New and changed tests (all passing)

| Test                                                                                                                                                             | File                                 | Proves                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| I. "a qualification's type cannot be swapped after declaration, even directly"                                                                                   | `tests/db/rls.test.ts`               | Type immutability is DB-enforced                                                                                       |
| I. "nobody can self-insert a technician profile"                                                                                                                 | same                                 | Organization accounts cannot become professionals via PostgREST                                                        |
| I. "BR-2.7: an active qualification whose type requires expiry must carry one"                                                                                   | same                                 | Insert and update without expiry rejected; non-expiring types accepted                                                 |
| I. "availability windows longer than 366 days are rejected by the database"                                                                                      | same                                 | BR-4.6 DB check                                                                                                        |
| I. "audits the owner's declare, re-date and removal; a re-dated verified row returns to pending"                                                                 | same                                 | `qualification.created/updated/removed` with actor; re-verification policy recorded in metadata                        |
| I. "professionals cannot read the audit trail of their own qualifications"                                                                                       | same                                 | Audit stays admin-only                                                                                                 |
| "the capped external pool keeps the strongest candidates, not the lowest uuids"                                                                                  | same                                 | **Regression for R-11**: failed before `20261015120100` (fully verified candidate missing from 100 rows), passes after |
| C. "a plain member sees colleagues' memberships but not their profiles (OD-4)"                                                                                   | same                                 | Precondition of the workforce crash                                                                                    |
| "omits rows whose profile RLS hides instead of dereferencing null" + mapping test                                                                                | `src/features/workforce/map.test.ts` | **Regression for the `/workforce` TypeError**                                                                          |
| "capacity and external matching use the same evaluator (one algorithm)"                                                                                          | `src/domain/capacity.test.ts`        | Brief's critical case (was structural only)                                                                            |
| Adapted: D. "self-declared qualifications start as pending" now declares B2 **with** an expiry                                                                   | `tests/db/rls.test.ts`               | Same assertion; the old fixture (B2 without expiry) is invalid data under BR-2.7                                       |
| Adapted: F. "B cannot … declare for A" declares with an expiry                                                                                                   | same                                 | Still reaches the RLS `WITH CHECK` (the BEFORE trigger runs first)                                                     |
| Adapted: audit "records qualification.verified" now asserts the verify event is present **and** no `qualification.updated` is written for a verifier-only change | same                                 | Seed inserts now also produce `qualification.created`                                                                  |

No test was deleted or skipped.

## Browser check (local stack, Next dev on :3001, synthetic accounts)

Script: scratch Playwright (`playwright-core` 1.63, Chromium 1248), not committed.

| Account                           | Viewport | `/app/organization/workforce`                          | Console errors | Horizontal overflow |
| --------------------------------- | -------- | ------------------------------------------------------ | -------------- | ------------------- |
| `charlie@crewflex.test` (member)  | 1440     | 200, "The workforce is visible to managers and admins" | none           | no                  |
| `charlie@crewflex.test` (member)  | 390      | same                                                   | none           | no                  |
| `admin.mro@crewflex.test` (admin) | 1440     | 200, full list (Alpha B1.1/EWIS/FTS verified …)        | none           | no                  |

Screenshots: `evidence/p08-01-workforce-member-390.png`, `evidence/p08-02-workforce-member-1440.png`.
Observation (not fixed, V13-X08): on 390 px the navigation is a horizontal strip and the last item
("Availability") is cut off without a visual affordance.

## Critical cases from the brief

| Case                                                      | Status                        | Evidence                                                                                                         |
| --------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Professional edits own profile                            | PASS                          | RLS F                                                                                                            |
| Professional cannot edit another's profile                | PASS                          | RLS A, F                                                                                                         |
| Adds a pending qualification                              | PASS                          | RLS D, F                                                                                                         |
| Cannot mark verified                                      | PASS                          | RLS D, F; `professional.test.ts` (strict schema)                                                                 |
| Expired qualification does not satisfy a hard requirement | PASS                          | matching.test 3, 3b                                                                                              |
| Pending does not satisfy a hard requirement               | PASS                          | matching.test 3d                                                                                                 |
| Valid verified qualification satisfies                    | PASS                          | matching.test 1, 3c                                                                                              |
| Insufficient availability blocks                          | PASS                          | matching.test 5, 6                                                                                               |
| Full availability allows                                  | PASS                          | matching.test 1, adjacent merge                                                                                  |
| Unavailable overrides available                           | PASS                          | matching.test 5b                                                                                                 |
| Private professional never external                       | PASS                          | RLS "candidate pool excludes private…"                                                                           |
| Anonymous does not reveal identity                        | PASS (DB level)               | same; EF/UI level only covered by earlier manual smoke                                                           |
| Organization cannot access another organization           | PASS                          | RLS B                                                                                                            |
| Only authorised roles create requirements                 | PASS (DB)                     | RLS B, C; member via the EF not covered                                                                          |
| Capacity and matching share the evaluator                 | PASS                          | capacity.test (new)                                                                                              |
| A mutation updates the UI                                 | NOT RE-RUN                    | Needs the Edge runtime (blocked today); last evidence 2026-10-11 (`docs/audit/PHASE1_PROFILE_QUALIFICATIONS.md`) |
| Network errors are not shown as success                   | NOT COVERED                   | Code maps `NETWORK_ERROR`; test planned (06 E-4)                                                                 |
| Retries do not create duplicates                          | NOT COVERED / NOT IMPLEMENTED | 06 I-1                                                                                                           |
| Mobile navigation usable                                  | PARTIAL                       | No overflow at 390 px; nav strip truncation observed                                                             |

## Blocked or not executed

| Item                                                                                             | Why                                                                                                                                                                  | What it would need                                                                         |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Apply `20261015120000` + `20261015120100` to the **local Docker** DB                             | The wrapper needs the WSL Docker CLI; the alternative (psql inside the local container via the Windows Docker CLI) was denied by the session's permission classifier | Restore Docker Desktop WSL integration, then `bash scripts/local/sb-local.sh migration up` |
| Local E2E (`tests/e2e`, 19 checks) and UI smoke of passport/qualifications/availability/matching | Edge runtime not running (same cause)                                                                                                                                | Same, then `supabase functions serve`                                                      |
| End-to-end step 5 "an authorised admin verifies the qualification"                               | **No verification mechanism exists** (no grant, RPC, function or UI)                                                                                                 | D-01 (OD-3), then V-1                                                                      |
| V1.3 prototype tests (48 claimed)                                                                | Policy: no prototype code is executed                                                                                                                                | Port the tool tests in block 4                                                             |
| Remote anything                                                                                  | Out of scope (OD-9)                                                                                                                                                  | Explicit authorisation                                                                     |

## Read-only checks run on the local DB (via the Windows Docker CLI)

- Migrations recorded: `20261009120000`, `20261009120100`, `20261011120000`.
- `availability_windows` longer than 366 days: **0**.
- Active qualifications of a `requires_expiry` type without `expires_at`: **0**.

Run the same two counts against production before applying `20261015120000` there:

```sql
select count(*) from public.availability_windows where ends_at > starts_at + interval '366 days';
select count(*) from public.technician_qualifications q
join public.qualification_types t on t.id = q.qualification_type_id
where q.status = 'active' and t.requires_expiry and q.expires_at is null;
```

---

## Remediation run — 2026-10-15 (NEW evidence; everything above is the earlier phase 0.8 record)

Full report: `docs/audit/CREWFLEX_REMEDIATION_2026_10_15.md` (§11 test table). Executed, local only:

| Item                                | Result                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WSL Docker CLI / local stack        | Available; stale DB port proxy fixed by restarting the DB container (no reset, volume kept)                                                                                                |
| Migrations on the local Docker DB   | `20261015120000` … `20261015130400` applied incrementally (`sb-local.sh migration up`)                                                                                                     |
| Edge runtime                        | `supabase functions serve` via the wrapper, all nine functions                                                                                                                             |
| `pnpm check` / `pnpm build`         | PASS / PASS — Vitest 208 passed, 19 skipped (E2E files without env); Deno 48 passed                                                                                                        |
| E2E against the local stack         | 25/25 (19 remote-smoke + 6 local-remediation)                                                                                                                                              |
| Real-Postgres races                 | 4/4 (E-3 ×2, I-1, review)                                                                                                                                                                  |
| Browser smoke on a production build | 78/78, zero console errors, localhost only                                                                                                                                                 |
| Cases previously NOT COVERED        | "Retries do not create duplicates" → PASS; "Network errors are not shown as success" → PASS (E-4); "A mutation updates the UI" → PASS (smoke); "Mobile navigation usable" → PASS (360/390) |
| End-to-end step 5 (admin verifies)  | PASS locally (UI + API + matching before/after); remote use waits for OD-3                                                                                                                 |
