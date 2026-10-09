# Deployment plan — Edge Functions (Phase 0.5 → retargeted to STAGING in Phase 0.6)

**Phase 0.6 (2026-10-09, evening):** the first deployment target is now the STAGING project described in
`docs/architecture/ENVIRONMENTS.md` (to be created by the user). The sequence in §3 stays valid with
`--project-ref <staging-ref> --use-api` on every command and the staging branch domain in `ALLOWED_ORIGINS`;
production follows only after the ten E2E checks pass on staging. The remote E2E now covers the ten
mandatory checks (§6 updated).

Status: **PREPARED, NOT EXECUTED.** Every step below is a proposal awaiting explicit authorization.
Nothing in this phase touched the remote project, GitHub or Vercel.

## 1. Environment facts (verified 2026-10-09, read-only)

| Item                        | State                                                                                                                                                                                               | How verified                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Supabase project            | `Crew_Flex`, eu-central-1, Postgres 17.11, ACTIVE_HEALTHY, linked                                                                                                                                   | `supabase projects list`                                          |
| Deployed functions          | none (`functions list` → `[]`, `/functions/v1/health` → 404)                                                                                                                                        | CLI + curl                                                        |
| Function secrets            | none                                                                                                                                                                                                | `supabase secrets list`                                           |
| Supabase branches (staging) | **none** (`branches list` → `[]`); no second Crew Flex project exists (the other two projects in the account are unrelated and inactive)                                                            | CLI                                                               |
| JWT signing                 | ES256 asymmetric key (JWKS public) → `getClaims()` verifies locally without extra config                                                                                                            | `/auth/v1/.well-known/jwks.json`                                  |
| Auth                        | e-mail provider on, sign-up open, `mailer_autoconfirm = false` (confirmation required). **Must not be changed globally for tests**                                                                  | `/auth/v1/settings`                                               |
| GitHub `paura432/Crew_Flex` | **public** repository; branches `main` (`52d39f9`) and `feat/foundation-v0` (`74a14f6`); this branch is local only; local identity has `push: false`                                                | `gh api`                                                          |
| Vercel production           | GitHub deployments API shows Production deploys of `6ebe0f7` and `52d39f9` (= current `main`). No Vercel CLI/token on this machine; project settings not inspectable                                | `gh api repos/…/deployments`, response headers (`server: Vercel`) |
| Vercel observation          | `/` (cached static page) is served with `access-control-allow-origin: *`; `/login` and `/app` are not. Not set by `next.config.ts`; harmless for a public page, worth confirming in Vercel settings | curl                                                              |

## 2. No staging environment — risk statement

There is a single Supabase project and a single Vercel production deployment. Deploying functions therefore
goes **directly to production**. Mitigating facts: functions are new (nothing currently calls them, every
EF-backed screen already fails), the schema is untouched, the functions act under the caller's RLS, and
the only real account in the database is the deploy's first user. Residual risk: a bundling or runtime
failure is visible to that user as the same error they already see today. Decision needed: **OD-9**
(create a Supabase preview branch / second project for staging before Phase 1 widens the surface).

## 3. Proposed sequence (requires authorization; each step is independently reversible)

```bash
# 0. Pre-flight (already satisfied locally)
pnpm check && pnpm build && git diff --check

# 1. Secret first, so the functions never run with an empty allowlist
pnpm exec supabase secrets set ALLOWED_ORIGINS=https://crew-flex.vercel.app
#    Localhost is NOT in the production secret. Local `functions serve` uses supabase/functions/.env.

# 2. Smallest function first (type-only imports from src/)
pnpm exec supabase functions deploy health --debug
curl -s https://sbjkzrkmcekokkqiuvvh.supabase.co/functions/v1/health      # expect {"ok":true,...}

# 3. First function with runtime imports from ../../../src (bundling risk F-6)
pnpm exec supabase functions deploy professional-availability --debug
curl -s -o /dev/null -w '%{http_code}\n' …/functions/v1/professional-availability   # expect 401

# 4. Remaining functions
pnpm exec supabase functions deploy work-requirements capacity-evaluate matching-evaluate --debug

# 5. Remote E2E with synthetic accounts (section 5)
pnpm e2e:remote
```

Vercel needs **no change**: the app already calls `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/<name>`
server-side with the user's token; no new environment variable is introduced.

## 4. Risks and rollback

