# Deployment plan — Edge Functions to `sbjkzrkmcekokkqiuvvh` (Phase 0.5)

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

## 6. E2E that will run (`tests/e2e/remote-smoke.test.ts`, `pnpm e2e:remote`)

| #   | Check                                                                                       | Proves                                   |
| --- | ------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | `health` 200 with envelope and UUID request id                                              | deploy + envelope                        |
| 2   | `professional-availability` without token → 401 `UNAUTHORIZED`                              | JWT verification in production           |
| 3   | Pro A: POST 201 → GET lists it → PATCH 200                                                  | persistence, ownership from JWT          |
| 4   | Pro B: GET does not list A's window; PATCH/DELETE A's id → 404; A's window still present    | RLS + ownership filter across real users |
| 5   | Org admin: POST requirement 201 → capacity 200 (`gap` numeric) → matching 200               | org authorization, RPCs, shared domain   |
| 6a  | Pro A: POST requirement → 403                                                               | role check from DB, not from client      |
| 6b  | Pro A: capacity on the org's requirement → 403/404                                          | no cross-organization access             |
| —   | Cleanup: the window is deleted; the requirement stays (no delete path in V0, synthetic org) | documented residue                       |

Skipped automatically when `.env.e2e` is absent (so `pnpm test:run` stays green offline).

## 7. Verdict

**NO-GO today** — not because of the code (audit: READY, gate green) but because the authorizations in
section 8 of the delivery report are missing: approval to deploy to the only (production) project, creation
of the synthetic accounts, and the branch being pushed/merged so Vercel and Supabase run the same code.
Once those are given, the sequence in section 3 is **GO** with the rollback above.
