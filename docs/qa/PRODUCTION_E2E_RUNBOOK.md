# Production E2E runbook (synthetic accounts)

Status: **PREPARED, NOT EXECUTED** (2026-10-16; release-1 coverage added 2026-10-19 for `65df3b9`). Production = the single Supabase project
`sbjkzrkmcekokkqiuvvh` (OD-9). Three steps write to production and each needs its own owner approval:
**(1) create the synthetic users, (2) run the E2E, (3) clean up.** Background: `docs/architecture/ENVIRONMENTS.md` §3.

## Configuration

| File                  | Target                   | Used by                                    |
| --------------------- | ------------------------ | ------------------------------------------ |
| `.env.e2e`            | local Docker `127.0.0.1` | `pnpm e2e:remote` (local suite, 41 checks) |
| `.env.e2e.production` | `sbjkzrkmcekokkqiuvvh`   | `pnpm e2e:production`, `scripts/e2e/*.sh`  |

`.env.e2e.production`: git-ignored (`.gitignore` `.env.*`), mode 600, three synthetic identities
(`e2e-pro-a@`, `e2e-pro-b@`, `e2e-org-admin@crewflex.test`) with generated 32-character alphanumeric
passwords, the public publishable key, `E2E_AUTHORIZED_PROJECT_REF`. It never contains `E2E_WRITE_CONFIRM`
or `SUPABASE_SECRET_KEY`; both guards refuse a stored confirmation in any `.env.e2e*` file.

Guard (TS `tests/e2e/guard.ts`, bash `scripts/e2e/_guard.sh`): URL ref = `E2E_AUTHORIZED_PROJECT_REF` = linked
ref (`supabase/.temp/project-ref`) **and** `E2E_WRITE_CONFIRM=WRITE:<ref>:<today UTC>` typed for the run.
Verified 2026-10-16 with the production file and no network: missing, stale or wrong-ref confirmation,
mismatched authorized ref and foreign project URL all exit 2 before any request.

## Preflight (read-only)

```bash
git status --short | wc -l                      # 0
git rev-parse --short origin/main               # the SHA Vercel serves (memory-bank/01-current-state.md)
grep '^E2E_SUPABASE_URL=' .env.e2e .env.e2e.production   # local / production, never swapped
tr -d '[:space:]' < supabase/.temp/project-ref  # sbjkzrkmcekokkqiuvvh
curl -s -o /dev/null -w '%{http_code}\n' https://sbjkzrkmcekokkqiuvvh.supabase.co/functions/v1/health   # 200
# Scope report (read-only SELECT; the script still requires the typed confirmation):
set -a; . ./.env.e2e.production; set +a
E2E_WRITE_CONFIRM=WRITE:sbjkzrkmcekokkqiuvvh:$(date -u +%F) bash scripts/e2e/cleanup-synthetic.sh --dry-run
# expected before step 1: users 0, organizations 0, requirements 0, windows 0, rotations 0 — anything else: STOP
```

## Step 1 — create the synthetic users (approval 1)

```bash
read -rs SUPABASE_SECRET_KEY && export SUPABASE_SECRET_KEY   # paste sb_secret_… (dashboard → API keys); not echoed, not in history
set -a; . ./.env.e2e.production; set +a
E2E_WRITE_CONFIRM=WRITE:sbjkzrkmcekokkqiuvvh:$(date -u +%F) bash scripts/e2e/seed-users.sh
unset SUPABASE_SECRET_KEY
```

Prints only `created <uuid>` ×3. The key and payload reach `curl` through file descriptors (not visible in
`ps`). Post-check: dry-run → users 3, organizations 1, requirements 0, windows 0, rotations 0.

Accounts (no platform admin by design — the review flow stays off, OD-3): **professional A**
`e2e-pro-a@crewflex.test`, **professional B** `e2e-pro-b@crewflex.test`, **organization admin**
`e2e-org-admin@crewflex.test` (creates the synthetic organization `E2E Org`). Passwords only in
`.env.e2e.production` (mode 600, git-ignored), never printed. Read-only proof on 2026-10-19: production has 3
users, **0** match these e-mails or the `e2e`/`+e2e` pattern — the cleanup scope cannot reach them.