| Risk                                                           | Likelihood | Impact                                                    | Detection                                         | Rollback                                                                             |
| -------------------------------------------------------------- | ---------- | --------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| CLI bundler rejects imports outside `supabase/functions` (F-6) | medium     | deploy fails, nothing changes remotely                    | step 3 fails at bundling                          | none needed; apply the `_shared` re-export fallback in `EDGE_FUNCTIONS.md`, redeploy |
| Runtime error on first request (env key lookup, import map)    | low        | 500 on EF-backed screens (same as today)                  | `supabase functions logs <name>`; `health`        | `supabase functions delete <name>` restores the current 404 state                    |
| `getClaims` fails against ES256 keys                           | low        | every authenticated call → 401                            | step 3 curl with a real token (E2E test 2–3)      | delete function; investigate with logs                                               |
| `ALLOWED_ORIGINS` typo                                         | low        | browser CORS failures only (server-side calls unaffected) | E2E (server-side) passes; browser preflight fails | `secrets set` again                                                                  |
| Secrets/keys leak                                              | —          | —                                                         | none printed, none committed (`repo-hygiene`)     | n/a                                                                                  |
| Data loss                                                      | none       | —                                                         | no migration, no DML in this plan                 | n/a                                                                                  |

Rollback is always "delete the function(s)" — never a schema change, never data deletion.

## 5. Synthetic test accounts (no passwords in the repository)

- Three accounts, created by the authorized operator in **Supabase Dashboard → Authentication → Users →
  Add user** with "Auto confirm user" checked (per-user confirmation; the global `mailer_autoconfirm`
  stays `false`). Metadata: `{"account_type":"professional","display_name":"E2E Pro A"}`,
  `{"account_type":"professional","display_name":"E2E Pro B"}`,
  `{"account_type":"organization","display_name":"E2E Org","organization_name":"E2E Org","organization_type":"mro","country":"ES"}`.
  The sign-up trigger (`handle_new_user`) creates the profiles, technician rows and the organization + admin
  membership from that metadata.
- Use an address pattern that is obviously synthetic (e.g. `e2e+pro-a@<your domain>`), never a real person.
- Credentials go only into `.env.e2e` (ignored by git; template `.env.e2e.example`). Rotate/delete the
  accounts when no longer needed.

## 6. E2E that will run (`tests/e2e/remote-smoke.test.ts`, `pnpm e2e:remote`, staging only)

| #   | Check                                                                                                                                         | Proves                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 0   | `health` 200 with envelope and UUID request id                                                                                                | deploy + envelope                                            |
| 1   | Sign-in of professional A and B; token accepted by a function                                                                                 | real JWT verification in the target environment              |
| 2   | Pro A: POST window → 201 with UUID                                                                                                            | create                                                       |
| 3   | Pro A: PATCH → 200 with new status/end; DELETE → 200 and gone                                                                                 | edit + delete                                                |
| 4   | Fresh sign-in (new session) lists the edited window with the edited values                                                                    | persistence after reload                                     |
| 5   | Pro B: list excludes A's window; PATCH/DELETE A's id → 404; direct PostgREST select as B → `[]`                                               | isolation between professionals (function layer **and** RLS) |
| 6   | Org admin: POST requirement → 201; GET `?id=` returns it                                                                                      | authorized creation                                          |
| 7   | capacity-evaluate → 200; `required = 1`; `gap = max(0, required − internallyEligible)`                                                        | capacity evaluation                                          |
| 8   | matching-evaluate twice → identical `summary` and `candidates`; no e-mail-like ids                                                            | deterministic, pseudonymous matching                         |
| 9   | No token → 401; malformed token → 401; professional POST requirement → 403                                                                    | 401/403                                                      |
| 10  | Pro A: GET the org's requirement → 404; capacity on it → 403/404; direct PostgREST select → `[]`                                              | cross-organization protection                                |
| —   | Runner refuses `E2E_SUPABASE_URL` containing the production ref; cleanup deletes the window; one requirement row remains in the synthetic org | safety + documented residue                                  |

Currently **9 tests skipped** (no `.env.e2e`): not PASS, not FAIL — not executed.

## 7. Verdict

**NO-GO for production** (unchanged) and **GO for STAGING once it exists**: the code is ready
(`EDGE_FUNCTIONS_AUDIT.md` §Phase 0.6), the gate is green, the plan and rollback are written, and no step
touches production. What is missing is human work: create the staging project and accounts (plan in
`ENVIRONMENTS.md` §4), push the branch, and provide `.env.e2e`.