## Step 2 — run the E2E (approval 2)

```bash
E2E_WRITE_CONFIRM=WRITE:sbjkzrkmcekokkqiuvvh:$(date -u +%F) pnpm e2e:production
```

Expected: `remote-smoke` **31** passed, 0 skipped, 0 failed (19 earlier + 12 release-1: R1a–R1f, R2a–R2f).
Then the read-only browser checks (same approval; they sign in as A, never save):

```bash
BASE=https://crew-flex.vercel.app PLAYWRIGHT_CORE=<dir with playwright-core> CHROME=<chromium> \
  node --env-file=.env.e2e.production scripts/e2e/ui-release1.mjs   # expected 24/24
```

Honest reading:

- Check 14 (withdraw a verified hard qualification) returns early when the synthetic professional has no
  verified FTS, which is always the case while OD-3 is open (nobody can verify in production): it passes
  **without asserting**. Report it as not exercised.
- R2c in production: nobody can verify a qualification (OD-3), so A is **never eligible**; the test asserts
  only the availability part of the explanation (`AVAILABILITY_COVERS_REQUIREMENT` for `aog`, `NOT_AVAILABLE`
  for `planned`/`urgent`) and `eligible = false`. Full eligibility for AOG is proven locally (seed A verified).
- SQL ↔ TypeScript parity of BR-4.8 is not an E2E concern: `tests/db/rls.test.ts` suite P (local) and the
  release harness (111/111).
- Writes, all on synthetic rows (2031 dates): availability windows and days (cleared by the tests), A's and
  B's saved pattern (restored or deleted), A's passport (restored; visibility set to `anonymous` and back),
  one or two declarations (deleted), language preferences, **four work requirements left in `E2E Org`** per
  run (one planned + R2's planned/urgent/aog; no delete path).

Post-check: dry-run → users 3, organizations 1, requirements = 4 × runs, windows 0, rotations 0.

## Step 3 — clean up (approval 3)

```bash
set -a; . ./.env.e2e.production; set +a
E2E_WRITE_CONFIRM=WRITE:sbjkzrkmcekokkqiuvvh:$(date -u +%F) bash scripts/e2e/cleanup-synthetic.sh --dry-run
E2E_WRITE_CONFIRM=WRITE:sbjkzrkmcekokkqiuvvh:$(date -u +%F) bash scripts/e2e/cleanup-synthetic.sh
```

Scope proof (`scripts/e2e/cleanup-synthetic.sh`):

- Identities: exactly the three e-mails in the file, each validated as a plain address (no quotes → no SQL
  injection; tested) and obviously synthetic (`e2e…@` or `…+e2e…@`; tested), compared lower-cased.
- Deletes, in one transaction (an error commits nothing): requirements **created by** those users;
  organizations whose **every** member is one of those users (an org with any real member is kept); the
  three `auth.users` rows → cascade to profiles, technician rows, availability windows, saved patterns
  (`availability_rotations`, FK `on delete cascade` — verified in production 2026-10-19), qualifications,
  memberships, idempotency keys (cascade, verified). `audit_events` rows stay with NULL actor/org (`on delete set null`).
- No other table, user or organization is reachable from these predicates.

Post-check: dry-run → all five counts 0.

## Recovery

| Situation                                             | Action                                                                                                                                                                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dry-run shows unexpected counts (users > 3, orgs > 1) | **STOP.** Do not run the delete; investigate which rows match.                                                                                                                                                          |
| Seed stopped half-way (e.g. "already registered")     | Dry-run; either continue if all 3 exist, or run step 3 and re-seed.                                                                                                                                                     |
| E2E failed or was interrupted                         | Its `afterAll` removes the window/declaration and restores the passport; any leftover belongs to the synthetic accounts and step 3 removes it. Report FAIL with the output — never re-run until green and call it PASS. |
| Cleanup failed                                        | The transaction rolled back; re-run the dry-run, fix the cause, re-run.                                                                                                                                                 |
| Password or key exposed                               | Step 3 (accounts gone), regenerate passwords in `.env.e2e.production`; rotate the secret key in the dashboard.                                                                                                          |

Never: change global Auth settings, use real people's e-mails, store the secret key or the confirmation in a
file, run step 3 without its own approval.
